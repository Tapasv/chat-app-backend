const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friend.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { friendRequestLimiter, generalLimiter } = require('../middleware/rateLimiter.middleware');

router.get('/search', authMiddleware, generalLimiter, friendController.searchUsers);
router.post('/request/:receiverId', authMiddleware, friendRequestLimiter, friendController.sendRequest);
router.put('/accept/:requestId', authMiddleware, generalLimiter, friendController.acceptRequest);
router.put('/reject/:requestId', authMiddleware, generalLimiter, friendController.rejectRequest);
router.delete('/unfriend/:friendId', authMiddleware, generalLimiter, friendController.unfriend);
router.get('/list', authMiddleware, generalLimiter, friendController.getFriendList);
router.get('/requests/received', authMiddleware, generalLimiter, friendController.getReceivedRequests);
router.get('/requests/sent', authMiddleware, generalLimiter, friendController.getSentRequests);

module.exports = router;