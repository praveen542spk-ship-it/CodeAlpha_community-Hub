const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// @route   GET api/stats/me
// @desc    Get user's XP, stats and unlockable badges
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Default values if undefined
    const meetings = user.meetingsAttended || 0;
    const speaking = user.speakingTimeSeconds || 0;
    const messages = user.messagesSentCount || 0;

    // Calculate XP
    const calculatedXP = (meetings * 50) + (messages * 5) + Math.floor(speaking / 6);
    user.xpPoints = calculatedXP;
    await user.save();

    // Compute badges
    const badges = [];
    if (meetings >= 3) {
      badges.push({
        id: 'punctual-pro',
        name: 'Punctual Pro',
        description: 'Attended 3 or more meetings on time 🕒',
        icon: '🕒'
      });
    }
    if (messages >= 10) {
      badges.push({
        id: 'active-contributor',
        name: 'Active Contributor',
        description: 'Sent 10 or more chat messages 💬',
        icon: '💬'
      });
    }
    if (speaking >= 120) {
      badges.push({
        id: 'eloquent-speaker',
        name: 'Eloquent Speaker',
        description: 'Spoke for more than 2 minutes in calls 🎙️',
        icon: '🎙️'
      });
    }

    res.json({
      xpPoints: calculatedXP,
      meetingsAttended: meetings,
      speakingTimeSeconds: speaking,
      messagesSentCount: messages,
      badges
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/stats/update
// @desc    Increment stats and compute new XP
// @access  Private
router.post('/update', auth, async (req, res) => {
  const { speakingTimeIncrement, messagesSentIncrement, meetingAttendedIncrement } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (speakingTimeIncrement) user.speakingTimeSeconds = (user.speakingTimeSeconds || 0) + speakingTimeIncrement;
    if (messagesSentIncrement) user.messagesSentCount = (user.messagesSentCount || 0) + messagesSentIncrement;
    if (meetingAttendedIncrement) user.meetingsAttended = (user.meetingsAttended || 0) + meetingAttendedIncrement;

    // Re-calculate XP
    user.xpPoints = (user.meetingsAttended * 50) + (user.messagesSentCount * 5) + Math.floor(user.speakingTimeSeconds / 6);

    await user.save();
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
