/** Regex to match standard iperf3 output: [  5]   0.00-1.00   sec   128 MBytes  1.07 Gbits/sec */
const IPERF_LINE_REGEX = /\]\s+(\d+\.\d+-\d+\.\d+)\s+sec\s+[\d\.]+\s+[KMG]?Bytes\s+(\d+(?:\.\d+)?)\s+([KMG]?bits\/sec)/;

/**
 * Parses iperf3 text output to extract bandwidth data for graphing.
 * Return an array of data points: { time, bandwidth, unit }
 * Normalized to Mbps for consistent graphing.
 */
export function parseIperfOutput(output) {
    if (!output) return [];

    const lines = output.split('\n');
    const data = [];

    lines.forEach(line => {
        // Skip summary lines (usually contain "receiver" or "sender")
        if (line.includes('sender') || line.includes('receiver')) return;

        const match = line.match(IPERF_LINE_REGEX);
        if (match) {
            const interval = match[1];
            const value = parseFloat(match[2]);
            const unit = match[3];

            // Extract end time from interval (e.g., "0.00-1.00" -> 1.00)
            const endTime = parseFloat(interval.split('-')[1]);

            // Normalize to Mbps
            let mbps = value;
            if (unit.startsWith('G')) {
                mbps = value * 1000;
            } else if (unit.startsWith('K')) {
                mbps = value / 1000;
            } else if (unit.startsWith('bits')) {
                mbps = value / 1000000;
            }

            data.push({
                time: endTime,
                bandwidth: mbps,
                displayValue: value,
                displayUnit: unit,
                originalLine: line
            });
        }
    });

    return data;
}

/**
 * Parse a single iperf3 output line and return { bandwidth } in Mbps, or null if not matched.
 * Used by App.jsx for aggregation (e.g. parseIperfLine(line) -> parsed.bandwidth).
 */
export function parseIperfLine(line) {
    if (!line || typeof line !== 'string') return null;
    if (line.includes('sender') || line.includes('receiver')) return null;

    const match = line.match(IPERF_LINE_REGEX);
    if (!match) return null;

    const value = parseFloat(match[2]);
    const unit = match[3];
    let mbps = value;
    if (unit.startsWith('G')) {
        mbps = value * 1000;
    } else if (unit.startsWith('K')) {
        mbps = value / 1000;
    } else if (unit.startsWith('bits')) {
        mbps = value / 1000000;
    }
    return { bandwidth: mbps };
}
