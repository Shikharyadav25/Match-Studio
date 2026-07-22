import { WebSocketServer, WebSocket } from 'ws';
function sendJson(socket, payload) {
    if(socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload))
}

function broadcast(wss, payload){
    for(const client of wss.clients){
        if(client.readyState !== WebSocket.OPEN) continue;
        client.send(JSON.stringify(payload))
    }
}

export function attachWebSocketServer(server){
    const wss = new WebSocketServer({ server, path: '/ws', maxPayLoad: 1024 * 1024 });

    wss.on('connection', (socket) => {
        sendJson(socket, { type: 'welcome' });

        socket.on('error', console.error);
    });

    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if(ws.isAlive === false) return ws.terminate();
            ws.isAlive = false;
            ws.ping()
        });
    }, 3000);

    function broadcastMatchCreated(match){
        broadcast(wss, { type: 'match_created', data: match });
    }

    return { broadcastMatchCreated }

}

