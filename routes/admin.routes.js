const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authMiddleware, adminOnly } = require('../middleware/auth.middleware');

router.get('/user', authMiddleware, adminOnly, adminController.getAllUsers);
router.delete('/user/:id', authMiddleware, adminOnly, adminController.deleteUser);

module.exports = router;