const FriendRequest = require('../Schemas/FriendRequest');

const friendRepository = {

    findById: (id) => {
        return FriendRequest.findById(id);
    },

    findPendingRequest: (senderId, receiverId) => {
        return FriendRequest.findOne({
            sender: senderId,
            receiver: receiverId,
            status: 'pending'
        });
    },

    create: (senderId, receiverId) => {
        return FriendRequest.create({ sender: senderId, receiver: receiverId });
    },

    findByIdPopulated: (id) => {
        return FriendRequest.findById(id)
            .populate('sender', 'Username profilePicture')
            .populate('receiver', 'Username profilePicture');
    },

    findReceivedPending: (userId) => {
        return FriendRequest.find({ receiver: userId, status: 'pending' })
            .populate('sender', 'Username profilePicture')
            .sort({ createdAt: -1 });
    },

    findSentPending: (userId) => {
        return FriendRequest.find({ sender: userId, status: 'pending' })
            .populate('receiver', 'Username profilePicture')
            .sort({ createdAt: -1 });
    },

    save: (requestDocument) => {
        return requestDocument.save();
    }
};

module.exports = friendRepository;