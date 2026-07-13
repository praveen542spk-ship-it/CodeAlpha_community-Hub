const express = require('express');
const router = express.Router();

let GoogleGenAI;
try {
  const { GoogleGenAI: GenAI } = require('@google/generative-ai');
  GoogleGenAI = GenAI;
} catch (e) {
  console.log('@google/generative-ai package is not installed. AI Co-pilot will run in intelligent mock mode.');
}

router.post('/ask', async (req, res) => {
  const { question, transcript } = req.body;
  
  if (!transcript || transcript.length === 0) {
    return res.json({
      answer: "I haven't captured any conversation text yet. Please ensure Speech Captions are running and participants are speaking!"
    });
  }

  // 1. Try to use Google Gemini API if key is present
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && GoogleGenAI) {
    try {
      const genAI = new GoogleGenAI({ apiKey });
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const transcriptText = transcript.map(t => `[${t.sender}]: ${t.text}`).join('\n');
      const prompt = `You are a helpful AI Meeting Co-pilot. Below is the rolling transcript of the meeting:\n\n${transcriptText}\n\nUser Question: ${question}\n\nProvide a concise and helpful response based ONLY on the transcript. If the transcript is empty or irrelevant, politely inform the user.`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return res.json({ answer: response.text() });
    } catch (err) {
      console.error('Gemini API call failed, falling back to mock:', err.message);
    }
  }

  // 2. Intelligent Mock Rule-based fallback
  const cleanQuestion = question.toLowerCase();
  const transcriptText = transcript.map(t => `${t.sender}: ${t.text}`).join(' ');
  const participants = [...new Set(transcript.map(t => t.sender))];

  // Helper to extract sentences with keywords
  const extractActionItems = () => {
    const actionKeywords = ['todo', 'task', 'action', 'assign', 'deadline', 'need to', 'will do', 'complete', 'finish', 'by', 'tomorrow', 'fix'];
    const items = [];
    
    transcript.forEach(t => {
      const sentence = t.text;
      const lower = sentence.toLowerCase();
      const matchesKeyword = actionKeywords.some(kw => lower.includes(kw));
      if (matchesKeyword) {
        // Try to identify person assigned (default to sender or mentioned user)
        let assignee = t.sender;
        participants.forEach(p => {
          if (p !== t.sender && lower.includes(p.toLowerCase())) {
            assignee = p;
          }
        });
        
        // Parse simple deadline clues
        let deadline = 'No deadline specified';
        if (lower.includes('tomorrow')) deadline = 'Tomorrow';
        else if (lower.includes('today')) deadline = 'Today';
        else if (lower.includes('friday')) deadline = 'Friday';
        else if (lower.includes('monday')) deadline = 'Monday';
        else if (lower.includes('next week')) deadline = 'Next week';
        
        items.push({
          assignee,
          task: sentence.trim(),
          deadline
        });
      }
    });
    
    // Add default mock items if none found to show demo capacity
    if (items.length === 0) {
      items.push({
        assignee: participants[0] || 'User',
        task: 'Review meeting minutes and outline next steps',
        deadline: 'End of day'
      });
    }
    return items;
  };

  if (cleanQuestion.includes('summarize') || cleanQuestion.includes('summary')) {
    const summaryPoints = [];
    transcript.slice(-5).forEach(t => {
      summaryPoints.push(`- Discussed: "${t.text}" (stated by ${t.sender})`);
    });
    
    return res.json({
      answer: `Here is a summary of the latest discussion:\n\n` +
              `• Active Speakers: ${participants.join(', ')}\n` +
              `• Topics covered:\n${summaryPoints.join('\n')}\n\n` +
              `*Note: Operating in local offline helper mode.*`
    });
  }

  if (cleanQuestion.includes('miss') || cleanQuestion.includes('missed') || cleanQuestion.includes('what happened')) {
    const latestText = transcript.slice(-3).map(t => `"${t.text}" (${t.sender})`).join(', ');
    return res.json({
      answer: `While you were away, the group was discussing: ${latestText}.\n\n*Note: Operating in local offline helper mode.*`
    });
  }

  if (cleanQuestion.includes('action') || cleanQuestion.includes('task') || cleanQuestion.includes('todo')) {
    const items = extractActionItems();
    const formatted = items.map(item => `- **${item.assignee}**: ${item.task} (Deadline: *${item.deadline}*)`).join('\n');
    return res.json({
      answer: `Here are the identified action items:\n\n${formatted}\n\n*Note: Operating in local offline helper mode.*`
    });
  }

  // Generic responder
  return res.json({
    answer: `I am your AI Meeting Co-pilot. I processed ${transcript.length} speech segments from ${participants.length} speakers.\n\n` +
            `You asked: "${question}"\n\n` +
            `Latest statement recorded: "${transcript[transcript.length - 1].text}" from ${transcript[transcript.length - 1].sender}.\n\n` +
            `Configure GEMINI_API_KEY in the backend .env to enable full-power LLM answers!`
  });
});

module.exports = router;
