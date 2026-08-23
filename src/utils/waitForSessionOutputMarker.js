/**
 * Wait for a unique marker string on the session's terminal data stream.
 * Used to approximate "command finished" on interactive shells (PTY) where
 * there is no exit-code event per line.
 */

const DEFAULT_TIMEOUT_MS = 120000;
const MAX_BUFFER = 512 * 1024;

function attachDataListener(connectionType, ipcConnectionId, onData) {
  const handler =
    connectionType === 'serial'
      ? (event, connectionId, data) => {
          if (connectionId !== ipcConnectionId) return;
          onData(data);
        }
      : (event, payload) => {
          if (!payload || payload.connectionId !== ipcConnectionId) return;
          onData(payload.data || '');
        };

  switch (connectionType) {
    case 'ssh':
      window.electronAPI.onSSHData(handler);
      return () => window.electronAPI.offSSHData(handler);
    case 'telnet':
      window.electronAPI.onTelnetData(handler);
      return () => window.electronAPI.offTelnetData(handler);
    case 'local':
      window.electronAPI.onLocalData(handler);
      return () => window.electronAPI.offLocalData(handler);
    case 'serial':
      window.electronAPI.onSerialData(handler);
      return () => window.electronAPI.offSerialData(handler);
    default:
      throw new Error(`Unsupported connection type: ${connectionType}`);
  }
}

/**
 * Resolves when `marker` appears in combined output for this IPC connection.
 * @param {object} opts
 * @param {'ssh'|'telnet'|'local'|'serial'} opts.connectionType
 * @param {string} opts.ipcConnectionId
 * @param {string} opts.marker
 * @param {number} [opts.timeoutMs]
 * @param {AbortSignal} [opts.signal]
 */
export function waitForMarkerInSessionStream({
  connectionType,
  ipcConnectionId,
  marker,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal
}) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let settled = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      detach();
      if (abortHandler && signal) {
        signal.removeEventListener('abort', abortHandler);
      }
    };

    const onData = (data) => {
      buffer += data;
      if (buffer.length > MAX_BUFFER) {
        buffer = buffer.slice(-MAX_BUFFER);
      }
      if (buffer.includes(marker)) {
        cleanup();
        resolve();
      }
    };

    const detach = attachDataListener(connectionType, ipcConnectionId, onData);

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('TIMEOUT'));
    }, timeoutMs);

    let abortHandler;
    if (signal) {
      abortHandler = () => {
        cleanup();
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', abortHandler, { once: true });
    }
  });
}

export function makeLibrarySyncMarker() {
  return `__ASHLIB_${crypto.randomUUID().replace(/-/g, '')}__`;
}

/**
 * Sends a command line, then a marker echo line, and waits until the marker
 * appears in the session output stream (meaning the shell reached the echo).
 *
 * Requires a shell that runs both lines in order (bash/sh/cmd/PowerShell "echo" works in typical cases).
 *
 * @param {object} opts
 * @param {{ write: Function, sessionConnectionId: string }} opts.connection
 * @param {'ssh'|'telnet'|'local'|'serial'} opts.connectionType
 * @param {string} opts.commandText
 * @param {number} [opts.timeoutMs]
 * @param {AbortSignal} [opts.signal]
 */
export async function writeCommandAndWaitForShellMarker({
  connection,
  connectionType,
  commandText,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal
}) {
  const ipcConnectionId = connection.sessionConnectionId;
  if (!ipcConnectionId) {
    throw new Error('Missing sessionConnectionId on connection');
  }

  const marker = makeLibrarySyncMarker();
  const waitPromise = waitForMarkerInSessionStream({
    connectionType,
    ipcConnectionId,
    marker,
    timeoutMs,
    signal
  });

  connection.write(commandText + '\r\n');
  connection.write(`echo ${marker}\r\n`);

  await waitPromise;
}

export { DEFAULT_TIMEOUT_MS as LIBRARY_SYNC_DEFAULT_TIMEOUT_MS };
