const messageRepository = require('../repositories/message.repository');
const userRepository = require('../repositories/user.repository');
const ApiError = require('../utils/ApiError');
const cacheService = require('./cache.service');

const EDIT_WINDOW_MS = 15 * 60 * 1000;
const DELETE_EVERYONE_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

const chatService = {

    getConversation: async (currentUserId, otherUserId) => {
        const currentUser = await userRepository.findByIdFull(currentUserId);
        const otherUser = await userRepository.findById(otherUserId);

        if (!currentUser || !otherUser) throw new ApiError(404, 'User not found');

        const areFriends = currentUser.friends.some(
            id => id.toString() === otherUserId
        );
        if (!areFriends) throw new ApiError(403, 'You can only view messages with friends');

        // Try cache first
        const cached = await cacheService.getCachedConversation(currentUserId, otherUserId);
        if (cached) {
            return cached.filter(msg => {
                if (!msg.deletedFor) return true;
                return !msg.deletedFor.some(id => id.toString() === currentUserId);
            });
        }

        // Cache miss — hit DB
        const messages = await messageRepository.findConversation(currentUserId, otherUserId);

        const filtered = messages.filter(msg => {
            if (!msg.deletedFor) return true;
            return !msg.deletedFor.some(id => id.toString() === currentUserId);
        });

        await cacheService.setCachedConversation(currentUserId, otherUserId, filtered);

        return filtered;
    },

    saveFileMessage: async ({ senderId, receiverId, file }) => {
        const sender = await userRepository.findByIdFull(senderId);
        if (!sender) throw new ApiError(404, 'Sender not found');

        const isFriend = sender.friends.some(id => id.toString() === receiverId);
        if (!isFriend) throw new ApiError(403, 'You can only send files to friends');

        const message = await messageRepository.create({
            sender: senderId,
            receiver: receiverId,
            text: `📎 ${file.originalname}`,
            fileUrl: file.path,
            fileName: file.originalname,
            fileSize: file.size,
            fileType: file.mimetype
        });

        await cacheService.invalidateConversation(senderId, receiverId);

        return messageRepository.findByIdPopulated(message._id);
    },

    editMessage: async (messageId, userId, newText) => {
        const message = await messageRepository.findById(messageId);
        if (!message) throw new ApiError(404, 'Message not found');

        if (message.sender.toString() !== userId) {
            throw new ApiError(403, 'You can only edit your own messages');
        }
        if (message.deletedForEveryone) {
            throw new ApiError(400, 'Cannot edit a deleted message');
        }

        const age = Date.now() - new Date(message.createdAt).getTime();
        if (age > EDIT_WINDOW_MS) {
            throw new ApiError(400, 'Edit window of 15 minutes has expired');
        }

        message.text = newText;
        message.isEdited = true;
        message.editedAt = new Date();
        await messageRepository.save(message);

        await cacheService.invalidateConversation(
            message.sender.toString(),
            message.receiver.toString()
        );

        const populated = await messageRepository.findByIdPopulated(message._id);

        const otherUserId = message.sender.toString() === userId
            ? message.receiver.toString()
            : message.sender.toString();

        return { message: populated, otherUserId };
    },

    deleteMessage: async (messageId, userId, deleteType) => {
        const message = await messageRepository.findById(messageId);
        if (!message) throw new ApiError(404, 'Message not found');

        if (deleteType === 'forEveryone') {
            if (message.sender.toString() !== userId) {
                throw new ApiError(403, 'Only the sender can delete for everyone');
            }

            const age = Date.now() - new Date(message.createdAt).getTime();
            if (age > DELETE_EVERYONE_WINDOW_MS) {
                throw new ApiError(400, 'Delete for everyone only available within 2 days');
            }

            message.deletedForEveryone = true;
            message.text = 'This message was deleted';
            await messageRepository.save(message);

            await cacheService.invalidateConversation(
                message.sender.toString(),
                message.receiver.toString()
            );

            const populated = await messageRepository.findByIdPopulated(message._id);
            return {
                message: populated,
                receiverId: message.receiver.toString(),
                deleteType: 'forEveryone'
            };
        }

        if (deleteType === 'forMe') {
            if (!message.deletedFor.includes(userId)) {
                message.deletedFor.push(userId);
                await messageRepository.save(message);
            }

            await cacheService.invalidateConversation(
                message.sender.toString(),
                message.receiver.toString()
            );

            return { message, deleteType: 'forMe' };
        }

        throw new ApiError(400, 'Invalid delete type. Use forEveryone or forMe');
    },

    clearChat: async (currentUserId, otherUserId) => {
        const currentUser = await userRepository.findByIdFull(currentUserId);
        const otherUser = await userRepository.findById(otherUserId);

        if (!currentUser || !otherUser) throw new ApiError(404, 'User not found');

        const areFriends = currentUser.friends.some(
            id => id.toString() === otherUserId
        );
        if (!areFriends) throw new ApiError(403, 'You can only clear chats with friends');

        const result = await messageRepository.clearChatBulk(
            currentUserId,
            otherUserId,
            currentUserId
        );

        await cacheService.invalidateConversation(currentUserId, otherUserId);

        return { clearedCount: result.modifiedCount };
    },

    blockUser: async (currentUserId, userToBlockId) => {
        if (currentUserId === userToBlockId) {
            throw new ApiError(400, 'You cannot block yourself');
        }

        const currentUser = await userRepository.findByIdFull(currentUserId);
        const userToBlock = await userRepository.findById(userToBlockId);

        if (!currentUser || !userToBlock) throw new ApiError(404, 'User not found');

        if (!currentUser.blockedUsers) currentUser.blockedUsers = [];

        const alreadyBlocked = currentUser.blockedUsers.some(
            id => id.toString() === userToBlockId
        );
        if (alreadyBlocked) throw new ApiError(400, 'User is already blocked');

        currentUser.blockedUsers.push(userToBlockId);
        await userRepository.save(currentUser);

        return {
            blockedUser: { _id: userToBlock._id, Username: userToBlock.Username }
        };
    },

    unblockUser: async (currentUserId, userToUnblockId) => {
        const currentUser = await userRepository.findByIdFull(currentUserId);
        if (!currentUser) throw new ApiError(404, 'User not found');

        const isBlocked = currentUser.blockedUsers?.some(
            id => id.toString() === userToUnblockId
        );
        if (!isBlocked) throw new ApiError(400, 'User is not blocked');

        currentUser.blockedUsers = currentUser.blockedUsers.filter(
            id => id.toString() !== userToUnblockId
        );
        await userRepository.save(currentUser);

        return { message: 'User unblocked successfully' };
    },

    getBlockedUsers: async (userId) => {
        const user = await userRepository.findByIdFull(userId);
        if (!user) throw new ApiError(404, 'User not found');
        return user.blockedUsers || [];
    },

    getConversationPaginated: async (currentUserId, otherUserId, page, limit) => {
        const currentUser = await userRepository.findByIdFull(currentUserId);
        if (!currentUser) throw new ApiError(404, 'User not found');

        const areFriends = currentUser.friends.some(
            id => id.toString() === otherUserId
        );
        if (!areFriends) throw new ApiError(403, 'You can only view messages with friends');

        const [messages, total] = await Promise.all([
            messageRepository.findConversationPaginated(currentUserId, otherUserId, page, limit),
            messageRepository.countConversation(currentUserId, otherUserId)
        ]);

        // Filter deleted messages and reverse to chronological order
        const filtered = messages
            .filter(msg => {
                if (!msg.deletedFor) return true;
                return !msg.deletedFor.some(id => id.toString() === currentUserId);
            })
            .reverse();

        return {
            messages: filtered,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total
            }
        };
    },
};

module.exports = chatService;