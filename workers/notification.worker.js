const { Worker } = require('bullmq');
const { bullMQConnection } = require('../config/redis');
const sendEmail = require('../utils/sendEmail');
const userRepository = require('../repositories/user.repository');

let notificationWorker;

try {
    notificationWorker = new Worker('notifications', async (job) => {
        const { type, data } = job.data;

        console.log(`🔧 Processing job: ${type} (attempt ${job.attemptsMade + 1})`);

        if (type === 'offline_message_notification') {
            const { receiverId, senderUsername, messageText, timestamp } = data;

            const receiver = await userRepository.findById(receiverId, 'Email Username');
            if (!receiver || !receiver.Email) {
                console.log(`⚠️ No email found for user ${receiverId}, skipping`);
                return;
            }

            const html = `
                <h2>New message on Chatify</h2>
                <p>Hi ${receiver.Username},</p>
                <p><strong>${senderUsername}</strong> sent you a message:</p>
                <blockquote style="border-left: 3px solid #e50914; padding-left: 12px; color: #555;">
                    ${messageText}
                </blockquote>
                <p>Open Chatify to reply.</p>
                <small style="color: #999;">Received at ${new Date(timestamp).toLocaleString()}</small>
            `;

            await sendEmail(receiver.Email, `New message from ${senderUsername}`, html);
            console.log(`✅ Email notification sent to ${receiver.Email}`);
            return;
        }

        if (type === 'friend_request_notification') {
            const { receiverId, senderUsername } = data;

            const receiver = await userRepository.findById(receiverId, 'Email Username');
            if (!receiver || !receiver.Email) return;

            const html = `
                <h2>New friend request on Chatify</h2>
                <p>Hi ${receiver.Username},</p>
                <p><strong>${senderUsername}</strong> sent you a friend request.</p>
                <p>Open Chatify to accept or reject.</p>
            `;

            await sendEmail(receiver.Email, `Friend request from ${senderUsername}`, html);
            console.log(`✅ Friend request email sent to ${receiver.Email}`);
            return;
        }

        console.log(`⚠️ Unknown job type: ${type}`);

    }, {
        connection: bullMQConnection,
        concurrency: 5
    });

    notificationWorker.on('completed', (job) => {
        console.log(`✅ Job ${job.id} (${job.data.type}) completed`);
    });

    notificationWorker.on('failed', (job, err) => {
        console.error(`❌ Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`);
    });

    notificationWorker.on('error', (err) => {
        // Log but never crash the process — Redis blips shouldn't take down the server
        console.error('❌ Worker error:', err.message);
    });

} catch (err) {
    // Worker failed to initialize (e.g. Redis unreachable at startup)
    // Log and continue — core chat still works without email notifications
    console.error('❌ Notification worker failed to start:', err.message);
    notificationWorker = null;
}

module.exports = notificationWorker;