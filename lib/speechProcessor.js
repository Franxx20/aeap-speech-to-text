class SpeechProcessor {
    constructor() {
        this.transcript = [];
        // this.lastSegment = null;
        this.lastReceivedSegment = null;
        // this.lastResponseReceived = null;
        // this.recording = false;
        this.serverBackend = 'faster_whisper';
        this.language = '';
        this.logTranscription = true; // set to true if logging is required
        // this.printBuffer = new PrintBuffer();
        this.uid = "your_client_uid"; // Replace with the actual client UID
    }

    processSegments(segments) {
        let text = [];

        segments.forEach((seg, i) => {
            if (text.length === 0 || text[text.length - 1] !== seg.text) {
                text.push(seg.text);

                if (i === segments.length - 1) {
                    this.lastSegment = seg;
                } else if (this.serverBackend === "faster_whisper" &&
                    (!this.transcript.length ||
                        parseFloat(seg.start) >= parseFloat(this.transcript[this.transcript.length - 1].end))) {
                    this.transcript.push(seg);
                }
            }
        });

        if (!this.lastReceivedSegment || this.lastReceivedSegment !== segments[segments.length - 1].text) {
            this.lastResponseReceived = Date.now();
            this.lastReceivedSegment = segments[segments.length - 1].text;
        }

        if (this.logTranscription) {
            // this.printBuffer.updateBuffer(text.join(""));
            console.log(this.transcript)
        }

    }

    handleStatusMessages(messageData) {
        const status = messageData.status;
        if (status === "WAIT") {
            console.info(`[INFO]: Server is full. Estimated wait time ${Math.round(messageData.message)} minutes.`);
        } else if (status === "ERROR") {
            console.error(`Message from Server: ${messageData.message}`);
        } else if (status === "WARNING") {
            console.warn(`Message from Server: ${messageData.message}`);
        }
    }

    handleMessage(data) {
        const message = JSON.parse(data);
        console.log(message)

        // if (this.uid !== message.uid) {
        //     console.error("[ERROR]: Invalid client UID");
        //     return;
        // }

        if ("status" in message) {
            this.handleStatusMessages(message);
            return;
        }

        if (message.message === "DISCONNECT") {
            console.info("[INFO]: Server disconnected due to overtime.");
        }

        if (message.message === "SERVER_READY") {
            this.lastResponseReceived = Date.now();
            // this.serverBackend = message.backend;
            console.info(`[INFO]: Server Running with backend ${this.serverBackend}`);
        }

        if ("language" in message) {
            this.language = message.language;
            const langProb = 'en_US';
            console.info(`[INFO]: Server detected language ${this.language} with probability ${langProb}`);
        }

        if ("segments" in message) {
            this.processSegments(message.segments);
        }
    }
}


module.exports = {
    SpeechProcessor,
}
