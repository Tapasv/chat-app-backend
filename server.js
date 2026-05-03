require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');

const connectDB = require('./config/db');
const initSocket = require('./socket/index');
const errorMiddleware = require('./middleware/error.middleware');
const logger = require('./utils/logger');

const authRoutes = require('./routes/auth.routes');
const chatRoutes = require('./routes/chat.routes');
const friendRoutes = require('./routes/friend.routes');
const profileRoutes = require('./routes/profile.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
    'https://chat-app-frontend-nine-sage.vercel.app',
    'http://localhost:5173'
];

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

app.use(morgan('combined', {
    stream: {
        write: (message) => logger.http(message.trim())
    },
    skip: (req) => req.path === '/health'
}));

// Uploads directory — only on non-ephemeral file
const uploadDir = path.join(__dirname, 'uploads');
try {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    app.use('/uploads', express.static(uploadDir));
} catch {
    // On Render, local file storage isn't persistent — use Cloudinary instead
}

const io = initSocket(server);
app.set('socketio', io);

require('./workers/notification.worker');
logger.info('Notification worker started');

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', uptime: process.uptime() });
});

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);

app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
        logger.info(`Server running on port ${PORT}`);
    });
});