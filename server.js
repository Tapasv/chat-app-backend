require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const authadmin = require('./Routes/authadmin');
const authuser = require('./Routes/authuser');
const authchat = require('./Routes/authchat');
const friendRoutes = require("./Routes/authfriend");
const Message = require('./Schemas/Message');
const User = require('./Schemas/User');
const { DBcnnctn } = require('./DBcnnctn');

const port = process.env.PORT || 5000; // use Render's port
const server = http.createServer(app);

// Allowed frontend origins
const allowedOrigins = [
    "http://192.168.0.102:5173",
    "http://192.168.0.103:5173",
    "http://192.168.0.107:5173",
    "http://localhost:5173",
    "https://chat-app-frontend-qspf0il3i-tapasvs-projects.vercel.app/" // add new frontend
];

// CORS middleware
const corsOptions = {
    origin: function(origin, callback) {
        if (!origin) return callback(null, true); // allow curl, mobile, server requests
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, true); // allow unknown origins if needed, or use false to block
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
};
app.use(cors(corsOptions));

// Handle preflight OPTIONS safely
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        const origin = req.headers.origin;
        if (allowedOrigins.includes(origin)) {
            res.header('Access-Control-Allow-Origin', origin);
            res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
            res.header('Access-Control-Allow-Credentials', 'true');
            return res.sendStatus(204);
        } else {
            return res.sendStatus(403);
        }
    }
    next();
});

app.use(express.json());

// DB Connection
DBcnnctn();

// Create uploads directories if they don't exist
const uploadDir = path.join(__dirname, 'uploads');
const profilesDir = path.join(__dirname, 'uploads/profiles');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(profilesDir)) fs.mkdirSync(profilesDir, { recursive: true });

// Socket.IO Setup
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true
    }
});

// Online users and pending notifications
const onlineUsers = new Map();
const pendingNotifications = new Map();

app.set('socketio', io);
app.set('onlineUsers', onlineUsers);

// Routes
app.use('/api/auth', authuser);
app.use('/api/admin', authadmin);
app.use('/api/chat', authchat);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use("/api/friends", friendRoutes);

// Socket.IO events
io.on("connection", (socket) => {
    const Username = socket.handshake.auth.Username || "Anonymous";
    const userID = socket.handshake.auth.userid?.toString();

    if (userID) {
        onlineUsers.set(userID, socket.id);

        if (pendingNotifications.has(userID)) {
            const notifications = pendingNotifications.get(userID);
            notifications.forEach(notif => socket.emit("newMessageNotification", notif));
            pendingNotifications.delete(userID);
        }
    }

    console.log(`User connected: ${Username} (${userID})`);
    io.emit("onlineUsers", [...onlineUsers.keys()]);

    socket.on("requestOnlineUsers", () => {
        socket.emit("onlineUsers", [...onlineUsers.keys()]);
    });

    socket.on("disconnect", () => {
        if (userID) onlineUsers.delete(userID);
        console.log(`User disconnected: ${Username}`);
        io.emit("onlineUsers", [...onlineUsers.keys()]);
    });

    socket.on("sendPrivateMessage", async (data) => {
        try {
            const sender = await User.findById(data.sender);
            const receiver = await User.findById(data.receiver);

            if (!sender || !receiver) return socket.emit("errorMessage", { message: "User not found" });

            const senderFriendsStr = sender.friends.map(id => id.toString());
            if (!senderFriendsStr.includes(data.receiver.toString())) {
                return socket.emit("errorMessage", { message: "You can only message friends" });
            }

            const newMsg = new Message({ sender: data.sender, receiver: data.receiver, text: data.text });
            await newMsg.save();

            const populatedMsg = await Message.findById(newMsg._id)
                .populate("sender", "Username profilePicture")
                .populate("receiver", "Username profilePicture");

            const receiverSocketId = onlineUsers.get(data.receiver.toString());
            if (receiverSocketId) {
                io.to(receiverSocketId).emit("receivePrivateMessage", populatedMsg);
            } else {
                const notification = {
                    sender: {
                        _id: sender._id,
                        Username: sender.Username,
                        profilePicture: sender.profilePicture
                    },
                    message: data.text,
                    timestamp: new Date()
                };
                if (!pendingNotifications.has(data.receiver.toString())) pendingNotifications.set(data.receiver.toString(), []);
                pendingNotifications.get(data.receiver.toString()).push(notification);
            }

            socket.emit("receivePrivateMessage", populatedMsg);

            const senderSocketId = onlineUsers.get(data.sender.toString());
            if (senderSocketId && senderSocketId !== socket.id) io.to(senderSocketId).emit("receivePrivateMessage", populatedMsg);

        } catch (error) {
            console.error("Error in sendPrivateMessage:", error);
        }
    });

    socket.on("TypingPrivate", ({ username, receiver }) => {
        const receiverSocketId = onlineUsers.get(receiver?.toString());
        if (receiverSocketId) io.to(receiverSocketId).emit("UserTypingPrivate", { username, senderId: socket.handshake.auth.userid });
    });

    socket.on("StopTypingPrivate", ({ username, receiver }) => {
        const receiverSocketId = onlineUsers.get(receiver?.toString());
        if (receiverSocketId) io.to(receiverSocketId).emit("UserStopTypingPrivate", { username, senderId: socket.handshake.auth.userid });
    });
});

// Start server
mongoose.connection.once('open', () => {
    console.log("Connected to Database!");
    server.listen(port, '0.0.0.0', () => console.log(`Server running on port ${port}`));
});
