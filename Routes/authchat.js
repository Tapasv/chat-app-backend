const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { Authmiddlewhere } = require('../middlewhere/Authmiddlewhere');
const Message = require('../Schemas/Message');
const User = require('../Schemas/User');

// ✅ Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads')); // ensure correct path
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: (req, file, cb) => cb(null, true),
});

// ✅ Upload file route
router.post('/upload', Authmiddlewhere, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const { receiver } = req.body;
        if (!receiver) return res.status(400).json({ message: 'Receiver is required' });

        // Check if receiver is a friend
        const sender = await User.findById(req.user._id);
        if (!sender.friends.includes(receiver)) {
            return res.status(403).json({ message: 'You can only send files to friends' });
        }

        const messageData = {
            sender: req.user._id,
            receiver,
            text: `📎 ${req.file.originalname}`,
            fileUrl: `/uploads/${req.file.filename}`, // ✅ correct URL
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
        const senderSocketId = onlineUsers.get(req.user._id.toString());
        
        if (receiverSocketId) io.to(receiverSocketId).emit('receivePrivateMessage', populatedMessage);
        if (senderSocketId) io.to(senderSocketId).emit('receivePrivateMessage', populatedMessage);

        res.json({ message: 'File uploaded successfully', data: populatedMessage });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ message: 'Upload failed', error: err.message });
    }
});
