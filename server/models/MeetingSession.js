const mongoose = require('mongoose');

const MeetingSessionSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  startTime: {
    type: Date,
    default: Date.now,
  },
  endTime: {
    type: Date,
  },
  durationSeconds: {
    type: Number,
    default: 0,
  },
  participantCount: {
    type: Number,
    default: 1,
  },
  participants: [{
    username: String,
    speakingTimeSeconds: {
      type: Number,
      default: 0,
    }
  }]
});

module.exports = mongoose.model('MeetingSession', MeetingSessionSchema);
