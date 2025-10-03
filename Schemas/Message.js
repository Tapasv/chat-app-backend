const mongoose = require('mongoose');
const User = require('./User');
const Group = require('./Group'); // New schema for group messages

const MessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For private chat
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' }, // For group chat
    text: { type: String },
    fileUrl: { type: String },
    fileName: { type: String },
    fileSize: { type: String },
    fileType: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', MessageSchema);
