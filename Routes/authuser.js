const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../Schemas/User');
const bcrypt = require('bcrypt');
const crypto = require('crypto')
const { Authmiddlewhere } = require('../middlewhere/Authmiddlewhere');
const sendEmail = require('../utils/sendEmail')

router.post('/register', async (req, res) => {
    try {
        const { Username, Password, Email, role } = req.body;

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(Email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        // Domain validation - only allow specific email providers
        const allowedDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
        const emailDomain = Email.toLowerCase().split('@')[1];
        if (!allowedDomains.includes(emailDomain)) {
            return res.status(400).json({ message: 'Please use Gmail, Yahoo, or Outlook email' });
        }

        const dupli = await User.findOne({ Username });
        if (dupli) {
            return res.status(403).json({ message: `User: ${Username} already exists` });
        }

        const dupliemail = await User.findOne({ Email })
        if(dupliemail) {
            return res.status(403).json({ message: 'Email already exists' })
        }

        const hashedpwd = await bcrypt.hash(Password, 10);

        const newUser = new User({ 
            Username, 
            Password: hashedpwd, 
            role: role || 'User', 
            Email
        });
        
        const savedUser = await newUser.save();
        console.log("User saved to DB:", savedUser._id);

        res.status(201).json({ message: `User: ${Username} created successfully` });
    }
    catch (err) {
        console.error("Registration error:", err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { Username, Password } = req.body;

        const user = await User.findOne({ Username });
        if (!user) {
            return res.status(403).json({ message: `User: ${Username} not found` });
        }

        const ismatch = await bcrypt.compare(Password, user.Password);
        if (!ismatch) {
            return res.status(403).json({ message: `Invalid Credentials` });
        }

        const Accesstoken = jwt.sign(
            {userID: user._id, role: user.role},
            process.env.ACCESS_TOKEN_SECRET,
            {expiresIn: '30d'}
        );
        const Refreshtoken = jwt.sign(
            {userID: user._id, role: user.role},
            process.env.REFRESH_TOKEN_SECRET,
            {expiresIn: '30d'}
        );

        user.refreshToken = Refreshtoken;
        await user.save();

        res.status(201).json({
            message: `User ${Username} logged In`,
            refreshToken: Refreshtoken,
            token: Accesstoken,
            user: {
                role: user.role,
                _id: user._id,
                Username: user.Username,
                profilePicture: user.profilePicture
            }
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/validate', Authmiddlewhere, async (req, res) => {
    try {
        const user = await User.findById(req.userID).select('_id Username role profilePicture');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ 
            valid: true, 
            user: {
                _id: user._id,
                Username: user.Username,
                role: user.role,
                profilePicture: user.profilePicture
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        const user = await User.findOne({ refreshToken });
        if (!user) {
            return res.status(403).json({ message: `Invalid Token` });
        }

        jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, decoded) => {
            if(err) {
                return res.status(403).json({ message: 'Invalid refresh token' });
            }

            const Accesstoken = jwt.sign(
                {userID: user._id, role: user.role},
                process.env.ACCESS_TOKEN_SECRET,
                {expiresIn: '30d'}
            );

            res.json({ Accesstoken });
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        const user = await User.findOne({ refreshToken });
        if (!user) {
            return res.status(403).json({ message: `User already logged out OR Invalid Token` });
        }

       user.refreshToken = null;
       await user.save();

       return res.status(201).json({ message: `User: ${user.Username} successfully logged out ` });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/forgot-password', async (req, res) => {
    try{
        const { email } = req.body

        const user = await User.findOne({ Email: email})

        if(!user) {
            return res.status(404).json({'message': 'No user with that emial found'})
        }

        const resetToken = crypto.randomBytes(64).toString('hex')
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex')
        user.resetPasswordExpires = Date.now() + 3600000; 
        await user.save()

        const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`

        const html = `
            <h2>Password Reset Request</h2>
            <p>You requested a password reset for your Chatify account.</p>
            <p>Click the link below to reset your password:</p>
            <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background: #e50914; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
            <p>This link expires in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
        `;

        await sendEmail(user.Email, 'Password reset request', html)

        res.json({message: 'Password reset link sent to your email.'})
    } catch(err) {
        console.error(err)
    }
})

router.post('/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { Password, password } = req.body; // Accept both cases

        const finalPassword = Password || password; // Use whichever is provided

        if (!finalPassword) {
            return res.status(400).json({ message: 'Password is required' });
        }

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired link' });
        }

        user.Password = await bcrypt.hash(finalPassword, 10);
        user.resetPasswordExpires = undefined;
        user.resetPasswordToken = undefined;
        await user.save();

        // THIS WAS MISSING - SEND RESPONSE!
        res.status(200).json({ 
            message: 'Password reset successful! You can now login with your new password.' 
        });

    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ message: 'Failed to reset password. Please try again.' });
    }
});

module.exports = router;