const {Codecs} = require("./lib/codecs");
const {Languages} = require("./lib/languages");
const {getServer} = require("./lib/server");
const {dispatch} = require("./lib/dispatcher");
const {WebSocket} = require('ws');
const {randomUUID} = require("crypto");
const crypto = require('crypto');
const argv = require("yargs/yargs")(process.argv.slice(2))
    .command("$0 [options]", "Start a speech to text server", {
        port: {
            alias: "p", desc: "Port to listen on", default: 9099, type: "number", group: "Server",
        },
    })
    .strict().argv;

const codecs = new Codecs(argv);
const languages = new Languages(argv);
const server = getServer("ws", argv);

// Initialize WebSocket connection with Whisper server
const whisperWebSocket = new WebSocket('ws://transcriber:9090');
const clients = new Set(); // Track client connections

whisperWebSocket.on('open', () => {
    const initialData = {
        uid: crypto.randomUUID(), language: 'en_US', task: 'transcribe', model: 'tiny.en', use_vad: true,
    };
    console.log('Opened connection with Whisper');
    whisperWebSocket.send(JSON.stringify(initialData));
});

function sendTranscription(transcription) {
    const result = {
        text: transcription, score: Math.floor(Math.random() * 101),
    }
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            const request = {
                request: 'set', id: randomUUID(), params: {results: [result]}
            }
            client.send(JSON.stringify(request), {binary: false});
            console.log('response sent');
        }
    })

}

function handle_whisper_status_message(message) {
    const status = message.status;
    if (status === "WAIT") {
        console.info(`[INFO]: Server is full. Estimated wait time ${Math.round(message.message)} minutes.`);
    } else if (status === "ERROR") {
        console.error(`Message from Server: ${message.message}`);
    } else if (status === "WARNING") {
        console.warn(`Message from Server: ${message.message}`);
    }
}

previous_segments = null
last_max_index = -1

function processSegments(segments, is_final) {
    if (segments !== null && segments.length) {
        previous_segments = segments
    }
    let text = []

    if (is_final && previous_segments) {
        previous_segments.forEach((segment, index) => {

            if (!text.length || text[text.length - 1] !== segment.text) {
                if (index > last_max_index) {
                    text.push(segment.text)
                    last_max_index = index
                }
            }

        })

        const transcription = text.join(' ')
        console.log('final segments: ', transcription)
        sendTranscription(transcription)
    }
}

function handle_whisper_message(data) {
    const message = JSON.parse(data);

    if ('status' in message) {
        handle_whisper_status_message(message);
    } else if (message.message === "DISCONNECT") {
        console.info("[INFO]: Server disconnected due to overtime.");
    } else if (message.message === "SERVER_READY") {
        console.info(`[INFO]: Server Running`);
    } else if ("language" in message) {
        this.language = message.language;
        const langProb = 'en_US';
        console.info(`[INFO]: Server detected language ${this.language} with probability ${langProb}`);
    } else if ("segments" in message) {
        processSegments(message.segments, message.is_final);
    }
}


whisperWebSocket.on('message', (transcription) => handle_whisper_message(transcription));
whisperWebSocket.on('close', (close_status_code, close_msg) => console.log('[INFO]: Closed connection to Whisper server', close_msg, close_status_code));
whisperWebSocket.on('error', (err) => console.error('[ERROR]: Whisper connection failed', err.message));

// Handle new client connections to your server
server.on("connection", async (client) => {
    console.log('Client connected');
    clients.add(client);

    client.on("close", () => {
        clients.delete(client);
    });

    await dispatch({
        codecs: codecs, languages: languages, transport: client, provider: whisperWebSocket
    });
});

function closeServer(eventName) {
    server.close(() => {
        console.log('Server closed on ' + eventName);
        process.exit(0);
    });
}

// Handle server close signals
process.on("SIGINT", () => closeServer('SIGINT'));
process.on("SIGTERM", () => closeServer('SIGTERM'));
