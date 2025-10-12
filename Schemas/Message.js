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
    text: String, // Your main message field
    
    // File fields
    fileUrl: String,
    fileName: String,
    fileSize: Number,
    fileType: String,
    
    // Edit/Delete fields
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

module.exports = mongoose.model('Message', messageSchema);