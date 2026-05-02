const { Queue } = require('bullmq');
const { bullMQConnection } = require('../config/redis');

const notificationQueue = new Queue('notifications', {
    connection: bullMQConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000
        },
        removeOnComplete: 100,
        removeOnFail: 500
    }
});

module.exports = notificationQueue;