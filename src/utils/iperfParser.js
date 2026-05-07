/**
 * iperf3 interval lines, either:
 * - Classic: [  5]   0.00-1.00   sec   128 MBytes  1.07 Gbits/sec … sender
 * - Role tags (common with --bidir): [  5][TX-C]   0.00-1.01   sec  26.8 MBytes   223 Mbits/sec
 */
const IPERF_INTERVAL_REGEX =
    /\[(\s*\d+)\](?:\[([^\]]+)\])?\s+(\d+\.\d+)-(\d+\.\d+)\s+sec\s+[\d.]+\s+[KMG]?Bytes\s+(\d+(?:\.\d+)?)\s+([KMG]?bits\/sec)/;

/** Wide-interval rows are final summaries (e.g. 0.00–10.02 sec); typical -i 1 rows span ~1 s. */
const SUMMARY_INTERVAL_MIN_SPAN_SEC = 6.5;

function toMbps(value, unit) {
    let mbps = value;
    if (unit.startsWith('G')) {
        mbps = value * 1000;
    } else if (unit.startsWith('K')) {
        mbps = value / 1000;
    } else if (unit.startsWith('bits')) {
        mbps = value / 1000000;
    }
    return mbps;
}

function directionFromLine(roleTag, line) {
    if (roleTag) {
        const u = roleTag.trim().toUpperCase();
        if (u.startsWith('TX')) return 'upload';
        if (u.startsWith('RX')) return 'download';
    }
    const sr = /\b(sender|receiver)\b/i.exec(line);
    if (sr) {
        return sr[1].toLowerCase() === 'sender' ? 'upload' : 'download';
    }
    return 'single';
}

/**
 * Parse one interval line. Skips summary rows (wide time span).
 * Bidirectional: [TX-*] → upload, [RX-*] → download (client perspective); or sender/receiver suffix.
 */
function parseIperfIntervalLine(line) {
    if (!line || typeof line !== 'string') return null;

    const match = line.match(IPERF_INTERVAL_REGEX);
    if (!match) return null;

    const streamId = parseInt(match[1].trim(), 10);
    const roleTag = match[2] || null;
    const start = parseFloat(match[3]);
    const end = parseFloat(match[4]);
    const span = end - start;
    if (span >= SUMMARY_INTERVAL_MIN_SPAN_SEC) return null;

    const value = parseFloat(match[5]);
    const unit = match[6];
    const mbps = toMbps(value, unit);
    const direction = directionFromLine(roleTag, line);

    return {
        streamId,
        time: end,
        mbps,
        direction,
        displayValue: value,
        displayUnit: unit,
    };
}

/**
 * Parses iperf3 text output to extract bandwidth data for graphing.
 * Normalized to Mbps. Single-direction tests: { time, bandwidth }.
 * Bidirectional (--bidir): { time, upload, download } per interval (parallel streams summed).
 * Duplicate lines for the same stream/interval/direction (noisy stdout) collapse to one sample via max.
 */
export function parseIperfOutput(output) {
    if (!output) return [];

    const raw = [];
    for (const line of output.split('\n')) {
        const p = parseIperfIntervalLine(line);
        if (p) raw.push(p);
    }

    /** Dedupe identical repeated rows; sum distinct parallel streams (different streamId). */
    const dedup = new Map();
    for (const p of raw) {
        const k = `${p.streamId}\t${p.time}\t${p.direction}`;
        dedup.set(k, Math.max(dedup.get(k) || 0, p.mbps));
    }

    const byTime = new Map();
    for (const [k, mbps] of dedup) {
        const [, tStr, dir] = k.split('\t');
        const t = parseFloat(tStr);
        if (!byTime.has(t)) {
            byTime.set(t, { time: t });
        }
        const row = byTime.get(t);
        if (dir === 'upload') {
            row.upload = (row.upload || 0) + mbps;
        } else if (dir === 'download') {
            row.download = (row.download || 0) + mbps;
        } else {
            row.bandwidth = (row.bandwidth || 0) + mbps;
        }
    }

    return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
}

/**
 * Parse a single iperf3 output line and return { bandwidth } in Mbps, or null if not matched.
 * Used by App.jsx for aggregation (e.g. parseIperfLine(line) -> parsed.bandwidth).
 */
export function parseIperfLine(line) {
    const p = parseIperfIntervalLine(line);
    if (!p) return null;
    return { bandwidth: p.mbps };
}
