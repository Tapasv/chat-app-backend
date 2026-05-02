const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const userRepository = require('../repositories/user.repository');
const ApiError = require('../utils/ApiError');
const sendEmail = require('../utils/sendEmail');
const logger = require('../utils/logger');

const ALLOWED_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = (email) => {
    if (!EMAIL_REGEX.test(email)) throw new ApiError(400, 'Invalid email format');
    const domain = email.toLowerCase().split('@')[1];
    if (!ALLOWED_DOMAINS.includes(domain)) {
        throw new ApiError(400, 'Please use Gmail, Yahoo, or Outlook email');
    }
};

const generateTokens = (userId, role) => {
    const accessToken = jwt.sign(
        { userID: userId, role },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
        { userID: userId, role },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '30d' }
    );
    return { accessToken, refreshToken };
};

const authService = {

    register: async ({ Username, Password, Email, role }) => {
        validateEmail(Email);

        const existingUsername = await userRepository.findByUsername(Username);
        if (existingUsername) throw new ApiError(409, `Username ${Username} already exists`);

        const existingEmail = await userRepository.findByEmail(Email);
        if (existingEmail) throw new ApiError(409, 'Email already exists');

        const hashedPassword = await bcrypt.hash(Password, 10);
        await userRepository.create({
            Username,
            Password: hashedPassword,
            Email,
            role: role || 'User'
        });

        return { message: `User ${Username} created successfully` };
    },

    login: async ({ Username, Password }) => {
        const user = await userRepository.findByUsername(Username);
        if (!user) throw new ApiError(401, `User ${Username} not found`);

        const isMatch = await bcrypt.compare(Password, user.Password);
        if (!isMatch) throw new ApiError(401, 'Invalid credentials');

        const { accessToken, refreshToken } = generateTokens(user._id, user.role);

        user.refreshToken = refreshToken;
        await userRepository.save(user);

        return {
            accessToken,
            refreshToken,
            user: {
                _id: user._id,
                Username: user.Username,
                role: user.role,
                profilePicture: user.profilePicture
            }
        };
    },

    refreshAccessToken: async (refreshToken) => {
        if (!refreshToken) throw new ApiError(400, 'Refresh token required');

        const user = await userRepository.findByRefreshToken(refreshToken);
        if (!user) throw new ApiError(403, 'Invalid refresh token');

        try {
            jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        } catch {
            throw new ApiError(403, 'Refresh token expired or invalid');
        }

        const { accessToken } = generateTokens(user._id, user.role);
        return { accessToken };
    },

    logout: async (refreshToken) => {
        if (!refreshToken) throw new ApiError(400, 'Refresh token required');

        const user = await userRepository.findByRefreshToken(refreshToken);
        if (!user) throw new ApiError(403, 'Invalid token');

        user.refreshToken = null;
        await userRepository.save(user);

        return { message: `User ${user.Username} logged out successfully` };
    },

    getValidatedUser: async (userId) => {
        const user = await userRepository.findById(userId, '_id Username role profilePicture');
        if (!user) throw new ApiError(404, 'User not found');
        return user;
    },

    forgotPassword: async (email) => {
        const user = await userRepository.findByEmail(email);
        if (!user) return { message: 'If that email exists, a reset link has been sent' };

        const resetToken = crypto.randomBytes(64).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpires = Date.now() + 3600000;
        await userRepository.save(user);

        const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
        const html = `
            <h2>Password Reset Request</h2>
            <p>Click the link below to reset your password:</p>
            <a href="${resetUrl}">Reset Password</a>
            <p>This link expires in 1 hour.</p>
            <p>If you didn't request this, ignore this email.</p>
        `;

        try {
            await sendEmail(user.Email, 'Password reset request', html);
        } catch (emailErr) {
            logger.error(`Failed to send reset email to ${user.Email}: ${emailErr.message}`);
        }

        return { message: 'If that email exists, a reset link has been sent' };
    },

    resetPassword: async (token, newPassword) => {
        if (!newPassword) throw new ApiError(400, 'Password is required');

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const user = await userRepository.findByResetToken(hashedToken);
        if (!user) throw new ApiError(400, 'Invalid or expired reset link');

        user.Password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await userRepository.save(user);

        return { message: 'Password reset successful' };
    }
};

module.exports = authService;