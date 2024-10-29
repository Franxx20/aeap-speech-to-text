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
            alias: "p",
            desc: "Port to listen on",
            default: 9099,
            type: "number",
            group: "Server",
        },
    })
    .strict()
    .argv;

const codecs = new Codecs(argv);
const languages = new Languages(argv);
const server = getServer("ws", argv);

// Initialize WebSocket connection with Whisper server
const whisperWebSocket = new WebSocket('ws://127.0.0.1:9090');
console.log(whisperWebSocket)

const clients = new Set();

whisperWebSocket.on('open', () => {
    const data = {
        uid: crypto.randomUUID(),
        language: 'en_US',
        task: 'transcribe',
        model: 'tiny.en',
        use_vad: true,
    };
    console.log('Opened connection with Whisper');
    whisperWebSocket.send(JSON.stringify(data));
});

// whisperWebSocket.on('message', (transcription) => {
//     // message = transcription.toString()
//     json_message = JSON.parse(transcription)
//     console.log('Received transcription:', json_message);
//
//     clients.forEach(client => {
//         if (client.readyState === WebSocket.OPEN) {
//             data = {
//                 text: '',
//                 score: 0
//
//             }
//             result = {
//                 results: [json_message.text]
//             }
//             request = {
//                 request: 'set',
//                 id: randomUUID(),
//                 result
//             }
//             console.log('enviando respuesta')
//             console.log(request)
//             client.send(JSON.stringify(transcription), {binary: false});
//         }
//     });
// });

whisperWebSocket.on('message', (transcription) => {
    const json_message = JSON.parse(transcription);
    console.log('Received transcription:', json_message);

    const results = [{
        text: json_message.segments,
        score: Math.floor(Math.random() * 101)
    }]

    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            // Build the request message
            const request = {
                request: 'set',
                id: randomUUID(),
                params: {results}
            };

            console.log('Sending response:', request);
            client.send(JSON.stringify(request), {binary: false});
            console.log('response send')
        }
    });
});

whisperWebSocket.on('close', (close_status_code, close_msg) => {
    console.log('[INFO]: Closed connection to Whisper server', close_msg, close_status_code);
});

whisperWebSocket.on('error', (err) => {
    console.error('[ERROR]: Whisper connection failed', err.message);
});

// Handle new client connections to your server
server.on("connection", async (client) => {
    console.log('Client connected');
    clients.add(client);

    client.on("close", () => {
        clients.delete(client);
    });

    await dispatch({
        codecs: codecs,
        languages: languages,
        transport: client,
        provider: whisperWebSocket
    });
});

// Handle server close signals
process.on("SIGINT", () => {
    server.close(() => {
        console.log('Server closed on SIGINT');
        process.exit(0);
    });
});

process.on("SIGTERM", () => {
    server.close(() => {
        console.log('Server closed on SIGTERM');
        process.exit(0);
    });
});
