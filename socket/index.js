const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { pubClient, subClient } = require('../config/redis');
const presenceHandler = require('./handlers/presence.handler');
const messageHandler = require('./handlers/message.handler');

const initSocket = (server) => {
    const allowedOrigins = [
        'https://chat-app-frontend-nine-sage.vercel.app',
        'http://localhost:5173'
    ];

    const io = new Server(server, {
        cors: {
            origin: allowedOrigins,
            methods: ['GET', 'POST'],
            credentials: true
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true,
        pingTimeout: 60000,
        pingInterval: 25000
    });

    // Redis adapter — enables multi-instance socket communication
    io.adapter(createAdapter(pubClient, subClient));
    console.log('✅ Socket.IO Redis adapter attached');

    io.on('connection', async (socket) => {
        await presenceHandler(io, socket);
        messageHandler(io, socket);
    });

    return io;
};

module.exports = initSocket;