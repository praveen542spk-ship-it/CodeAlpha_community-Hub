const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const MeetingSession = require('../models/MeetingSession');
const User = require('../models/User');

// @route   GET api/analytics/summary
// @desc    Get user's summary metrics and daily sessions count
// @access  Private
router.get('/summary', auth, async (req, res) => {
  try {
    const sessions = await MeetingSession.find({ host: req.user.id });

    const totalMeetings = sessions.length;

    let totalDuration = 0;
    sessions.forEach(s => {
      totalDuration += s.durationSeconds || 0;
    });
    const avgDurationSeconds = totalMeetings > 0 ? Math.floor(totalDuration / totalMeetings) : 0;

    // Calculate active participants speaking time across all user's hosted sessions
    const speakerMap = {};
    sessions.forEach(s => {
      if (s.participants) {
        s.participants.forEach(p => {
          if (p.username !== req.user.username) {
            speakerMap[p.username] = (speakerMap[p.username] || 0) + (p.speakingTimeSeconds || 0);
          }
        });
      }
    });

    const activeParticipants = Object.keys(speakerMap).map(username => ({
      username,
      speakingTimeSeconds: speakerMap[username]
    })).sort((a, b) => b.speakingTimeSeconds - a.speakingTimeSeconds).slice(0, 5);

    // Group by day for Recharts chart (last 7 days of activity)
    const dailyMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyMap[dateStr] = 0;
    }

    sessions.forEach(s => {
      const dateStr = new Date(s.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dailyMap[dateStr] !== undefined) {
        dailyMap[dateStr] += 1;
      }
    });

    const chartData = Object.keys(dailyMap).map(date => ({
      date,
      meetings: dailyMap[date]
    }));

    res.json({
      totalMeetings,
      avgDurationSeconds,
      activeParticipants,
      chartData
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/analytics/history
// @desc    Get complete list of hosted meetings for CSV export
// @access  Private
router.get('/history', auth, async (req, res) => {
  try {
    const sessions = await MeetingSession.find({ host: req.user.id })
      .sort({ startTime: -1 });
    res.json(sessions);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/analytics/session/start
// @desc    Start/upsert a meeting session
// @access  Private
router.post('/session/start', auth, async (req, res) => {
  const { roomId } = req.body;
  try {
    let session = await MeetingSession.findOne({ roomId, endTime: null });
    if (!session) {
      session = new MeetingSession({
        roomId,
        host: req.user.id,
        startTime: new Date()
      });
      await session.save();
    }
    res.json(session);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/analytics/session/end
// @desc    End a meeting session
// @access  Private
router.post('/session/end', auth, async (req, res) => {
  const { roomId, participantsList } = req.body;
  try {
    const session = await MeetingSession.findOne({ roomId, endTime: null });
    if (session) {
      session.endTime = new Date();
      session.durationSeconds = Math.floor((session.endTime - session.startTime) / 1000);
      if (participantsList && Array.isArray(participantsList)) {
        session.participants = participantsList;
        session.participantCount = participantsList.length;
      }
      await session.save();
    }
    res.json(session);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
