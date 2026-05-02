const userRepository = require('../repositories/user.repository');
const friendRepository = require('../repositories/friend.repository');
const ApiError = require('../utils/ApiError');

const friendService = {

    searchUsers: async (query, currentUserId) => {
        if (!query || !query.trim()) throw new ApiError(400, 'Search query is required');
        return userRepository.searchByUsername(query.trim(), currentUserId);
    },

    sendRequest: async (senderId, receiverId) => {
        if (senderId === receiverId) {
            throw new ApiError(400, 'You cannot send a request to yourself');
        }

        const sender = await userRepository.findByIdFull(senderId);
        if (!sender) throw new ApiError(404, 'Sender not found');

        const alreadyFriends = sender.friends.some(id => id.toString() === receiverId);
        if (alreadyFriends) throw new ApiError(400, 'Already friends');

        const existing = await friendRepository.findPendingRequest(senderId, receiverId);
        if (existing) throw new ApiError(400, 'Friend request already sent');

        const request = await friendRepository.create(senderId, receiverId);
        const populated = await friendRepository.findByIdPopulated(request._id);

        return { request: populated, receiverId };
    },

    acceptRequest: async (requestId, currentUserId) => {
        const request = await friendRepository.findById(requestId);
        if (!request) throw new ApiError(404, 'Request not found');

        if (request.receiver.toString() !== currentUserId) {
            throw new ApiError(403, 'Not authorized to accept this request');
        }

        request.status = 'accepted';
        await friendRepository.save(request);

        await userRepository.findByIdAndUpdate(
            request.sender,
            { $addToSet: { friends: request.receiver } }
        );
        await userRepository.findByIdAndUpdate(
            request.receiver,
            { $addToSet: { friends: request.sender } }
        );

        const acceptor = await userRepository.findById(
            request.receiver,
            '_id Username profilePicture'
        );

        return {
            acceptor,
            senderId: request.sender.toString(),
            receiverId: request.receiver.toString()
        };
    },

    rejectRequest: async (requestId, currentUserId) => {
        const request = await friendRepository.findById(requestId);
        if (!request) throw new ApiError(404, 'Request not found');

        if (request.receiver.toString() !== currentUserId) {
            throw new ApiError(403, 'Not authorized to reject this request');
        }

        const senderId = request.sender.toString();
        request.status = 'rejected';
        await friendRepository.save(request);

        return { requestId, senderId, receiverId: currentUserId };
    },

    unfriend: async (userId, friendId) => {
        await userRepository.findByIdAndUpdate(userId, { $pull: { friends: friendId } });
        await userRepository.findByIdAndUpdate(friendId, { $pull: { friends: userId } });
        return { userId, friendId };
    },

    getFriendList: async (userId) => {
        const user = await userRepository.findWithFriends(userId);
        if (!user) throw new ApiError(404, 'User not found');
        return user.friends || [];
    },

    getReceivedRequests: async (userId) => {
        return friendRepository.findReceivedPending(userId);
    },

    getSentRequests: async (userId) => {
        return friendRepository.findSentPending(userId);
    }
};

module.exports = friendService;