const Redis = require('ioredis');
const logger = require('../utils/logger');

const createClient = (options = {}) => {
    const url = process.env.REDIS_URL;
    if (!url) {
        console.error('FATAL: REDIS_URL is not set');
        process.exit(1);
    }

    const client = new Redis(url, {
        retryStrategy(times) {
            if (times > 10) return null;
            return Math.min(times * 50, 2000);
        },
        reconnectOnError() {
            return true;
        },
        ...options
    });

    client.on('error', (err) => {
        console.error(`Redis client error: ${err.message}`);
    });

    return client;
};

// Created immediately — used by socket.io adapter at startup
const redis = createClient({ maxRetriesPerRequest: 3 });
const pubClient = createClient({ maxRetriesPerRequest: 3 });
const subClient = createClient({ maxRetriesPerRequest: 3 });

redis.on('connect', () => logger.info('Redis connected'));
redis.on('reconnecting', () => logger.warn('Redis reconnecting...'));

// bullMQConnection uses a lazy getter — only instantiated on first access.
// This permanently breaks the circular dependency caused by:
//   server.js → socket/index.js → config/redis.js (not finished yet)
//                               → queues/ → config/redis.js (circular!)
//                               → workers/ → config/redis.js (circular!)
// The getter ensures bullMQConnection is only created after redis.js fully loads.
let _bullMQConnection = null;

module.exports = {
    redis,
    pubClient,
    subClient,
    get bullMQConnection() {
        if (!_bullMQConnection) {
            _bullMQConnection = createClient({ maxRetriesPerRequest: null });
        }
        return _bullMQConnection;
    }
};