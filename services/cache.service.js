const { redis } = require('../config/redis');

const CACHE_TTL = 300; // 5 minutes
const ONLINE_USERS_KEY = 'chatify:online_users';
const PENDING_NOTIF_PREFIX = 'chatify:pending_notif:';
const MESSAGE_CACHE_PREFIX = 'chatify:messages:';

const cacheService = {

    // ─── Message Caching ───────────────────────────────────────────

    getCachedConversation: async (userAId, userBId) => {
        const key = MESSAGE_CACHE_PREFIX + [userAId, userBId].sort().join(':');
        const cached = await redis.get(key);
        return cached ? JSON.parse(cached) : null;
    },

    setCachedConversation: async (userAId, userBId, messages) => {
        const key = MESSAGE_CACHE_PREFIX + [userAId, userBId].sort().join(':');
        await redis.setex(key, CACHE_TTL, JSON.stringify(messages));
    },

    invalidateConversation: async (userAId, userBId) => {
        const key = MESSAGE_CACHE_PREFIX + [userAId, userBId].sort().join(':');
        await redis.del(key);
    },

    // ─── Online User Tracking ──────────────────────────────────────

    setUserOnline: async (userId, socketId) => {
        await redis.hset(ONLINE_USERS_KEY, userId, socketId);
    },

    setUserOffline: async (userId) => {
        await redis.hdel(ONLINE_USERS_KEY, userId);
    },

    getSocketId: async (userId) => {
        return redis.hget(ONLINE_USERS_KEY, userId);
    },

    getAllOnlineUsers: async () => {
        const data = await redis.hgetall(ONLINE_USERS_KEY);
        return data ? Object.keys(data) : [];
    },

    getAllOnlineUsersMap: async () => {
        const data = await redis.hgetall(ONLINE_USERS_KEY);
        return data || {};
    },

    // ─── Pending Notifications ─────────────────────────────────────

    addPendingNotification: async (userId, notification) => {
        const key = PENDING_NOTIF_PREFIX + userId;
        await redis.rpush(key, JSON.stringify(notification));
        await redis.expire(key, 60 * 60 * 24); // expire after 24 hours
    },

    getPendingNotifications: async (userId) => {
        const key = PENDING_NOTIF_PREFIX + userId;
        const notifications = await redis.lrange(key, 0, -1);
        return notifications.map(n => JSON.parse(n));
    },

    clearPendingNotifications: async (userId) => {
        const key = PENDING_NOTIF_PREFIX + userId;
        await redis.del(key);
    }
};

module.exports = cacheService;