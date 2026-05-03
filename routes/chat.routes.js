const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { uploadFile } = require('../middleware/upload.middleware');
const { messageLimiter, uploadLimiter, generalLimiter } = require('../middleware/rateLimiter.middleware');

router.get('/private/:userId', authMiddleware, generalLimiter, chatController.getConversation);
router.post('/upload', authMiddleware, uploadLimiter, uploadFile, chatController.uploadFile);
router.put('/edit/:messageId', authMiddleware, messageLimiter, chatController.editMessage);
router.delete('/delete/:messageId', authMiddleware, generalLimiter, chatController.deleteMessage);
router.delete('/clear/:userId', authMiddleware, generalLimiter, chatController.clearChat);
router.post('/block/:userId', authMiddleware, generalLimiter, chatController.blockUser);
router.delete('/unblock/:userId', authMiddleware, generalLimiter, chatController.unblockUser);
router.get('/blocked-users', authMiddleware, generalLimiter, chatController.getBlockedUsers);
router.get('/private/:userId/paginated', authMiddleware, generalLimiter, chatController.getConversationPaginated);

module.exports = router;