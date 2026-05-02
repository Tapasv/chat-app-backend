const friendService = require('../services/friend.service');
const ApiResponse = require('../utils/ApiResponse');
const cacheService = require('../services/cache.service');
const notificationService = require('../services/notification.service');
const userRepository = require('../repositories/user.repository');

const friendController = {

    searchUsers: async (req, res, next) => {
        try {
            const users = await friendService.searchUsers(req.query.q, req.userID);
            res.status(200).json(new ApiResponse(200, users, 'Users found'));
        } catch (err) {
            next(err);
        }
    },

    sendRequest: async (req, res, next) => {
        try {
            const { request, receiverId } = await friendService.sendRequest(
                req.userID,
                req.params.receiverId
            );

            const io = req.app.get('socketio');
            const receiverSocketId = await cacheService.getSocketId(receiverId);

            if (receiverSocketId) {
                io.to(receiverSocketId).emit('friendRequestReceived', request);
            }

            // Queue email notification as background job
            const sender = await userRepository.findById(req.userID, 'Username');
            await notificationService.queueFriendRequestNotification({
                receiverId,
                senderUsername: sender.Username
            });

            res.status(200).json(new ApiResponse(200, request, 'Friend request sent'));
        } catch (err) {
            next(err);
        }
    },

    acceptRequest: async (req, res, next) => {
        try {
            const { acceptor, senderId, receiverId } = await friendService.acceptRequest(
                req.params.requestId,
                req.userID
            );

            const io = req.app.get('socketio');

            const senderSocketId = await cacheService.getSocketId(senderId);
            const receiverSocketId = await cacheService.getSocketId(receiverId);
            const onlineUsers = await cacheService.getAllOnlineUsers();

            if (senderSocketId) {
                io.to(senderSocketId).emit('friendRequestAccepted', acceptor);
                io.to(senderSocketId).emit('onlineUsers', onlineUsers);
            }
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('onlineUsers', onlineUsers);
            }

            res.status(200).json(new ApiResponse(200, acceptor, 'Friend request accepted'));
        } catch (err) {
            next(err);
        }
    },

    rejectRequest: async (req, res, next) => {
        try {
            const result = await friendService.rejectRequest(
                req.params.requestId,
                req.userID
            );

            const io = req.app.get('socketio');
            const senderSocketId = await cacheService.getSocketId(result.senderId);

            if (senderSocketId) {
                io.to(senderSocketId).emit('friendRequestRejected', {
                    requestId: result.requestId,
                    receiverId: result.receiverId
                });
            }

            res.status(200).json(new ApiResponse(200, result, 'Friend request rejected'));
        } catch (err) {
            next(err);
        }
    },

    unfriend: async (req, res, next) => {
        try {
            const result = await friendService.unfriend(req.userID, req.params.friendId);

            const io = req.app.get('socketio');
            const friendSocketId = await cacheService.getSocketId(result.friendId);

            if (friendSocketId) {
                io.to(friendSocketId).emit('friendRemoved', { userId: result.userId });
            }

            res.status(200).json(new ApiResponse(200, result, 'Friend removed'));
        } catch (err) {
            next(err);
        }
    },

    getFriendList: async (req, res, next) => {
        try {
            const friends = await friendService.getFriendList(req.userID);
            res.status(200).json(new ApiResponse(200, friends, 'Friends fetched'));
        } catch (err) {
            next(err);
        }
    },

    getReceivedRequests: async (req, res, next) => {
        try {
            const requests = await friendService.getReceivedRequests(req.userID);
            res.status(200).json(new ApiResponse(200, requests, 'Received requests fetched'));
        } catch (err) {
            next(err);
        }
    },

    getSentRequests: async (req, res, next) => {
        try {
            const requests = await friendService.getSentRequests(req.userID);
            res.status(200).json(new ApiResponse(200, requests, 'Sent requests fetched'));
        } catch (err) {
            next(err);
        }
    }
};

module.exports = friendController;