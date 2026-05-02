const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { redis } = require('../config/redis');

// Factory function to create a limiter with custom options
const createLimiter = (options) => {
    return rateLimit({
        windowMs: options.windowMs,
        max: options.max,
        message: {
            statusCode: 429,
            message: options.message || 'Too many requests, please try again later',
            success: false
        },
        standardHeaders: true,
        legacyHeaders: false,
        store: new RedisStore({
            sendCommand: (...args) => redis.call(...args),
            prefix: `chatify:rl:${options.prefix}:`
        })
    });
};

// Strict limiter for auth routes — 10 attempts per 15 minutes
const authLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many login attempts, please try again in 15 minutes',
    prefix: 'auth'
});

// Message sending — 60 messages per minute per user
const messageLimiter = createLimiter({
    windowMs: 60 * 1000,
    max: 60,
    message: 'You are sending messages too fast, slow down',
    prefix: 'msg'
});

// Friend requests — 20 per hour
const friendRequestLimiter = createLimiter({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: 'Too many friend requests sent, try again later',
    prefix: 'friend'
});

// General API — 200 requests per minute
const generalLimiter = createLimiter({
    windowMs: 60 * 1000,
    max: 200,
    message: 'Too many requests, please slow down',
    prefix: 'general'
});

// File upload — 20 uploads per hour
const uploadLimiter = createLimiter({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: 'Too many file uploads, try again later',
    prefix: 'upload'
});

module.exports = {
    authLimiter,
    messageLimiter,
    friendRequestLimiter,
    generalLimiter,
    uploadLimiter
};