const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) throw new ApiError(403, 'No token provided');

        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        req.userID = decoded.userID;
        req.UserRole = decoded.role;
        next();
    } catch (err) {
        if (err instanceof ApiError) return next(err);
        next(new ApiError(401, 'Invalid or expired token'));
    }
};

const adminOnly = (req, res, next) => {
    if (req.UserRole !== 'Admin') {
        return next(new ApiError(403, 'Admin access only'));
    }
    next();
};

module.exports = { authMiddleware, adminOnly };