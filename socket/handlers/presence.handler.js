const cacheService = require('../../services/cache.service');

const presenceHandler = async (io, socket) => {
    const userID = socket.handshake.auth.userid?.toString();
    const Username = socket.handshake.auth.Username || 'Anonymous';

    if (userID) {
        // Update socket ID in Redis — handles reconnection automatically
        await cacheService.setUserOnline(userID, socket.id);

        // Deliver any notifications that arrived while offline
        const pending = await cacheService.getPendingNotifications(userID);
        if (pending.length > 0) {
            pending.forEach(notif => socket.emit('newMessageNotification', notif));
            await cacheService.clearPendingNotifications(userID);
        }

        console.log(`✅ Connected: ${Username} (${userID}) socket: ${socket.id}`);
    }

    const onlineUsers = await cacheService.getAllOnlineUsers();
    io.emit('onlineUsers', onlineUsers);

    socket.on('requestOnlineUsers', async () => {
        const onlineUsers = await cacheService.getAllOnlineUsers();
        socket.emit('onlineUsers', onlineUsers);
    });

    // Heartbeat — client can ping to confirm connection is alive
    socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
    });

    socket.on('disconnect', async (reason) => {
        if (userID) {
            await cacheService.setUserOffline(userID);
            console.log(`❌ Disconnected: ${Username} — reason: ${reason}`);
        }
        const onlineUsers = await cacheService.getAllOnlineUsers();
        io.emit('onlineUsers', onlineUsers);
    });
};

module.exports = presenceHandler;