const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
};

// Create an HTTP server
const server = http.createServer((req, res) => {
    console.log(`HTTP request: ${req.method} ${req.url}`);
    // Serve the index.html file
    if (req.method === 'GET') {
        let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
        let extname = String(path.extname(filePath)).toLowerCase();
        let contentType = mimeTypes[extname] || 'application/octet-stream';

        fs.readFile(filePath, (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    res.writeHead(404);
                    res.end('Not Found');
                } else {
                    console.error('Error loading file:', err);
                    res.writeHead(500);
                    res.end('Error loading file');
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data);
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

// Create a WebSocket server
const wss = new WebSocket.Server({ server });

let rooms = {};

wss.on('connection', (ws) => {
    console.log('New WebSocket connection');

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        switch (data.type) {
            case 'createRoom':
                const roomId = generateRoomId();
                rooms[roomId] = [ws];
                ws.send(JSON.stringify({ type: 'roomCreated', roomId }));
                break;
            case 'joinRoom':
                if (rooms[data.roomId]) {
                    rooms[data.roomId].push(ws);
                    ws.send(JSON.stringify({ type: 'roomJoined', roomId: data.roomId }));
                    rooms[data.roomId].forEach(client => {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({ type: 'playerJoined', roomId: data.roomId }));
                        }
                    });
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
                }
                break;
            case 'move':
                if (rooms[data.roomId]) {
                    rooms[data.roomId].forEach(client => {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({ type: 'move', cellIndex: data.cellIndex, symbol: data.symbol }));
                        }
                    });
                }
                break;
        }
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
        for (const roomId in rooms) {
            rooms[roomId] = rooms[roomId].filter(client => client !== ws);
            if (rooms[roomId].length === 0) {
                delete rooms[roomId];
            }
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

function generateRoomId() {
    return Math.random().toString(36).substr(2, 9);
}

// Start the HTTP server on port 8080
server.listen(8080, () => {
    console.log('Server is listening on port 8080');
});