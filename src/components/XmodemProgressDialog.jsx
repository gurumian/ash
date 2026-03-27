import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './XmodemProgressDialog.css';

function formatElapsed(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatByteCount(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return n.toLocaleString();
}

function formatSpeedKbps(bytesSent, elapsedMs) {
  if (!Number.isFinite(bytesSent) || !Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return '—';
  }
  const bitsPerSecond = (bytesSent * 8 * 1000) / elapsedMs;
  const kbps = bitsPerSecond / 1000;
  return kbps.toFixed(kbps >= 100 ? 0 : 1);
}

/**
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {'waiting_sync'|'synced'|'sending'|'eot'|'complete'|'idle'} props.phase
 * @param {string} props.fileName
 * @param {'crc'|'checksum'|null} props.protocol
 * @param {number} [props.packetSize]
 * @param {number|null} props.startedAt — DOMHighResTimeStamp or Date.now() ms
 * @param {number} props.currentBlock
 * @param {number} props.totalBlocks
 * @param {number} props.bytesSent
 * @param {number} props.totalBytes
 * @param {() => void} [props.onCancel] — cancel in-progress transfer (not shown when complete)
 * @param {() => void} props.onClose
 */
export function XmodemProgressDialog({
  isOpen,
  phase,
  fileName,
  protocol,
  packetSize = 128,
  startedAt,
  currentBlock,
  totalBlocks,
  bytesSent,
  totalBytes,
  onCancel,
  onClose,
}) {
  const { t } = useTranslation('common');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [cancelClicked, setCancelClicked] = useState(false);

  useEffect(() => {
    if (!isOpen) setCancelClicked(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !startedAt) {
      setElapsedMs(0);
      return;
    }
    if (phase === 'complete') {
      setElapsedMs(Date.now() - startedAt);
      return;
    }
    const tick = () => setElapsedMs(Date.now() - startedAt);
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [isOpen, startedAt, phase]);

  if (!isOpen) return null;

  const isComplete = phase === 'complete';
  const isIndeterminate = phase === 'waiting_sync' || phase === 'eot';

  let pct = 0;
  if (isComplete) {
    pct = 100;
  } else if (phase === 'synced') {
    pct = 0;
  } else if (phase === 'sending' && totalBlocks > 0) {
    pct = Math.min(100, Math.round((currentBlock / totalBlocks) * 100));
  } else if (phase === 'sending' && totalBytes > 0) {
    pct = Math.min(100, Math.round((bytesSent / totalBytes) * 100));
  }

  let statusKey = 'xmodemPhaseWaitingSync';
  if (phase === 'synced') statusKey = 'xmodemPhaseSynced';
  else if (phase === 'sending') statusKey = 'xmodemPhaseSending';
  else if (phase === 'eot') statusKey = 'xmodemPhaseEot';
  else if (phase === 'complete') statusKey = 'xmodemPhaseComplete';

  const protocolLabel =
    protocol === 'crc'
      ? t('xmodemProtocolCrc')
      : protocol === 'checksum'
        ? t('xmodemProtocolChecksum')
        : '—';

  const showMetrics = totalBlocks > 0 && phase !== 'waiting_sync';
  const speedKbps = formatSpeedKbps(phase === 'synced' ? 0 : bytesSent, elapsedMs);

  return (
    <div className="xmodem-progress-overlay">
      <div className="xmodem-progress-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="xmodem-progress-header">
          <h3>{t('xmodemDialogTitle')}</h3>
        </div>
        <div className="xmodem-progress-body">
          <p className="xmodem-progress-status">{t(statusKey)}</p>

          <dl className="xmodem-progress-grid">
            <div className="xmodem-progress-row">
              <dt>{t('xmodemFieldFileName')}</dt>
              <dd className="xmodem-progress-filename" title={fileName || ''}>
                {fileName || '—'}
              </dd>
            </div>
            <div className="xmodem-progress-row">
              <dt>{t('xmodemFieldProtocol')}</dt>
              <dd>{protocolLabel}</dd>
            </div>
            <div className="xmodem-progress-row">
              <dt>{t('xmodemFieldPacket')}</dt>
              <dd>{t('xmodemPacketDetail', { size: packetSize })}</dd>
            </div>
            {showMetrics && (
              <div className="xmodem-progress-row">
                <dt>{t('xmodemFieldBlock')}</dt>
                <dd>
                  {t('xmodemBlocksProgress', {
                    current: phase === 'synced' ? 0 : currentBlock,
                    total: totalBlocks,
                  })}
                </dd>
              </div>
            )}
            {showMetrics && (
              <div className="xmodem-progress-row">
                <dt>{t('xmodemFieldBytes')}</dt>
                <dd>
                  {t('xmodemBytesTransferred', {
                    current: formatByteCount(phase === 'synced' ? 0 : bytesSent),
                    total: formatByteCount(totalBytes),
                  })}
                </dd>
              </div>
            )}
            <div className="xmodem-progress-row">
              <dt>{t('xmodemFieldElapsed')}</dt>
              <dd className="xmodem-progress-mono">{formatElapsed(elapsedMs)}</dd>
            </div>
            {showMetrics && (
              <div className="xmodem-progress-row">
                <dt>{t('xmodemFieldSpeed')}</dt>
                <dd className="xmodem-progress-mono">{t('xmodemSpeedKbps', { value: speedKbps })}</dd>
              </div>
            )}
          </dl>

          <div className="xmodem-progress-bar-wrap">
            <div
              className={`xmodem-progress-bar-track ${isIndeterminate ? 'xmodem-progress-bar-indeterminate' : ''}`}
              role="progressbar"
              aria-valuenow={isIndeterminate ? undefined : pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              {!isIndeterminate && (
                <div className="xmodem-progress-bar-fill" style={{ width: `${pct}%` }} />
              )}
              {isIndeterminate && <div className="xmodem-progress-bar-indeterminate-inner" />}
            </div>
            <p className="xmodem-progress-pct" aria-live="polite">
              {isIndeterminate
                ? t('xmodemProgressIndeterminate')
                : t('xmodemProgressPercent', { value: pct })}
            </p>
          </div>
        </div>
        {!isComplete && onCancel && (
          <div className="xmodem-progress-footer xmodem-progress-footer-cancel">
            <button
              type="button"
              className="xmodem-progress-cancel"
              onClick={() => {
                setCancelClicked(true);
                onCancel();
              }}
              disabled={cancelClicked}
            >
              {t('cancel')}
            </button>
          </div>
        )}
        {isComplete && (
          <div className="xmodem-progress-footer">
            <button type="button" className="xmodem-progress-ok" onClick={onClose}>
              {t('ok')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
