const notificationQueue = require('../queues/notification.queue');

const notificationService = {

    queueOfflineMessageNotification: async ({ receiverId, senderUsername, messageText, timestamp }) => {
        await notificationQueue.add('offline_message_notification', {
            type: 'offline_message_notification',
            data: { receiverId, senderUsername, messageText, timestamp }
        });
    },

    queueFriendRequestNotification: async ({ receiverId, senderUsername }) => {
        await notificationQueue.add('friend_request_notification', {
            type: 'friend_request_notification',
            data: { receiverId, senderUsername }
        });
    }
};

module.exports = notificationService;