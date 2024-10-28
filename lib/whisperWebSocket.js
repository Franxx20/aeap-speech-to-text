const socket = new WebSocket('ws://localhost:9099');

socket.addEventListener('message', (data) => {

})

socket.addEventListener('open', (data) => {})

socket.addEventListener('close', (data) => {})

socket.addEventListener('error', (data) => {})


function getWhisperProvider(){
    return new WebSocket('ws://localhost:9099');
}

