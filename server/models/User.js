const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  xpPoints: {
    type: Number,
    default: 0,
  },
  meetingsAttended: {
    type: Number,
    default: 0,
  },
  speakingTimeSeconds: {
    type: Number,
    default: 0,
  },
  messagesSentCount: {
    type: Number,
    default: 0,
  }
});

module.exports = mongoose.model('User', UserSchema);
