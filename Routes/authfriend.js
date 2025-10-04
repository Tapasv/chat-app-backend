const express = require("express");
const router = express.Router();
const multer = require('multer');
const path = require('path');
const FriendRequest = require("../Schemas/FriendRequest");
const User = require("../Schemas/User");
const { Authmiddlewhere } = require("../middlewhere/Authmiddlewhere");

// Profile picture upload setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/profiles/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const uploadProfile = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images are allowed'));
    },
});

// Upload profile picture
// Upload profile picture
router.post("/profile-picture", Authmiddlewhere, uploadProfile.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    if (!req.userID) {
      return res.status(401).json({ message: "Unauthorized: userID missing" });
    }

    const profilePicturePath = `/uploads/profiles/${req.file.filename}`;
    
    await User.findByIdAndUpdate(req.userID, { profilePicture: profilePicturePath });

    res.json({ message: 'Profile picture updated', profilePicture: profilePicturePath });
  } catch (err) {
    console.error("Profile picture upload error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


// Search users by username
router.get("/search", Authmiddlewhere, async (req, res) => {
  try {
    const { q } = req.query;
    const users = await User.find({ 
      Username: { $regex: q, $options: "i" },
      _id: { $ne: req.userID }
    }).select("_id Username profilePicture");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Send friend request
router.post("/request/:receiverId", Authmiddlewhere, async (req, res) => {
  try {
    const { receiverId } = req.params;
    const senderId = req.userID;

    if (senderId === receiverId) {
      return res.status(400).json({ message: "You cannot send request to yourself" });
    }

    const sender = await User.findById(senderId);
    if (sender.friends.includes(receiverId)) {
      return res.status(400).json({ message: "Already friends" });
    }

    const existing = await FriendRequest.findOne({ 
      sender: senderId, 
      receiver: receiverId,
      status: "pending"
    });
    if (existing) return res.status(400).json({ message: "Request already sent" });

    const newReq = new FriendRequest({ sender: senderId, receiver: receiverId });
    await newReq.save();

    const populatedReq = await FriendRequest.findById(newReq._id)
      .populate('sender', 'Username profilePicture')
      .populate('receiver', 'Username profilePicture');

    const io = req.app.get('socketio');
    const onlineUsers = req.app.get('onlineUsers');
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('friendRequestReceived', populatedReq);
    }

    res.json({ message: "Friend request sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Accept friend request
router.put("/accept/:requestId", Authmiddlewhere, async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await FriendRequest.findById(requestId);

    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.receiver.toString() !== req.userID) {
      return res.status(403).json({ message: "Not authorized" });
    }

    request.status = "accepted";
    await request.save();

    await User.findByIdAndUpdate(request.sender, { $addToSet: { friends: request.receiver } });
    await User.findByIdAndUpdate(request.receiver, { $addToSet: { friends: request.sender } });

    const acceptor = await User.findById(request.receiver).select('_id Username profilePicture');
    const requester = await User.findById(request.sender).select('_id Username profilePicture');

    const io = req.app.get('socketio');
    const onlineUsers = req.app.get('onlineUsers');
    const senderSocketId = onlineUsers.get(request.sender.toString());
    
    if (senderSocketId) {
      io.to(senderSocketId).emit('friendRequestAccepted', acceptor);
    }

    const receiverSocketId = onlineUsers.get(request.receiver.toString());
    if (senderSocketId) {
      io.to(senderSocketId).emit("onlineUsers", [...onlineUsers.keys()]);
    }
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("onlineUsers", [...onlineUsers.keys()]);
    }

    res.json({ message: "Friend request accepted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Reject friend request
router.put("/reject/:requestId", Authmiddlewhere, async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await FriendRequest.findById(requestId);

    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.receiver.toString() !== req.userID) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const senderId = request.sender.toString();
    
    request.status = "rejected";
    await request.save();

    const io = req.app.get('socketio');
    const onlineUsers = req.app.get('onlineUsers');
    const senderSocketId = onlineUsers.get(senderId);
    
    if (senderSocketId) {
      io.to(senderSocketId).emit('friendRequestRejected', { requestId, receiverId: req.userID });
    }

    res.json({ message: "Friend request rejected" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Unfriend
router.delete("/unfriend/:friendId", Authmiddlewhere, async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.userID;

    await User.findByIdAndUpdate(userId, { $pull: { friends: friendId } });
    await User.findByIdAndUpdate(friendId, { $pull: { friends: userId } });

    const io = req.app.get('socketio');
    const onlineUsers = req.app.get('onlineUsers');
    const friendSocketId = onlineUsers.get(friendId);
    
    if (friendSocketId) {
      io.to(friendSocketId).emit('friendRemoved', { userId });
    }

    res.json({ message: "Friend removed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get friend list
router.get("/list", Authmiddlewhere, async (req, res) => {
  try {
    const user = await User.findById(req.userID).populate("friends", "Username profilePicture");
    res.json(user.friends || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get received friend requests
router.get("/requests/received", Authmiddlewhere, async (req, res) => {
  try {
    const requests = await FriendRequest.find({ 
      receiver: req.userID, 
      status: "pending" 
    })
      .populate('sender', 'Username profilePicture')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get sent friend requests
router.get("/requests/sent", Authmiddlewhere, async (req, res) => {
  try {
    const requests = await FriendRequest.find({ 
      sender: req.userID, 
      status: "pending" 
    })
      .populate('receiver', 'Username profilePicture')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;