const mongoose = require('mongoose');

const FriendRequestSchema = new mongoose.Schema(
    {
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        receiver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'rejected'],
            default: 'pending'
        }
    },
    { timestamps: true }
);

// Speeds up findPendingRequest check
FriendRequestSchema.index({ sender: 1, receiver: 1, status: 1 });

// Speeds up received requests fetch
FriendRequestSchema.index({ receiver: 1, status: 1, createdAt: -1 });

// Speeds up sent requests fetch
FriendRequestSchema.index({ sender: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('FriendRequest', FriendRequestSchema);