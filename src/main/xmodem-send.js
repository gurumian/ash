/**
 * Xmodem-128 sender (CRC or checksum) over an open SerialPort.
 * Pauses the terminal pipe, sends file blocks, then restores the pipe.
 */

const SOH = 0x01;
const EOT = 0x04;
const ACK = 0x06;
const NAK = 0x15;
const CAN = 0x18;
const SYNC_CRC = 0x43; // 'C'

const PAD = 0x1a;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const SYNC_TIMEOUT_MS = 60000;
const PACKET_ACK_TIMEOUT_MS = 3000;
const MAX_RETRIES = 10;
/** Sender abort: many stacks send eight CAN (0x18) bytes in a row. */
const SENDER_CANCEL_BURST = 8;

/** Exported for serial-xmodem-cancel IPC (immediate notify to receiver). */
export function sendSenderCancelBurst(port) {
  try {
    if (!port?.isOpen) return;
    port.write(Buffer.alloc(SENDER_CANCEL_BURST, CAN));
  } catch (_) {
    /* ignore */
  }
}

function throwIfCancelled(shouldAbort) {
  if (typeof shouldAbort === 'function' && shouldAbort()) {
    const err = new Error('Transfer cancelled');
    err.code = 'XMODEM_CANCELLED';
    throw err;
  }
}

/** Pull any bytes already in the readable buffer (avoids missing C/NAK sent just before we attached). */
function drainReadableToQueue(port, queue) {
  try {
    if (!port || typeof port.read !== 'function') return;
    for (;;) {
      const chunk = port.read();
      if (chunk === null) break;
      queue.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
  } catch (_) {
    /* ignore */
  }
}

class ByteQueue {
  constructor() {
    this.buf = Buffer.alloc(0);
    /** @type {{ resolve: (b: number) => void, timer: ReturnType<typeof setTimeout> }[]} */
    this.waiters = [];
  }

  push(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    while (this.buf.length > 0 && this.waiters.length > 0) {
      const w = this.waiters.shift();
      clearTimeout(w.timer);
      const b = this.buf[0];
      this.buf = this.buf.subarray(1);
      w.resolve(b);
    }
  }

  readByte(timeoutMs) {
    return new Promise((resolve, reject) => {
      if (this.buf.length > 0) {
        const b = this.buf[0];
        this.buf = this.buf.subarray(1);
        resolve(b);
        return;
      }
      const entry = { resolve, timer: null };
      entry.timer = setTimeout(() => {
        const i = this.waiters.indexOf(entry);
        if (i >= 0) this.waiters.splice(i, 1);
        reject(new Error('timeout'));
      }, timeoutMs);
      this.waiters.push(entry);
    });
  }
}

function crc16Xmodem(data128) {
  let crc = 0;
  for (let i = 0; i < data128.length; i++) {
    crc ^= data128[i] << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc;
}

function checksum8(data128) {
  let s = 0;
  for (let i = 0; i < data128.length; i++) s += data128[i];
  return s & 0xff;
}

function buildBlockPacket(blockNum, data128, useCrc) {
  const tail = useCrc ? 2 : 1;
  const packet = Buffer.alloc(3 + 128 + tail);
  packet[0] = SOH;
  packet[1] = blockNum & 0xff;
  packet[2] = (255 - (blockNum & 0xff)) & 0xff;
  data128.copy(packet, 3, 0, 128);
  if (useCrc) {
    const crc = crc16Xmodem(data128);
    packet[131] = (crc >> 8) & 0xff;
    packet[132] = crc & 0xff;
  } else {
    packet[131] = checksum8(data128);
  }
  return packet;
}

function writeAndDrain(port, buf) {
  return new Promise((resolve, reject) => {
    port.write(buf, (err) => {
      if (err) {
        reject(err);
        return;
      }
      port.drain((drainErr) => {
        if (drainErr) reject(drainErr);
        else resolve();
      });
    });
  });
}

async function waitForAck(queue, timeoutMs, shouldAbort) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    throwIfCancelled(shouldAbort);
    const left = Math.min(250, deadline - Date.now());
    if (left <= 0) break;
    try {
      const b = await queue.readByte(left);
      if (b === ACK) return 'ACK';
      if (b === NAK) return 'NAK';
      if (b === CAN) return 'CAN';
    } catch (e) {
      if (e.message !== 'timeout') throw e;
    }
  }
  throw new Error('Timeout waiting for ACK');
}

async function waitForSyncByte(queue, shouldAbort) {
  const deadline = Date.now() + SYNC_TIMEOUT_MS;
  while (Date.now() < deadline) {
    throwIfCancelled(shouldAbort);
    const left = Math.min(500, deadline - Date.now());
    if (left <= 0) break;
    try {
      const b = await queue.readByte(left);
      if (b === SYNC_CRC) return true;
      if (b === NAK) return false;
    } catch (e) {
      if (e.message !== 'timeout') throw e;
    }
  }
  throw new Error('Timeout waiting for receiver (send C for CRC or NAK for checksum)');
}

/**
 * @param {*} port — open SerialPort instance
 * @param {*} parser — SerialBufferedTransform (must support pushData, pipe)
 * @param {Buffer} fileBuffer
 * @param {(payload: { phase: string, protocol?: 'crc'|'checksum', packetSize?: number, currentBlock?: number, totalBlocks?: number, bytesSent?: number, totalBytes?: number }) => void} [onProgress]
 * @param {() => boolean} [shouldAbort] — return true to cancel transfer
 */
export async function runXmodemSend(port, parser, fileBuffer, onProgress, shouldAbort) {
  if (!port?.isOpen) {
    throw new Error('Serial port is not open');
  }
  if (fileBuffer.length > MAX_FILE_BYTES) {
    throw new Error(`File too large (max ${MAX_FILE_BYTES} bytes)`);
  }

  if (typeof parser?.pushData === 'function') {
    parser.pushData();
  }

  port.unpipe(parser);
  if (typeof port.resume === 'function') {
    port.resume();
  }

  const queue = new ByteQueue();
  const onData = (chunk) => queue.push(chunk);
  port.on('data', onData);
  drainReadableToQueue(port, queue);

  try {
    onProgress?.({ phase: 'waiting_sync' });
    throwIfCancelled(shouldAbort);
    const useCrc = await waitForSyncByte(queue, shouldAbort);
    const protocol = useCrc ? 'crc' : 'checksum';
    const totalLen = fileBuffer.length;
    const numBlocks = totalLen === 0 ? 1 : Math.ceil(totalLen / 128);

    onProgress?.({
      phase: 'synced',
      protocol,
      packetSize: 128,
      totalBlocks: numBlocks,
      totalBytes: totalLen,
      currentBlock: 0,
      bytesSent: 0,
    });

    for (let bi = 0; bi < numBlocks; bi++) {
      throwIfCancelled(shouldAbort);
      const blockNum = (bi + 1) & 0xff;
      const data128 = Buffer.alloc(128, PAD);
      const start = bi * 128;
      const sliceLen = Math.min(128, totalLen - start);
      if (sliceLen > 0) {
        fileBuffer.copy(data128, 0, start, start + sliceLen);
      }

      const packet = buildBlockPacket(blockNum, data128, useCrc);

      let accepted = false;
      for (let attempt = 0; attempt < MAX_RETRIES && !accepted; attempt++) {
        throwIfCancelled(shouldAbort);
        await writeAndDrain(port, packet);
        const r = await waitForAck(queue, PACKET_ACK_TIMEOUT_MS, shouldAbort);
        if (r === 'ACK') {
          accepted = true;
          break;
        }
        if (r === 'CAN') {
          throw new Error('Transfer cancelled by receiver (CAN)');
        }
      }
      if (!accepted) {
        throw new Error(`Block ${bi + 1}: no ACK after ${MAX_RETRIES} retries`);
      }

      const bytesSent = Math.min((bi + 1) * 128, totalLen);
      onProgress?.({
        phase: 'sending',
        protocol,
        currentBlock: bi + 1,
        totalBlocks: numBlocks,
        bytesSent,
        totalBytes: totalLen,
      });
    }

    onProgress?.({ phase: 'eot', protocol });
    throwIfCancelled(shouldAbort);

    let eotOk = false;
    for (let eotTry = 0; eotTry < 2 && !eotOk; eotTry++) {
      throwIfCancelled(shouldAbort);
      await writeAndDrain(port, Buffer.from([EOT]));
      try {
        const r = await waitForAck(queue, PACKET_ACK_TIMEOUT_MS, shouldAbort);
        if (r === 'ACK') eotOk = true;
        if (r === 'CAN') throw new Error('Transfer cancelled by receiver (CAN)');
      } catch (e) {
        if (e.message !== 'Timeout waiting for ACK' && e.message !== 'timeout') throw e;
      }
    }
    if (!eotOk) {
      throw new Error('Timeout waiting for ACK after EOT');
    }

    return { bytesSent: totalLen, blocks: numBlocks, protocol };
  } finally {
    port.removeListener('data', onData);
    port.pipe(parser);
  }
}
