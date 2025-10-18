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
const profile = require('./Routes/profile')
const { DBcnnctn } = require('./DBcnnctn');

const port = process.env.PORT || 5000;
const server = http.createServer(app);

// ✅ CORS configuration
const allowedOrigins = [
    "https://chat-app-frontend-nine-sage.vercel.app",
    "http://localhost:5173"
];

app.use(cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));

app.use(express.json());

// ✅ DB Connection
DBcnnctn();

// ✅ Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ✅ Serve static uploads
app.use("/uploads", express.static(uploadDir));

// ✅ Socket.IO setup (WebSocket + polling CORS fix)
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["*"]
    },
    transports: ["websocket", "polling"],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000
});

const onlineUsers = new Map();
const pendingNotifications = new Map();

app.set('socketio', io);
app.set('onlineUsers', onlineUsers);

// ✅ Routes
app.use('/api/auth', authuser);
app.use('/api/admin', authadmin);
app.use('/api/chat', authchat);
app.use("/api/friends", friendRoutes);
app.use('/profile', profile);

// ✅ Socket.IO Events
io.on("connection", (socket) => {
    const Username = socket.handshake.auth.Username || "Anonymous";
    const userID = socket.handshake.auth.userid?.toString();

    if (userID) {
        onlineUsers.set(userID, socket.id);

        // Deliver pending notifications
        if (pendingNotifications.has(userID)) {
            const notifications = pendingNotifications.get(userID);
            notifications.forEach(notif => socket.emit("newMessageNotification", notif));
            pendingNotifications.delete(userID);
        }
    }

    console.log(`✅ User connected: ${Username} (${userID})`);
    io.emit("onlineUsers", [...onlineUsers.keys()]);

    // ✅ Let client request online users manually
    socket.on("requestOnlineUsers", () => {
        socket.emit("onlineUsers", [...onlineUsers.keys()]);
    });

    socket.on("disconnect", () => {
        if (userID) onlineUsers.delete(userID);
        console.log(`❌ User disconnected: ${Username}`);
        io.emit("onlineUsers", [...onlineUsers.keys()]);
    });

    // ✅ Private Messaging
    socket.on("sendPrivateMessage", async (data) => {
        try {
            const sender = await User.findById(data.sender);
            const receiver = await User.findById(data.receiver);
            if (!sender || !receiver) return;

            // Ensure they’re friends
            const senderFriendsStr = sender.friends.map(id => id.toString());
            if (!senderFriendsStr.includes(data.receiver.toString())) return;

            const newMsg = new Message({
                sender: data.sender,
                receiver: data.receiver,
                text: data.text
            });
            await newMsg.save();

            const populatedMsg = await Message.findById(newMsg._id)
                .populate("sender", "Username profilePicture")
                .populate("receiver", "Username profilePicture");

            const receiverSocketId = onlineUsers.get(data.receiver.toString());
            if (receiverSocketId) {
                io.to(receiverSocketId).emit("receivePrivateMessage", populatedMsg);
            } else {
                // store pending notifications
                if (!pendingNotifications.has(data.receiver.toString()))
                    pendingNotifications.set(data.receiver.toString(), []);
                pendingNotifications.get(data.receiver.toString()).push({
                    sender: {
                        _id: sender._id,
                        Username: sender.Username,
                        profilePicture: sender.profilePicture
                    },
                    message: data.text,
                    timestamp: new Date()
                });
            }

            socket.emit("receivePrivateMessage", populatedMsg);
        } catch (error) {
            console.error("❌ Error in sendPrivateMessage:", error);
        }
    });

    // ✅ Typing events
    socket.on("TypingPrivate", ({ username, receiver }) => {
        const receiverSocketId = onlineUsers.get(receiver?.toString());
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("UserTypingPrivate", {
                username,
                senderId: socket.handshake.auth.userid
            });
        }
    });

    socket.on("StopTypingPrivate", ({ username, receiver }) => {
        const receiverSocketId = onlineUsers.get(receiver?.toString());
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("UserStopTypingPrivate", {
                username,
                senderId: socket.handshake.auth.userid
            });
        }
    });
});

// ✅ Start server
mongoose.connection.once('open', () => {
    console.log("✅ Connected to Database!");
    server.listen(port, '0.0.0.0', () => console.log(`🚀 Server running on port ${port}`));
});
