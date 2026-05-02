const bcrypt = require('bcrypt');
const crypto = require('crypto');
const userRepository = require('../repositories/user.repository');
const ApiError = require('../utils/ApiError');
const sendEmail = require('../utils/sendEmail');
const { cloudinary } = require('../config/cloudinary');

const ALLOWED_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = (email) => {
    if (!EMAIL_REGEX.test(email)) throw new ApiError(400, 'Invalid email format');
    const domain = email.toLowerCase().split('@')[1];
    if (!ALLOWED_DOMAINS.includes(domain)) {
        throw new ApiError(400, 'Please use Gmail, Yahoo, or Outlook email');
    }
};

const profileService = {

    getProfile: async (userId) => {
        const user = await userRepository.findById(
            userId,
            '-Password -refreshToken -resetPasswordToken -resetPasswordExpires'
        );
        if (!user) throw new ApiError(404, 'User not found');
        return user;
    },

    updateUsername: async (userId, newUsername) => {
        if (!newUsername?.trim()) throw new ApiError(400, 'Username is required');

        const existing = await userRepository.checkUsernameExists(newUsername, userId);
        if (existing) throw new ApiError(400, 'Username already taken');

        const user = await userRepository.findByIdFull(userId);
        user.Username = newUsername.trim();
        await userRepository.save(user);

        return {
            _id: user._id,
            Username: user.Username,
            Email: user.Email,
            role: user.role,
            profilePicture: user.profilePicture
        };
    },

    verifyPassword: async (userId, currentPassword) => {
        if (!currentPassword) throw new ApiError(400, 'Current password is required');

        const user = await userRepository.findByIdFull(userId);
        const isMatch = await bcrypt.compare(currentPassword, user.Password);
        if (!isMatch) throw new ApiError(400, 'Current password is incorrect');

        return { verified: true };
    },

    updatePassword: async (userId, currentPassword, newPassword) => {
        if (!currentPassword || !newPassword) {
            throw new ApiError(400, 'All fields are required');
        }
        if (newPassword.length < 6) {
            throw new ApiError(400, 'New password must be at least 6 characters');
        }

        const user = await userRepository.findByIdFull(userId);
        const isMatch = await bcrypt.compare(currentPassword, user.Password);
        if (!isMatch) throw new ApiError(400, 'Current password is incorrect');

        user.Password = await bcrypt.hash(newPassword, 10);
        await userRepository.save(user);

        return { message: 'Password updated successfully' };
    },

    requestEmailChange: async (userId, newEmail) => {
        validateEmail(newEmail);

        const existing = await userRepository.checkEmailExists(newEmail, userId);
        if (existing) throw new ApiError(400, 'Email already in use');

        const user = await userRepository.findByIdFull(userId);
        const verificationToken = crypto.randomBytes(32).toString('hex');
        user.emailChangeToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
        user.newEmail = newEmail;
        user.emailChangeExpires = Date.now() + 3600000;
        await userRepository.save(user);

        const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
        const html = `
            <h2>Email Change Request</h2>
            <p>Hello ${user.Username},</p>
            <p>Click below to verify your new email: <strong>${newEmail}</strong></p>
            <a href="${verificationUrl}">Verify New Email</a>
            <p>Expires in 1 hour. If you didn't request this, ignore this email.</p>
        `;

        await sendEmail(newEmail, 'Verify Your New Email Address', html);
        return { message: 'Verification email sent' };
    },

    verifyEmailChange: async (token) => {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const user = await userRepository.findByEmailChangeToken(hashedToken);
        if (!user) throw new ApiError(400, 'Invalid or expired verification link');

        user.Email = user.newEmail;
        user.emailChangeToken = undefined;
        user.newEmail = undefined;
        user.emailChangeExpires = undefined;
        await userRepository.save(user);

        return { message: 'Email updated successfully' };
    },

    uploadProfilePicture: async (userId, file) => {
        if (!file) throw new ApiError(400, 'No file uploaded');

        const user = await userRepository.findByIdFull(userId);
        if (!user) throw new ApiError(404, 'User not found');

        // Delete old Cloudinary image if exists
        if (user.profilePicture) {
            try {
                const urlParts = user.profilePicture.split('/');
                const publicIdWithExt = urlParts[urlParts.length - 1];
                const publicId = `chatify-profiles/${publicIdWithExt.split('.')[0]}`;
                await cloudinary.uploader.destroy(publicId);
            } catch {
                // Non-fatal: old image deletion failure shouldn't block upload
            }
        }

        user.profilePicture = file.path;
        await userRepository.save(user);

        return { profilePicture: user.profilePicture };
    }
};

module.exports = profileService;