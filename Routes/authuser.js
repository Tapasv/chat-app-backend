const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../Schemas/User');
const bcrypt = require('bcrypt');
const { Authmiddlewhere } = require('../middlewhere/Authmiddlewhere');

router.post('/register', async (req, res) => {
    try {
        const { Username, Password, Email, role } = req.body;

        const dupli = await User.findOne({ Username });
        if (dupli) {
            return res.status(403).json({ 'message': `User: ${Username} already exists` });
        }

        const dupliemail = await User.findOne({ Email})
        if(dupliemail) {
            return res.status(403).json({'message': 'Email already exists'})
        }

        const hashedpwd = await bcrypt.hash(Password, 10);

        const newUser = new User({ 
            Username, 
            Password: hashedpwd, 
            role: role || 'User', 
            Email
        });
        
        const savedUser = await newUser.save();
        console.log("User saved to DB:", savedUser._id); // Debug log

        res.status(201).json({ 'message': `User: ${Username} created successfully` });
    }
    catch (err) {
        console.error("Registration error:", err); // This will show the real error
        res.status(500).json({ 'message': 'Server error', error: err.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { Username, Password } = req.body;

        const user = await User.findOne({ Username });
        if (!user) {
            return res.status(403).json({ 'message': `User: ${Username} not found` });
        }

        const ismatch = await bcrypt.compare(Password, user.Password);
        if (!ismatch) {
            return res.status(403).json({ 'message': `Invalid Credentials` });
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
            'message': `User ${Username} logged In`,
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
        res.status(500).json({ 'message': 'Server error' });
    }
});

// ✅ NEW: Token validation endpoint (fixes 404 error)
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
            return res.status(403).json({ 'message': `Invalid Token` });
        }

        jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, decoded) => {
            if(err) {
                return res.status(403).json({ 'message': 'Invalid refresh token' });
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
        res.status(500).json({ 'message': 'Server error' });
    }
});

router.post('/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        const user = await User.findOne({ refreshToken });
        if (!user) {
            return res.status(403).json({ 'message': `User already logged out OR Invalid Token` });
        }

       user.refreshToken = null;
       await user.save();

       return res.status(201).json({ 'message': `User: ${user.Username} successfully logged out ` });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ 'message': 'Server error' });
    }
});

module.exports = router;