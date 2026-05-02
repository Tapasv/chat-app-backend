const chatService = require('../services/chat.service');
const ApiResponse = require('../utils/ApiResponse');
const cacheService = require('../services/cache.service');

const chatController = {

    getConversation: async (req, res, next) => {
        try {
            const messages = await chatService.getConversation(
                req.userID,
                req.params.userId
            );
            res.status(200).json(new ApiResponse(200, messages, 'Messages fetched'));
        } catch (err) {
            next(err);
        }
    },

    uploadFile: async (req, res, next) => {
        try {
            const { receiver } = req.body;
            const message = await chatService.saveFileMessage({
                senderId: req.userID,
                receiverId: receiver,
                file: req.file
            });

            const io = req.app.get('socketio');

            const receiverSocketId = await cacheService.getSocketId(receiver.toString());
            const senderSocketId = await cacheService.getSocketId(req.userID.toString());

            if (receiverSocketId) io.to(receiverSocketId).emit('receivePrivateMessage', message);
            if (senderSocketId) io.to(senderSocketId).emit('receivePrivateMessage', message);

            res.status(200).json(new ApiResponse(200, message, 'File uploaded successfully'));
        } catch (err) {
            next(err);
        }
    },

    editMessage: async (req, res, next) => {
        try {
            const { messageId } = req.params;
            const { content, text } = req.body;

            const { message, otherUserId } = await chatService.editMessage(
                messageId,
                req.userID,
                content || text
            );

            const io = req.app.get('socketio');
            const otherSocketId = await cacheService.getSocketId(otherUserId);

            if (otherSocketId) {
                io.to(otherSocketId).emit('messageEdited', {
                    messageId: message._id,
                    text: message.text,
                    isEdited: true
                });
            }

            res.status(200).json(new ApiResponse(200, message, 'Message edited successfully'));
        } catch (err) {
            next(err);
        }
    },

    deleteMessage: async (req, res, next) => {
        try {
            const { messageId } = req.params;
            const { deleteType } = req.body;

            const result = await chatService.deleteMessage(messageId, req.userID, deleteType);

            if (result.deleteType === 'forEveryone') {
                const io = req.app.get('socketio');
                const receiverSocketId = await cacheService.getSocketId(result.receiverId);

                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('messageDeleted', {
                        messageId: result.message._id,
                        deletedForEveryone: true
                    });
                }
            }

            res.status(200).json(new ApiResponse(200, result.message, 'Message deleted'));
        } catch (err) {
            next(err);
        }
    },

    clearChat: async (req, res, next) => {
        try {
            const result = await chatService.clearChat(req.userID, req.params.userId);
            res.status(200).json(new ApiResponse(200, result, 'Chat cleared successfully'));
        } catch (err) {
            next(err);
        }
    },

    blockUser: async (req, res, next) => {
        try {
            const result = await chatService.blockUser(req.userID, req.params.userId);
            res.status(200).json(new ApiResponse(200, result, 'User blocked successfully'));
        } catch (err) {
            next(err);
        }
    },

    unblockUser: async (req, res, next) => {
        try {
            const result = await chatService.unblockUser(req.userID, req.params.userId);
            res.status(200).json(new ApiResponse(200, result, result.message));
        } catch (err) {
            next(err);
        }
    },

    getBlockedUsers: async (req, res, next) => {
        try {
            const blockedUsers = await chatService.getBlockedUsers(req.userID);
            res.status(200).json(new ApiResponse(200, blockedUsers, 'Blocked users fetched'));
        } catch (err) {
            next(err);
        }
    },

    getConversationPaginated: async (req, res, next) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;

            const result = await chatService.getConversationPaginated(
                req.userID,
                req.params.userId,
                page,
                limit
            );

            res.status(200).json(new ApiResponse(200, result, 'Messages fetched'));
        } catch (err) {
            next(err);
        }
    },
};

module.exports = chatController;