const mongoose = require('mongoose');

const VideoMessageSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true
  },
  sender: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  isViewed: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('VideoMessage', VideoMessageSchema);
