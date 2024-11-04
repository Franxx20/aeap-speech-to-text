class TranscriptProcessor {
    constructor(callback, serverBackend) {
        this.callback = callback;               // Callback function to handle processed text
        this.serverBackend = serverBackend;      // Server backend type
        this.transcript = [];                    // Full transcript as an array of segment objects
        this.lastSegment = null;                 // Last processed segment
        this.lastReceivedSegment = null;         // Last segment text received
        this.lastResponseReceived = null;        // Timestamp of the last response received
    }

    /**
     * Processes an array of segments and updates the transcript.
     * @param {Array} segments - Array of segment objects with `text`, `start`, and `end` properties.
     * @param {Boolean} isFinal - Flag indicating if the segments are final.
     */
    processSegments(segments, isFinal) {
        const text = [];  // Accumulate new segment text for callback

        segments.forEach((seg, i) => {
            // Check if the current segment text is unique from the previous one
            if (!text.length || text[text.length - 1] !== seg.text) {
                text.push(seg.text);

                // Store the last segment for finalization or further processing
                if (i === segments.length - 1) {
                    this.lastSegment = seg;
                } else if (
                    this.serverBackend === "faster_whisper" &&
                    (!this.transcript.length || parseFloat(seg.start) >= parseFloat(this.transcript[this.transcript.length - 1].end))
                ) {
                    this.transcript.push(seg);
                }
            }
        });

        // Update last received segment only if different from the previous one
        if (!this.lastReceivedSegment || this.lastReceivedSegment !== segments[segments.length - 1].text) {
            this.lastResponseReceived = Date.now();
            this.lastReceivedSegment = segments[segments.length - 1].text;
        }

        // Invoke the callback with the processed text and finality status
        this.callback(text.join(' '), isFinal);
    }
}


module.exports = {
    TranscriptProcessor
}
