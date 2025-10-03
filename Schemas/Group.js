const mongoose = require('mongoose');
const User = require('./User');

const GroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Group', GroupSchema);
