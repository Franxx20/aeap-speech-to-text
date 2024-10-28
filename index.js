const WebSocket = require('ws');
const {Codecs} = require("./lib/codecs");
const {Languages} = require("./lib/languages");
const {getServer} = require("./lib/server");
const {dispatch} = require("./lib/dispatcher");
const argv = require("yargs/yargs")(process.argv.slice(2))
    .command("$0 [options]", "Start a speech-to-text server", {
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

server.on("connection", (client) => {
    console.log("[INFO] New client connected.");

    // Create a unique whisper for each client
    const provider = new WebSocket('ws://0.0.0.0:9090');

    // Dispatch with client and its specific whisper
    dispatch({
        codecs: codecs,
        languages: languages,
        asterisk: client,
        whisper: provider,
    });
});

process.on("SIGINT", () => {
    console.log("[INFO] Server shutting down...");
    server.close();
    process.exit(0);
});

process.on("SIGTERM", () => {
    console.log("[INFO] Server terminating...");
    server.close();
    process.exit(0);
});
