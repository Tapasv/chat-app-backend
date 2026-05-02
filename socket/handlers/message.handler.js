const Message = require('../../Schemas/Message');
const User = require('../../Schemas/User');
const cacheService = require('../../services/cache.service');
const notificationService = require('../../services/notification.service');
const { redis } = require('../../config/redis');

// Socket-level rate limiter — 30 messages per minute per user
const checkSocketRateLimit = async (userId) => {
    const key = `chatify:rl:socket:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    return count <= 30;
};

const messageHandler = (io, socket) => {

    socket.on('sendPrivateMessage', async (data, ack) => {
        try {
            const userId = socket.handshake.auth.userid?.toString();

            // Check socket rate limit
            const allowed = await checkSocketRateLimit(userId);
            if (!allowed) {
                if (ack) ack({ status: 'error', message: 'You are sending messages too fast' });
                socket.emit('rateLimitExceeded', { message: 'Slow down — too many messages' });
                return;
            }

            const sender = await User.findById(data.sender);
            const receiver = await User.findById(data.receiver);

            if (!sender || !receiver) {
                if (ack) ack({ status: 'error', message: 'User not found' });
                return;
            }

            const isFriend = sender.friends.some(
                id => id.toString() === data.receiver.toString()
            );
            if (!isFriend) {
                if (ack) ack({ status: 'error', message: 'Not friends' });
                return;
            }

            const newMsg = await Message.create({
                sender: data.sender,
                receiver: data.receiver,
                text: data.text
            });

            const populated = await Message.findById(newMsg._id)
                .populate('sender', 'Username profilePicture')
                .populate('receiver', 'Username profilePicture');

            await cacheService.invalidateConversation(
                data.sender.toString(),
                data.receiver.toString()
            );

            const receiverSocketId = await cacheService.getSocketId(data.receiver.toString());

            if (receiverSocketId) {
                io.to(receiverSocketId).emit('receivePrivateMessage', populated);
                io.to(receiverSocketId).emit('newMessageNotification', {
                    sender: {
                        _id: sender._id,
                        Username: sender.Username,
                        profilePicture: sender.profilePicture
                    },
                    message: data.text,
                    timestamp: new Date()
                });
            } else {
                await cacheService.addPendingNotification(data.receiver.toString(), {
                    sender: {
                        _id: sender._id,
                        Username: sender.Username,
                        profilePicture: sender.profilePicture
                    },
                    message: data.text,
                    timestamp: new Date()
                });

                await notificationService.queueOfflineMessageNotification({
                    receiverId: data.receiver.toString(),
                    senderUsername: sender.Username,
                    messageText: data.text,
                    timestamp: new Date()
                });
            }

            socket.emit('receivePrivateMessage', populated);
            if (ack) ack({ status: 'delivered', messageId: newMsg._id });

        } catch (err) {
            console.error('❌ sendPrivateMessage error:', err.message);
            if (ack) ack({ status: 'error', message: 'Message failed to send' });
        }
    });

    socket.on('TypingPrivate', async ({ username, receiver }) => {
        const receiverSocketId = await cacheService.getSocketId(receiver?.toString());
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('UserTypingPrivate', {
                username,
                senderId: socket.handshake.auth.userid
            });
        }
    });

    socket.on('StopTypingPrivate', async ({ username, receiver }) => {
        const receiverSocketId = await cacheService.getSocketId(receiver?.toString());
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('UserStopTypingPrivate', {
                username,
                senderId: socket.handshake.auth.userid
            });
        }
    });
};

module.exports = messageHandler;