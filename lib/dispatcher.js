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
const {SpeechProcessor} = require("./speechProcessor");
const crypto = require("crypto");

function handleError(e, msg) {
    msg.error_msg = e.message;
}

function sendMessage(speech, msg) {
    speech.asterisk.send(JSON.stringify(msg));
}

function sendSetRequest(speech, params) {
   const request = {
        request: "set",
        id: randomUUID(),
        params,
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
            params.results = speech.whisper.results.splice(0);
        } else {
            console.warn("Ignoring unsupported parameter '" + k + "' in '" +
                request.request + "' request");
        }
    }

    response.params = params;
}

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
            console.warn("Ignoring unsupported parameter '" + k + "' in '" +
                request.request + "' request");
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

    if (response.codecs || response.params) {
        // Start/Restart whisper if any parameters were changed
        // speech.whisper.restart({
        //     codec: speech.codecs.selected,
        //     language: speech.languages.selected,
        // });
    }
}

function handleRequest(speech, msg) {
    const handlers = {
        "get": handleGetRequest,
        "set": handleSetRequest,
        "setup": handleSetRequest,
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
 * a connected asterisk and speech whisper.
 *
 * @param {Object} speech - speech object
 * @param {Codecs} speech.codecs - allowed codec(s)
 * @param {Languages} speech.languages - allowed language(s)
 * @param {WebSocket} speech.asterisk - remote connection
 * @param {WebSocket} speech.whisper - speech whisper
 */
const speechProcessor = new SpeechProcessor()
function dispatch(speech) {

    speech.asterisk.on("close", () => {
        console.log('closing whisper and asterisk')
        speech.whisper.close()
    });

    speech.asterisk.on("message", (data, isBinary) => {
        if (isBinary) {
            speech.whisper.send(data)
            return;
        }


        let msg = JSON.parse(data);

        console.debug("message: " + data);


        if (msg.hasOwnProperty('request')) {
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

    speech.whisper.on('message', (data) => {
        // console.log(data)
        speechProcessor.handleMessage(data)
    })

    speech.whisper.on("open", (event) => {
        const data = {
            uid: crypto.randomUUID(),
            language: 'en_US',
            task: 'transcribe',
            model: 'tiny.en',
            use_vad: true
        }
        console.log('[INFO]: Opened connection')
        speech.whisper.send(JSON.stringify(data))
    })

    speech.whisper.on("close", (close_status_code, close_msg) => {
        console.log('[INFO]: Close connection %s : %s', close_msg, close_status_code)
    })

    speech.whisper.on('error', (err) => {
        console.log('[INFO]: Error connection %s : %s', err, err.stack)
    })
    speech.whisper.on("result", (result) => {
        // console.log('result ', result)
        sendSetRequest(speech, {results: [result]});
    });
    // speech.whisper.on('open',()=>{
    //
    // })

}

module.exports = {
    dispatch,
}
