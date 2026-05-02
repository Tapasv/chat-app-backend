const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
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
    text: String,
    fileUrl: String,
    fileName: String,
    fileSize: Number,
    fileType: String,
    isEdited: {
        type: Boolean,
        default: false
    },
    editedAt: Date,
    deletedFor: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    deletedForEveryone: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Most critical index — speeds up conversation fetch
messageSchema.index({ sender: 1, receiver: 1, createdAt: 1 });

// For fetching all messages involving a user
messageSchema.index({ receiver: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);