const profileService = require('../services/profile.service');
const ApiResponse = require('../utils/ApiResponse');

const profileController = {

    getProfile: async (req, res, next) => {
        try {
            const user = await profileService.getProfile(req.userID);
            res.status(200).json(new ApiResponse(200, user, 'Profile fetched'));
        } catch (err) {
            next(err);
        }
    },

    updateUsername: async (req, res, next) => {
        try {
            const user = await profileService.updateUsername(req.userID, req.body.Username);
            res.status(200).json(new ApiResponse(200, user, 'Username updated successfully'));
        } catch (err) {
            next(err);
        }
    },

    verifyPassword: async (req, res, next) => {
        try {
            const result = await profileService.verifyPassword(req.userID, req.body.currentPassword);
            res.status(200).json(new ApiResponse(200, result, 'Password verified'));
        } catch (err) {
            next(err);
        }
    },

    updatePassword: async (req, res, next) => {
        try {
            const { currentPassword, newPassword } = req.body;
            const result = await profileService.updatePassword(req.userID, currentPassword, newPassword);
            res.status(200).json(new ApiResponse(200, result, result.message));
        } catch (err) {
            next(err);
        }
    },

    requestEmailChange: async (req, res, next) => {
        try {
            const result = await profileService.requestEmailChange(req.userID, req.body.newEmail);
            res.status(200).json(new ApiResponse(200, result, result.message));
        } catch (err) {
            next(err);
        }
    },

    verifyEmailChange: async (req, res, next) => {
        try {
            const result = await profileService.verifyEmailChange(req.params.token);
            res.status(200).json(new ApiResponse(200, result, result.message));
        } catch (err) {
            next(err);
        }
    },

    uploadProfilePicture: async (req, res, next) => {
        try {
            const result = await profileService.uploadProfilePicture(req.userID, req.file);
            res.status(200).json(new ApiResponse(200, result, 'Profile picture updated'));
        } catch (err) {
            next(err);
        }
    }
};

module.exports = profileController;