const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { authLimiter, generalLimiter } = require('../middleware/rateLimiter.middleware');

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/refresh', generalLimiter, authController.refresh);
router.post('/logout', generalLimiter, authController.logout);
router.get('/validate', authMiddleware, generalLimiter, authController.validate);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password/:token', authLimiter, authController.resetPassword);

module.exports = router;