const { randomUUID } = require('crypto');

class WebSocketProvider {
    constructor(speechConfig) {
        this.serverUrl = speechConfig.serverUrl;  // WebSocket server URL
        this.ws = null;
        this.results = [];
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket('ws://localhost:9090');

            this.ws.on('open', () => {
                console.log('[INFO]: WebSocket connection established.');
                resolve();
            });

            this.ws.on('message', (data) => {
                const message = JSON.parse(data);
                if (message.type === 'result') {
                    this.results.push(message.text); // Store transcription results
                }
            });

            this.ws.on('error', (err) => {
                console.error('[ERROR]: WebSocket error:', err);
                reject(err);
            });

            this.ws.on('close', () => {
                console.log('[INFO]: WebSocket connection closed.');
            });
        });
    }

    write(audioData) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(audioData); // Send binary audio data to WebSocket server
        } else {
            console.error('[ERROR]: WebSocket is not open.');
        }
    }

    restart(params) {
        // Send a restart signal with updated configuration (e.g., new codec or language)
        const restartMessage = {
            type: 'restart',
            params
        };
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(restartMessage));
        }
    }

    end() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

module.exports = WebSocketProvider;
