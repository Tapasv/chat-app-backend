const Message = require('../Schemas/Message');

const messageRepository = {

    create: (messageData) => {
        return Message.create(messageData);
    },

    findById: (id) => {
        return Message.findById(id);
    },

    findByIdPopulated: (id) => {
        return Message.findById(id)
            .populate('sender', 'Username profilePicture')
            .populate('receiver', 'Username profilePicture');
    },

    findConversation: (userAId, userBId) => {
        return Message.find({
            $or: [
                { sender: userAId, receiver: userBId },
                { sender: userBId, receiver: userAId }
            ]
        })
            .populate('sender', 'Username profilePicture')
            .populate('receiver', 'Username profilePicture')
            .sort({ createdAt: 1 });
    },

    // Paginated version — used for large conversations
    findConversationPaginated: (userAId, userBId, page = 1, limit = 50) => {
        const skip = (page - 1) * limit;
        return Message.find({
            $or: [
                { sender: userAId, receiver: userBId },
                { sender: userBId, receiver: userAId }
            ]
        })
            .populate('sender', 'Username profilePicture')
            .populate('receiver', 'Username profilePicture')
            .sort({ createdAt: -1 }) // newest first
            .skip(skip)
            .limit(limit);
    },

    countConversation: (userAId, userBId) => {
        return Message.countDocuments({
            $or: [
                { sender: userAId, receiver: userBId },
                { sender: userBId, receiver: userAId }
            ]
        });
    },

    save: (messageDocument) => {
        return messageDocument.save();
    },

    clearChatBulk: (userAId, userBId, requestingUserId) => {
        return Message.updateMany(
            {
                $or: [
                    { sender: userAId, receiver: userBId },
                    { sender: userBId, receiver: userAId }
                ],
                deletedFor: { $ne: requestingUserId }
            },
            { $push: { deletedFor: requestingUserId } }
        );
    },

    deleteById: (id) => {
        return Message.findByIdAndDelete(id);
    }
};

module.exports = messageRepository;