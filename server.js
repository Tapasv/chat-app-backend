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

const port = 5000;
const server = http.createServer(app);

// CORS Setup
app.use(cors({
    origin: [
        "http://192.168.0.102:5173",
        "http://192.168.0.103:5173",
        "http://192.168.0.107:5173",
        "http://localhost:5173"
    ],
    credentials: true
}));
app.use(express.json());

// DB Connection
DBcnnctn();

// Create directories
const uploadDir = path.join(__dirname, 'uploads');
const profilesDir = path.join(__dirname, 'uploads/profiles');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(profilesDir)) {
    fs.mkdirSync(profilesDir, { recursive: true });
}

// Socket.IO Setup
const io = new Server(server, {
    cors: {
        origin: [
            "http://192.168.0.102:5173",
            "http://192.168.0.103:5173",
            "http://192.168.0.107:5173",
            "http://localhost:5173"
        ],
        credentials: true
    }
});

// Track online users and pending messages
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

// Socket.IO Events
io.on("connection", (socket) => {
    const Username = socket.handshake.auth.Username || "Anonymous";
    const userID = socket.handshake.auth.userid?.toString();

    if (userID) {
        onlineUsers.set(userID, socket.id);

        // Send pending notifications
        if (pendingNotifications.has(userID)) {
            const notifications = pendingNotifications.get(userID);
            notifications.forEach(notif => {
                socket.emit("newMessageNotification", notif);
            });
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

    // Private Chat
    socket.on("sendPrivateMessage", async (data) => {
        try {
            console.log("Received message:", data);

            const sender = await User.findById(data.sender);
            const receiver = await User.findById(data.receiver);

            if (!sender || !receiver) {
                return socket.emit("errorMessage", { message: "User not found" });
            }

            // Check if friends
            const senderFriendsStr = sender.friends.map(id => id.toString());
            if (!senderFriendsStr.includes(data.receiver.toString())) {
                console.log("Not friends");
                return socket.emit("errorMessage", { message: "You can only message friends" });
            }

            // Save message
            const newMsg = new Message({
                sender: data.sender,
                receiver: data.receiver,
                text: data.text
            });

            await newMsg.save();
            console.log("Message saved:", newMsg._id);

            const populatedMsg = await Message.findById(newMsg._id)
                .populate("sender", "Username profilePicture")
                .populate("receiver", "Username profilePicture");

            const receiverId = data.receiver.toString();
            const senderId = data.sender.toString();

            // Emit to receiver
            const receiverSocketId = onlineUsers.get(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit("receivePrivateMessage", populatedMsg);
                console.log("Message sent to receiver");
            } else {
                // Receiver is offline, store notification
                const notification = {
                    sender: {
                        _id: sender._id,
                        Username: sender.Username,
                        profilePicture: sender.profilePicture
                    },
                    message: data.text,
                    timestamp: new Date()
                };

                if (!pendingNotifications.has(receiverId)) {
                    pendingNotifications.set(receiverId, []);
                }
                pendingNotifications.get(receiverId).push(notification);
                console.log("Message stored for offline user");
            }

            // Emit to sender's current socket (so sender sees it immediately)
            // This is the critical fix: always send back to the current socket so sender UI updates instantly.
            socket.emit("receivePrivateMessage", populatedMsg);
            console.log("Message sent to sender (current socket)");

            // Emit to sender's other devices only (not current socket)
            const senderSocketId = onlineUsers.get(senderId);
            if (senderSocketId && senderSocketId !== socket.id) {
                io.to(senderSocketId).emit("receivePrivateMessage", populatedMsg);
                console.log("Message sent to sender's other devices");
            }

        } catch (error) {
            console.error("Error in sendPrivateMessage:", error);
        }
    });

    // Typing Indicators
    socket.on("TypingPrivate", ({ username, receiver }) => {
        const senderId = socket.handshake.auth.userid;
        const receiverSocketId = onlineUsers.get(receiver?.toString());
        if (receiverSocketId) io.to(receiverSocketId).emit("UserTypingPrivate", { username, senderId });
    });

    socket.on("StopTypingPrivate", ({ username, receiver }) => {
        const senderId = socket.handshake.auth.userid;
        const receiverSocketId = onlineUsers.get(receiver?.toString());
        if (receiverSocketId) io.to(receiverSocketId).emit("UserStopTypingPrivate", { username, senderId });
    });

    // WebRTC Signaling for Voice/Video calls
    socket.on("callUser", async ({ to, from, signalData, callType }) => {
        try {
            console.log("Call initiated:", { from, to, callType });

            const receiverSocketId = onlineUsers.get(to);
            if (receiverSocketId) {
                // Fetch caller details
                const caller = await User.findById(from).select('_id Username profilePicture');

                console.log("Sending call to receiver:", to);
                io.to(receiverSocketId).emit("incomingCall", {
                    from,
                    caller: caller,
                    signalData,
                    callType
                });
                console.log("Call notification sent");
            } else {
                console.log("Receiver is offline");
                socket.emit("callFailed", { message: "User is offline" });
            }
        } catch (error) {
            console.error("Call error:", error);
        }
    });

    socket.on("answerCall", ({ to, signalData }) => {
        console.log("Call answered, sending signal to:", to);
        const callerSocketId = onlineUsers.get(to);
        if (callerSocketId) {
            io.to(callerSocketId).emit("callAccepted", signalData);
            console.log("Answer sent to caller");
        }
    });

    // ICE Candidate Exchange - CRITICAL FOR WEBRTC
    socket.on("iceCandidate", ({ to, candidate }) => {
        console.log("Relaying ICE candidate to:", to);
        const receiverSocketId = onlineUsers.get(to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("iceCandidate", { candidate });
            console.log("ICE candidate relayed successfully");
        } else {
            console.log("Cannot relay ICE candidate - receiver offline");
        }
    });

    socket.on("rejectCall", ({ to }) => {
        console.log("Call rejected by receiver");
        const callerSocketId = onlineUsers.get(to);
        if (callerSocketId) {
            io.to(callerSocketId).emit("callRejected");
        }
    });

    socket.on("endCall", ({ to }) => {
        console.log("Call ended");
        const receiverSocketId = onlineUsers.get(to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("callEnded");
        }
    });
});

// Start Server
mongoose.connection.once('open', () => {
    console.log("Connected to Database!");
    server.listen(port, '0.0.0.0', () => console.log(`Server running on port ${port}`));
});
