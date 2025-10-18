const express = require('express');
const router = express.Router();
const User = require('../Schemas/User');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Authmiddlewhere } = require('../middlewhere/Authmiddlewhere');
const sendEmail = require('../utils/sendEmail');

// Get current user profile
router.get('/me', Authmiddlewhere, async (req, res) => {
    try {
        const user = await User.findById(req.userID).select('-Password -refreshToken -resetPasswordToken -resetPasswordExpires');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update username
router.put('/update-username', Authmiddlewhere, async (req, res) => {
    try {
        const { Username } = req.body;

        if (!Username || !Username.trim()) {
            return res.status(400).json({ message: 'Username is required' });
        }

        // Check if username already exists
        const existingUser = await User.findOne({ Username, _id: { $ne: req.userID } });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already taken' });
        }

        const user = await User.findById(req.userID);
        user.Username = Username;
        await user.save();

        res.json({ 
            message: 'Username updated successfully',
            user: {
                _id: user._id,
                Username: user.Username,
                Email: user.Email,
                role: user.role,
                profilePicture: user.profilePicture
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update username' });
    }
});

// Verify current password
router.post('/verify-password', Authmiddlewhere, async (req, res) => {
    try {
        const { currentPassword } = req.body;

        if (!currentPassword) {
            return res.status(400).json({ message: 'Current password is required' });
        }

        const user = await User.findById(req.userID);
        const isMatch = await bcrypt.compare(currentPassword, user.Password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        res.json({ message: 'Password verified', verified: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update password
router.put('/update-password', Authmiddlewhere, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters' });
        }

        const user = await User.findById(req.userID);
        
        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.Password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        // Hash and save new password
        user.Password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update password' });
    }
});

// Request email change (sends verification to NEW email)
router.post('/request-email-change', Authmiddlewhere, async (req, res) => {
    try {
        const { newEmail } = req.body;

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        // Domain validation
        const allowedDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
        const emailDomain = newEmail.toLowerCase().split('@')[1];
        if (!allowedDomains.includes(emailDomain)) {
            return res.status(400).json({ message: 'Please use Gmail, Yahoo, or Outlook email' });
        }

        // Check if email already exists
        const existingEmail = await User.findOne({ Email: newEmail });
        if (existingEmail) {
            return res.status(400).json({ message: 'Email already in use' });
        }

        const user = await User.findById(req.userID);

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        user.emailChangeToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
        user.newEmail = newEmail;
        user.emailChangeExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        // Send verification email to NEW email
        const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;

        const html = `
            <h2>Email Change Request</h2>
            <p>Hello ${user.Username},</p>
            <p>You requested to change your email address to: <strong>${newEmail}</strong></p>
            <p>Click the link below to verify and complete the email change:</p>
            <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background: #e50914; color: white; text-decoration: none; border-radius: 5px;">Verify New Email</a>
            <p>This link expires in 1 hour.</p>
            <p>If you didn't request this change, please ignore this email.</p>
        `;

        await sendEmail(newEmail, 'Verify Your New Email Address', html);

        res.json({ message: 'Verification email sent to new email address' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to send verification email' });
    }
});

// Verify new email and complete change
router.post('/verify-email/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            emailChangeToken: hashedToken,
            emailChangeExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired verification link' });
        }

        // Update email
        user.Email = user.newEmail;
        user.emailChangeToken = undefined;
        user.newEmail = undefined;
        user.emailChangeExpires = undefined;
        await user.save();

        res.json({ message: 'Email updated successfully! You can now login with your new email.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to verify email' });
    }
});

module.exports = router;