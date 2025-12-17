
const { Transform } = require('stream');

/**
 * A Transform stream that buffers data to optimize IPC performance.
 * It emits data when either:
 * 1. The max buffer size is reached (prevent memory spikes)
 * 2. The flush interval elapses (ensure responsiveness)
 */
export class SerialBufferedTransform extends Transform {
    constructor(options = {}) {
        super(options);

        this.maxBufferSize = options.maxBufferSize || 8192; // 8KB default
        this.flushInterval = options.flushInterval || 16;   // 16ms (~60fps) default

        this.buffer = '';
        this.flushTimer = null;
    }

    _transform(chunk, encoding, callback) {
        // Append new data
        const data = chunk.toString();
        this.buffer += data;

        // Check if buffer is full
        if (this.buffer.length >= this.maxBufferSize) {
            this.pushData();
        }
        // If timer not running, start it
        else if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => {
                this.pushData();
            }, this.flushInterval);
        }

        callback();
    }

    _flush(callback) {
        this.pushData();
        callback();
    }

    pushData() {
        // Clear timer if it exists
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        // Push data if we have any
        if (this.buffer.length > 0) {
            const dataToPush = this.buffer;
            this.buffer = ''; // Reset buffer immediately
            this.push(dataToPush);
        }
    }

    _destroy(err, callback) {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        this.buffer = '';
        super._destroy(err, callback);
    }
}
