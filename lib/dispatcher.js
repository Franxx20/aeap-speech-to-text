/*

 *  Copyright 2022 Sangoma Technologies Corporation
 *  Kevin Harwell <kharwell@sangoma.com>
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

const {randomUUID} = require('crypto');
const {WebSocket} = require('ws')
const {TranscriptProcessor} = require("./transcriptProcessor");

function handleError(e, msg) {
    msg.error_msg = e.message;
}

function sendMessage(speech, msg) {
    speech.transport.send(JSON.stringify(msg), {binary: false});
}

function sendSetRequest(speech, params) {
    request = {
        request: "set", id: randomUUID(), params,
    };
    console.log('request: ', request)

    sendMessage(speech, request);
}

function handleGetRequest(speech, request, response) {
    if (!request.params) {
        throw new Error("Missing request parameters");
    }

    let params = {};

    for (let p of request.params) {
        if (p === "codec") {
            params.codecs = speech.codecs.selected;
        } else if (p === "language") {
            params.language = speech.languages.selected;
        } else if (p === "results") {
            params.results = speech.provider.results.splice(0);
        } else {
            console.warn("Ignoring unsupported parameter '" + k + "' in '" + request.request + "' request");
        }
    }

    response.params = params;
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

// const transcriptProcessor = new TranscriptProcessor((text, isFinal) => {
//     // console.log("Processed Text:", text);
//     if (isFinal) {
//         console.log("Final Segment Received.");
//         console.log('text: ', text)
//     }
// }, "faster_whisper");


previous_segments = null

function processSegments(segments, is_final) {
    if (segments !== null) {
        previous_segments = segments
    }
    let text = []

    if (is_final) {

        previous_segments.forEach((segment, index) => {

            if (!text.length || text[text.length - 1] !== segment.text) {
                text.push(segment.text)
            }

        })

        // console.log('final segments: ', previous_segments[previous_segments.length - 1].text)}
        console.log('final segments: ', text.join(' '))
    }


}

function handle_whisper_message(data) {
    const message = JSON.parse(data);
    // console.log(message);

    if ('status' in message) {
        handle_whisper_status_message(message);
        return;
    }

    if (message.message === "DISCONNECT") {
        console.info("[INFO]: Server disconnected due to overtime.");
    }

    if (message.message === "SERVER_READY") {
        console.info(`[INFO]: Server Running`);
    }

    if ("language" in message) {
        this.language = message.language;
        const langProb = 'en_US';
        console.info(`[INFO]: Server detected language ${this.language} with probability ${langProb}`);
    }

    // console.log(typeof message.is_final, message.is_final)

    if ("segments" in message) {

        processSegments(message.segments, message.is_final);
        // transcriptProcessor.processSegments(message.segments,message.is_final)
    }
}


// let lastProcessedSegments = [];

// function processSegments(segments, isFinal) {
//     // if (segments?.length > 0) {
//     //     // Find the starting point of new segments
//     //     let lastIndex = 0;
//     //     while (
//     //         lastIndex < segments.length &&
//     //         lastProcessedSegments.includes(segments[lastIndex].text)
//     //         ) {
//     //         lastIndex++;
//     //     }
//     //
//     //     // Print only new segments
//     //     for (let i = lastIndex; i < segments.length; i++) {
//     //         console.log(segments[i].text);
//     //     }
//     //
//     //     // Update lastProcessedSegments to the latest received batch
//     //     lastProcessedSegments = segments.map(seg => seg.text);
//     // }
//     //
//     // if (isFinal === true) {
//     //     console.log("Final accumulated segments:", lastProcessedSegments);
//     //     lastProcessedSegments = []; // Reset for next sentence if needed
//     // }
// }


function handleSetRequest(speech, request, response) {
    if (!request.codecs || !request.params) {
        throw new Error("Missing request parameters");
    }

    /*
     * It's all or nothing for an incoming set request. So first validate
     * all values, then set newly selected, and lastly set the response.
     */
    let codec = null;
    let params = {};

    if (request.codecs) {
        codec = speech.codecs.first(request.codecs);
    }

    for (let [k, v] of Object.entries(request.params)) {
        if (k === "language") {
            params.language = speech.languages.first(v);
        } else {
            console.warn("Ignoring unsupported parameter '" + k + "' in '" + request.request + "' request");
        }
    }

    if (codec) {
        response.codecs = [speech.codecs.selected = codec];
    }

    if (Object.keys(params).length) {
        if (params.language) {
            speech.languages.selected = params.language;
        }

        response.params = params;
    }
}

function handleRequest(speech, msg) {
    const handlers = {
        "get": handleGetRequest, "set": handleSetRequest, "setup": handleSetRequest,
    };

    let response = {response: msg.request, id: msg.id};

    try {
        console.info(msg)
        handlers[msg.request](speech, msg, response);
    } catch (e) {
        handleError(e, response);
    }

    return response;
}

function handleResponse(speech, msg) {
    return null; // TODO
}

/**
 * Manages configuration, communication, messaging, and data between
 * a connected transport and speech provider.
 *
 * @param {Object} speech - speech object
 * @param {Object} speech.codecs - allowed codec(s)
 * @param {Object} speech.languages - allowed language(s)
 * @param {Object} speech.transport - remote connection
 * @param {WebSocket} speech.provider - speech provider
 */

let buffer = Buffer.alloc(0);

async function dispatch(speech) {
    speech.transport.on("close", () => {
        console.log('closing provider')
        speech.provider.close();
    });

    speech.transport.on("message", (data, isBinary) => {
        if (isBinary) {
            // const data_dec = alawmulaw.mulaw.decode(data)
            // buffer = Buffer.concat([buffer, Buffer.from(data_dec)])
            buffer = Buffer.concat([buffer, Buffer.from(data)])
            //
            // // 16384
            // // 8192
            // // 4096
            // // 2048
            // // 1024
            // // 4800?
            while (buffer.length >= 8192) {
                const chunk = buffer.slice(0, 8192)
                buffer = buffer.slice(8192)
                speech.provider.send(chunk, {binary: true})
                // console.log('chunk send')
            }
            // console.log('data size: ' + data_dec.length)
            // speech.provider.send(data, {binary: true})

            return;
        }

        let msg = JSON.parse(data);

        // console.debug("message: " + data);

        if (msg.hasOwnProperty('request')) {
            console.log('message request received: ' + data)
            msg = handleRequest(speech, msg);
            // console.log('request ', msg)
        } else if (msg.hasOwnProperty('response')) {
            msg = handleResponse(speech, msg);
            // console.log('response ', msg)
        } else {
            msg = null;
        }

        if (msg) {
            sendMessage(speech, msg);
            // console.log('message send' +
            //     speech, msg)
        }
    });

    // speech.provider.on("result", (result) => {
    //     // console.log('result ', result)
    //     sendSetRequest(speech, {results: [result]});
    // });


}

// function dispatch(speech) {
//
//     // speech.transport.on("close", () => {
//     //     console.log('closing provider')
//     //     speech.provider.end();
//     // });
//     speech.provider.connect('ws://127.0.0.1:9090')
//
//     speech.provider.on('connectFailed', (error) => {
//         console.log('Connect error: ' + error.toString())
//     })
//
//     speech.provider.on('connect', (connection) => {
//         console.log('websocket whisper connection established.');
//
//         const data = {
//             uid: crypto.randomUUID(),
//             language: 'en_US',
//             task: 'transcribe',
//             model: 'tiny.en',
//             usa_vad: true
//         }
//
//         console.log('opened connection with whisper')
//         connection.send(JSON.stringify(data));
//
//         connection.on('error', function (error) {
//             console.log("Connection Error: " + error.toString());
//         });
//         connection.on('close', function () {
//             console.log('echo-protocol Connection Closed');
//         });
//
//         connection.on('message', function (data) {
//             if (data.type === 'utf8') {
//                 console.log("Received: '" + data.utf8Data + "'");
//             }
//             if (data.type === 'binary') {
//                 // console.log(data)
//                 connection.send(data)
//                 return
//             }
//
//             let msg = JSON.parse(data.utf8Data);
//
//             console.log('message '+ msg)
//
//
//             if (msg.hasOwnProperty('request')) {
//                 msg = handleRequest(speech, msg);
//                 // console.log('request ', msg)
//             } else if (msg.hasOwnProperty('response')) {
//                 msg = handleResponse(speech, msg);
//                 // console.log('response ', msg)
//             } else {
//                 msg = null;
//             }
//
//             if (msg) {
//                 sendMessage(speech, msg);
//                 // console.log('message send' +
//                 //     speech, msg)
//             }
//             ``
//         });
//
//     })
//
// speech.transport.on("message", (data, isBinary) => {
//     // console.log("isBinary: ",isBinary)
//     if (isBinary) {
//         speech.provider.send(data);
//         return;
//     }
//
//
//     let msg = JSON.parse(data);
//
//     // console.debug("message: " + data);
//
//
//     if (msg.hasOwnProperty('request')) {
//         msg = handleRequest(speech, msg);
//         // console.log('request ', msg)
//     } else if (msg.hasOwnProperty('response')) {
//         msg = handleResponse(speech, msg);
//         // console.log('response ', msg)
//     } else {
//         msg = null;
//     }
//
//     if (msg) {
//         sendMessage(speech, msg);
//         // console.log('message send' +
//         //     speech, msg)
//     }
// });

// speech.provider.on("message", (result) => {
//     console.log('result ', result)
//     sendSetRequest(speech, {results: [result]});
// });

// speech.provider.on('open', (event) => {
//     // const data = {
//     //     uid: crypto.randomUUID(),
//     //     language: 'en_US',
//     //     task: 'transcribe',
//     //     model: 'tiny.en',
//     //     usa_vad: true
//     // }
//     //
//     // console.log('opened connection with whisper')
//     // speech.provider.send(JSON.stringify(data));
// })

// speech.provider.on('close', (close_status_code, close_msg) => {
//     console.log('[INFO]: Close connection whisper %s : %s', close_msg, close_status_code)
// })
//
// speech.provider.on('error', (err) => {
//     console.log('[INFO]: Error connection whisper %s : %s', err, err.stack)
// })
//
// }


module.exports = {
    dispatch, handle_whisper_message, handle_whisper_status_message,
}
