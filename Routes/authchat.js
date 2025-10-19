const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { Authmiddlewhere } = require('../middlewhere/Authmiddlewhere');
const Message = require('../Schemas/Message');
const User = require('../Schemas/User');

console.log('📁 Chat routes file loaded!');

// Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, true),
});

router.get('/private/:userId', Authmiddlewhere, async (req, res) => {
    try {
        const currentUserId = req.userID;
        const otherUserId = req.params.userId;

        const currentUser = await User.findById(currentUserId);
        const otherUser = await User.findById(otherUserId);

        if (!currentUser || !otherUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const areFriends = currentUser.friends.some(
            friendId => friendId.toString() === otherUserId
        );

        if (!areFriends) {
            return res.status(403).json({ message: 'You can only view messages with friends' });
        }

        const messages = await Message.find({
            $or: [
                { sender: currentUserId, receiver: otherUserId },
                { sender: otherUserId, receiver: currentUserId }
            ]
        })
        .populate('sender', 'Username profilePicture')
        .populate('receiver', 'Username profilePicture')
        .sort({ createdAt: 1 });

        const filteredMessages = messages.filter(msg => {
            if (msg.deletedFor && msg.deletedFor.some(id => id.toString() === currentUserId)) {
                return false;
            }
            return true;
        });

        res.json(filteredMessages);
    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).json({ message: 'Error fetching messages' });
    }
});

router.post('/upload', Authmiddlewhere, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const { receiver } = req.body;
        if (!receiver) return res.status(400).json({ message: 'Receiver is required' });

        const sender = await User.findById(req.userID);
        if (!sender.friends.includes(receiver)) {
            return res.status(403).json({ message: 'You can only send files to friends' });
        }

        const messageData = {
            sender: req.userID,
            receiver,
            text: `📎 ${req.file.originalname}`,
            fileUrl: `/uploads/${req.file.filename}`,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            fileType: req.file.mimetype,
        };

        const newMessage = new Message(messageData);
        await newMessage.save();

        const populatedMessage = await Message.findById(newMessage._id)
            .populate('sender', 'Username profilePicture')
            .populate('receiver', 'Username profilePicture');

        const io = req.app.get('socketio');
        const onlineUsers = req.app.get('onlineUsers');

        const receiverSocketId = onlineUsers.get(receiver.toString());
        const senderSocketId = onlineUsers.get(req.userID.toString());
        
        if (receiverSocketId) io.to(receiverSocketId).emit('receivePrivateMessage', populatedMessage);
        if (senderSocketId) io.to(senderSocketId).emit('receivePrivateMessage', populatedMessage);

        res.json({ message: 'File uploaded successfully', data: populatedMessage });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ message: 'Upload failed', error: err.message });
    }
});

router.put('/edit/:messageId', Authmiddlewhere, async (req, res) => {
    try {
        const { messageId } = req.params;
        const { content, text } = req.body;
        const userId = req.userID;

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        if (message.sender.toString() !== userId) {
            return res.status(403).json({ message: 'You can only edit your own messages' });
        }

        if (message.deletedForEveryone) {
            return res.status(400).json({ message: 'Cannot edit deleted message' });
        }

        const fifteenMinutes = 15 * 60 * 1000;
        const messageAge = Date.now() - new Date(message.createdAt).getTime();

        if (messageAge > fifteenMinutes) {
            return res.status(400).json({ message: 'Edit time limit (15 minutes) has expired' });
        }

        message.text = content || text;
        message.isEdited = true;
        message.editedAt = new Date();
        await message.save();

        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'Username profilePicture')
            .populate('receiver', 'Username profilePicture');

        // ✅ Emit real-time edit event to receiver
        const io = req.app.get('socketio');
        const onlineUsers = req.app.get('onlineUsers');
        const receiverSocketId = onlineUsers.get(message.receiver.toString());
        
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('messageEdited', {
                messageId: message._id,
                text: message.text,
                isEdited: true
            });
        }

        res.status(200).json({ 
            message: 'Message edited successfully',
            data: populatedMessage
        });

    } catch (err) {
        console.error('Edit message error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.delete('/delete/:messageId', Authmiddlewhere, async (req, res) => {
    try {
        const { messageId } = req.params;
        const { deleteType } = req.body;
        const userId = req.userID;

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        if (deleteType === 'forEveryone') {
            if (message.sender.toString() !== userId) {
                return res.status(403).json({ message: 'Only sender can delete for everyone' });
            }

            const twoDays = 2 * 24 * 60 * 60 * 1000;
            const messageAge = Date.now() - new Date(message.createdAt).getTime();

            if (messageAge > twoDays) {
                return res.status(400).json({ 
                    message: 'Delete for everyone is only available within 2 days' 
                });
            }

            message.deletedForEveryone = true;
            message.text = 'This message was deleted';
            await message.save();

            const populatedMessage = await Message.findById(message._id)
                .populate('sender', 'Username profilePicture')
                .populate('receiver', 'Username profilePicture');

            // ✅ Emit real-time delete event to receiver
            const io = req.app.get('socketio');
            const onlineUsers = req.app.get('onlineUsers');
            const receiverSocketId = onlineUsers.get(message.receiver.toString());
            
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('messageDeleted', {
                    messageId: message._id,
                    deletedForEveryone: true
                });
            }

            res.status(200).json({ 
                message: 'Message deleted for everyone',
                data: populatedMessage
            });

        } else if (deleteType === 'forMe') {
            if (!message.deletedFor.includes(userId)) {
                message.deletedFor.push(userId);
                await message.save();
            }

            res.status(200).json({ 
                message: 'Message deleted for you',
                data: message
            });

        } else {
            return res.status(400).json({ message: 'Invalid delete type' });
        }

    } catch (err) {
        console.error('Delete message error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.delete('/clear/:userId', Authmiddlewhere, async (req, res) => {
    try {
        const currentUserId = req.userID;
        const otherUserId = req.params.userId;

        const currentUser = await User.findById(currentUserId);
        const otherUser = await User.findById(otherUserId);

        if (!currentUser || !otherUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const areFriends = currentUser.friends.some(
            friendId => friendId.toString() === otherUserId
        );

        if (!areFriends) {
            return res.status(403).json({ message: 'You can only clear chats with friends' });
        }

        const messages = await Message.find({
            $or: [
                { sender: currentUserId, receiver: otherUserId },
                { sender: otherUserId, receiver: currentUserId }
            ]
        });

        for (let message of messages) {
            if (!message.deletedFor.includes(currentUserId)) {
                message.deletedFor.push(currentUserId);
                await message.save();
            }
        }

        res.status(200).json({ 
            message: 'Chat cleared successfully',
            clearedCount: messages.length
        });

    } catch (err) {
        console.error('Clear chat error:', err);
        res.status(500).json({ message: 'Error clearing chat' });
    }
});

router.post('/block/:userId', Authmiddlewhere, async (req, res) => {
    try {
        const currentUserId = req.userID;
        const userToBlockId = req.params.userId;

        if (currentUserId === userToBlockId) {
            return res.status(400).json({ message: 'You cannot block yourself' });
        }

        const currentUser = await User.findById(currentUserId);
        const userToBlock = await User.findById(userToBlockId);

        if (!currentUser || !userToBlock) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!currentUser.blockedUsers) {
            currentUser.blockedUsers = [];
        }

        if (currentUser.blockedUsers.includes(userToBlockId)) {
            return res.status(400).json({ message: 'User is already blocked' });
        }

        currentUser.blockedUsers.push(userToBlockId);

        await currentUser.save();
        res.status(200).json({ 
            message: 'User blocked successfully',
            blockedUser: {
                _id: userToBlock._id,
                Username: userToBlock.Username
            }
        });

    } catch (err) {
        console.error('Block user error:', err);
        res.status(500).json({ message: 'Error blocking user' });
    }
});

router.delete('/unblock/:userId', Authmiddlewhere, async (req, res) => {
    try {
        const currentUserId = req.userID;
        const userToUnblockId = req.params.userId;

        const currentUser = await User.findById(currentUserId);

        if (!currentUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!currentUser.blockedUsers || !currentUser.blockedUsers.includes(userToUnblockId)) {
            return res.status(400).json({ message: 'User is not blocked' });
        }

        currentUser.blockedUsers = currentUser.blockedUsers.filter(
            blockedId => blockedId.toString() !== userToUnblockId
        );

        await currentUser.save();

        res.status(200).json({ message: 'User unblocked successfully' });

    } catch (err) {
        console.error('Unblock user error:', err);
        res.status(500).json({ message: 'Error unblocking user' });
    }
});

router.get('/blocked-users', Authmiddlewhere, async (req, res) => {
    try {
        const currentUserId = req.userID;
        const currentUser = await User.findById(currentUserId);

        if (!currentUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json(currentUser.blockedUsers || []);

    } catch (err) {
        console.error('Get blocked users error:', err);
        res.status(500).json({ message: 'Error fetching blocked users' });
    }
});

module.exports = router;