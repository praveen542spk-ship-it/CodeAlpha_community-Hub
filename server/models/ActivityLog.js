const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  event: {
    type: String,
    required: true,
    enum: ['join', 'leave', 'screen-share-start', 'screen-share-stop', 'file-share', 'lock-room', 'unlock-room']
  },
  details: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
