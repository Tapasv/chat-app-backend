const Redis = require('ioredis');
const logger = require('../utils/logger');

const createClient = (options = {}) => new Redis(process.env.REDIS_URL, {
    retryStrategy(times) {
        return Math.min(times * 50, 2000);
    },
    reconnectOnError() {
        return true;
    },
    ...options
});

const redis = createClient({ maxRetriesPerRequest: 3 });
const pubClient = createClient({ maxRetriesPerRequest: 3 });
const subClient = createClient({ maxRetriesPerRequest: 3 });
const bullMQConnection = createClient({ maxRetriesPerRequest: null });

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error(`Redis error: ${err.message}`));
redis.on('reconnecting', () => logger.warn('Redis reconnecting...'));

module.exports = { redis, pubClient, subClient, bullMQConnection };