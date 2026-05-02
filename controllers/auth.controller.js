const authService = require('../services/auth.service');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');

const authController = {

    register: async (req, res, next) => {
        try {
            const result = await authService.register(req.body);
            res.status(201).json(new ApiResponse(201, result, result.message));
        } catch (err) {
            next(err);
        }
    },

    login: async (req, res, next) => {
        try {
            const result = await authService.login(req.body);
            res.status(200).json(new ApiResponse(200, result, 'Logged in successfully'));
        } catch (err) {
            next(err);
        }
    },

    refresh: async (req, res, next) => {
        try {
            const { refreshToken } = req.body;
            const result = await authService.refreshAccessToken(refreshToken);
            res.status(200).json(new ApiResponse(200, result, 'Token refreshed'));
        } catch (err) {
            next(err);
        }
    },

    logout: async (req, res, next) => {
        try {
            const { refreshToken } = req.body;
            const result = await authService.logout(refreshToken);
            res.status(200).json(new ApiResponse(200, result, result.message));
        } catch (err) {
            next(err);
        }
    },

    validate: async (req, res, next) => {
        try {
            const user = await authService.getValidatedUser(req.userID);
            res.status(200).json(new ApiResponse(200, { valid: true, user }, 'Token valid'));
        } catch (err) {
            next(err);
        }
    },

    forgotPassword: async (req, res, next) => {
        try {
            const { email } = req.body;
            const result = await authService.forgotPassword(email);
            res.status(200).json(new ApiResponse(200, result, result.message));
        } catch (err) {
            next(err);
        }
    },

    resetPassword: async (req, res, next) => {
        try {
            const { token } = req.params;
            const { Password, password } = req.body;
            const result = await authService.resetPassword(token, Password || password);
            res.status(200).json(new ApiResponse(200, result, result.message));
        } catch (err) {
            next(err);
        }
    }
};

module.exports = authController;