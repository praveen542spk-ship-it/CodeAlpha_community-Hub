const mongoose = require('mongoose');

const FatigueTrackerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: String, // format YYYY-MM-DD
    required: true
  },
  totalMinutes: {
    type: Number,
    default: 0
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure one record per user per day
FatigueTrackerSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('FatigueTracker', FatigueTrackerSchema);
