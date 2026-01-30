/**
 * Parses iperf3 text output to extract bandwidth data for graphing.
 * Return an array of data points: { time, bandwidth, unit }
 * Normalized to Mbps for consistent graphing.
 */
export function parseIperfOutput(output) {
    if (!output) return [];

    const lines = output.split('\n');
    const data = [];

    // Regex to match standard iperf3 output
    // Example: [  5]   0.00-1.00   sec   128 MBytes  1.07 Gbits/sec
    // Group 1: Interval (e.g. 0.00-1.00)
    // Group 2: Bandwidth value
    // Group 3: Bandwidth unit
    const regex = /\]\s+(\d+\.\d+-\d+\.\d+)\s+sec\s+[\d\.]+\s+[KMG]?Bytes\s+(\d+(?:\.\d+)?)\s+([KMG]?bits\/sec)/;

    lines.forEach(line => {
        // Skip summary lines (usually contain "receiver" or "sender")
        if (line.includes('sender') || line.includes('receiver')) return;

        const match = line.match(regex);
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
