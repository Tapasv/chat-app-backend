const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { uploadProfilePicture } = require('../middleware/upload.middleware');
const { uploadLimiter, generalLimiter, authLimiter } = require('../middleware/rateLimiter.middleware');

router.get('/me', authMiddleware, generalLimiter, profileController.getProfile);
router.put('/update-username', authMiddleware, generalLimiter, profileController.updateUsername);
router.post('/verify-password', authMiddleware, authLimiter, profileController.verifyPassword);
router.put('/update-password', authMiddleware, authLimiter, profileController.updatePassword);
router.post('/request-email-change', authMiddleware, generalLimiter, profileController.requestEmailChange);
router.post('/verify-email/:token', generalLimiter, profileController.verifyEmailChange);
router.post('/upload-profile-picture', authMiddleware, uploadLimiter, uploadProfilePicture, profileController.uploadProfilePicture);

module.exports = router;