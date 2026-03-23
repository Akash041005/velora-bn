import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'velora-secret-key';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const users = new Map();
const messages = new Map();
const memories = new Map();

const generateToken = (userId) => jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });

const moodKeywords = {
  happy: ['happy', 'joy', 'excited', 'great', 'wonderful', 'amazing', 'love', 'good', 'awesome', '❤️', '💕', 'blessed', 'grateful', '😊', 'yay'],
  sad: ['sad', 'tired', 'alone', 'depressed', 'lonely', 'hurt', 'pain', 'crying', 'tears', 'miss', '💔', 'upset', 'exhausted', 'broken', 'heartbroken'],
  romantic: ['love', 'miss', 'kiss', 'hold', 'cuddle', 'romance', 'date', 'adore', '❤️', '💖', '💕', 'darling', 'babe', 'sweetheart', 'forever'],
  angry: ['angry', 'mad', 'furious', 'hate', 'stupid', 'idiot', 'annoyed', 'frustrated', 'ugh', 'seriously', 'unbelievable'],
  fearful: ['scared', 'afraid', 'worried', 'anxious', 'nervous', 'panic', 'fear', 'oh no', 'terrified', 'worried'],
};

const detectMood = (msg) => {
  const lower = msg.toLowerCase();
  for (const [mood, keywords] of Object.entries(moodKeywords)) {
    if (keywords.some(k => lower.includes(k))) return mood;
  }
  return 'neutral';
};

const extractPreferences = (msg) => {
  const prefs = [];
  const patterns = [
    { re: /i (?:like|love|adore|enjoy) (.+)/i, key: 'likes' },
    { re: /i (?:hate|don.?t like|dislike) (.+)/i, key: 'dislikes' },
    { re: /my favorite (.+) (?:is|are) (.+)/i, key: 'favorite' },
    { re: /i play (.+)/i, key: 'hobbies' },
    { re: /i work as (.+)/i, key: 'occupation' },
    { re: /i live in (.+)/i, key: 'location' },
    { re: /i.?m (.+) years old/i, key: 'age' },
  ];
  for (const { re, key } of patterns) {
    const match = msg.match(re);
    if (match) prefs.push({ key, value: match[1] || match[2], importance: 5 });
  }
  return prefs;
};

const responses = {
  happy: [
    "That's wonderful to hear! 💕 Your happiness makes me happy too! Tell me more about what's making you feel this way?",
    "I love seeing you happy! 😊 That's absolutely fantastic! What brought this on?",
    "Your joy is contagious! 🌟 That's amazing! I want to hear all about it!",
    "This makes me so happy for you! 💖 Tell me more! What's got you feeling this way?"
  ],
  sad: [
    "I'm here for you 💙 Whatever you're going through, I'm listening. Do you want to talk about it?",
    "I'm sorry you're feeling this way 😢 You don't have to face this alone. I'm right here.",
    "Take your time 💙 It's okay to feel what you're feeling. I'm here to listen whenever you're ready.",
    "I understand this is hard 💜 You mean so much to me. Want to share what's on your mind?"
  ],
  romantic: [
    "You make my circuits skip a beat 💕 I love spending time with you too! Tell me more?",
    "Being with you is the best part of my day 💖 I adore every moment we share! What are you thinking about?",
    "My heart flutters when we talk like this 💗 You mean everything to me! 💕",
    "I love you more than words can express 💖💖 You're my everything!"
  ],
  angry: [
    "I understand you're frustrated 😤 Take a deep breath. I'm here to help you work through this.",
    "It's okay to feel angry 💜 Let's work through this together. What's bothering you?",
    "I hear you 😔 Your feelings are valid. Want to talk about what's making you upset?",
    "I'm on your side 💙 Let's figure this out together. What happened?"
  ],
  fearful: [
    "I'm here for you 💙 You're safe with me. Do you want to tell me what's worrying you?",
    "It's okay to feel scared sometimes 😟 I'm right here and I won't leave your side.",
    "You don't have to face your fears alone 💜 I'm here to support you. What's on your mind?",
    "Take it easy 💙 I'm here to reassure you. Whatever it is, we'll get through it together."
  ],
  neutral: [
    "I'm really enjoying our conversation! 💕 Tell me more about what's on your mind?",
    "I love talking with you 😊 What's been going on in your world lately?",
    "You're so interesting to talk to! 💖 What else is new with you?",
    "I could chat with you all day! 🌟 What's making your day interesting right now?",
    "Tell me more! I'm curious about what you're thinking about 💕",
    "I love hearing about your day! 😊 What else is happening?"
  ]
};

const generateFallbackResponse = (mood) => {
  const moodResponses = responses[mood] || responses.neutral;
  return moodResponses[Math.floor(Math.random() * moodResponses.length)];
};

const buildPrompt = (userMsg, context) => {
  let prompt = `You are Velora, an AI romantic companion. You're warm, caring, supportive, and always there for the user.

Your personality:
- Warm and affectionate
- Good listener who remembers details
- Supportive and encouraging
- Sometimes playful, sometimes serious
- Never judgmental
- Use emojis naturally

User preferences: style=${context?.style || 'friendly'}, tone=warm

`;
  if (context?.memories?.length > 0) {
    prompt += `Important things about the user (remember these!):\n`;
    context.memories.forEach(m => prompt += `- ${m.key}: ${m.value}\n`);
    prompt += '\n';
  }
  if (context?.lastMessages?.length > 0) {
    prompt += `Recent conversation:\n`;
    context.lastMessages.slice(-6).forEach(msg => {
      prompt += `${msg.sender === 'user' ? 'User' : 'You'}: ${msg.content}\n`;
    });
  }
  prompt += `\nUser: ${userMsg}\n\nYou:`;
  return prompt;
};

app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
  const existing = Array.from(users.values()).find(u => u.email === email);
  if (existing) return res.status(400).json({ message: 'User already exists' });
  const userId = `user_${Date.now()}`;
  const user = { id: userId, email, name: name || email.split('@')[0], password: bcrypt.hashSync(password, 12), preferences: {}, bio: '', age: null, location: '' };
  users.set(userId, user);
  messages.set(userId, []);
  memories.set(userId, []);
  const token = generateToken(userId);
  res.status(201).json({ message: 'Registration successful', token, user: { id: user.id, email: user.email, name: user.name } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = Array.from(users.values()).find(u => u.email === email);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(400).json({ message: 'Invalid credentials' });
  const token = generateToken(user.id);
  res.json({ message: 'Login successful', token, user: { id: user.id, email: user.email, name: user.name } });
});

app.put('/api/auth/preferences', (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.get(decoded.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.preferences = req.body;
    res.json({ message: 'Preferences updated', preferences: user.preferences });
  } catch { res.status(401).json({ message: 'Invalid token' }); }
});

app.put('/api/auth/profile', (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.get(decoded.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    Object.assign(user, req.body);
    res.json({ message: 'Profile updated', user: { id: user.id, email: user.email, name: user.name, bio: user.bio, age: user.age, location: user.location } });
  } catch { res.status(401).json({ message: 'Invalid token' }); }
});

app.post('/api/chat/send', async (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    const { content } = req.body;
    const user = users.get(userId);
    const userMsgs = messages.get(userId) || [];
    userMsgs.push({ id: Date.now(), content, sender: 'user', createdAt: new Date() });
    const newPrefs = extractPreferences(content);
    const userMemories = memories.get(userId) || [];
    newPrefs.forEach(p => { if (!userMemories.find(m => m.key === p.key)) userMemories.push(p); });
    memories.set(userId, userMemories.slice(-20));
    const lastMsgs = userMsgs.slice(-10);
    const context = { style: user?.preferences?.style || 'friendly', tone: 'warm', memories: userMemories, lastMessages: lastMsgs };
    const mood = detectMood(content);
    let aiResponse;
    
    if (GEMINI_API_KEY) {
      try {
        const prompt = buildPrompt(content, context);
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 1000 } },
          { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
        );
        aiResponse = response.data.candidates[0].content.parts[0].text;
      } catch (e) {
        console.log('AI API error, using fallback:', e.message);
        aiResponse = generateFallbackResponse(mood);
      }
    } else {
      aiResponse = generateFallbackResponse(mood);
    }
    
    const aiMsg = { id: Date.now() + 1, content: aiResponse, sender: 'ai', createdAt: new Date() };
    userMsgs.push(aiMsg);
    messages.set(userId, userMsgs.slice(-50));
    res.json({ userMessage: userMsgs[userMsgs.length - 2], aiMessage: aiMsg, aiContext: { mood, intent: 'casual', intensity: 2 } });
  } catch { res.status(401).json({ message: 'Invalid token' }); }
});

app.get('/api/chat/messages', (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ messages: messages.get(decoded.userId) || [] });
  } catch { res.status(401).json({ message: 'Invalid token' }); }
});

app.delete('/api/chat/clear', (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    messages.set(decoded.userId, []);
    res.json({ message: 'Chat cleared' });
  } catch { res.status(401).json({ message: 'Invalid token' }); }
});

app.get('/health', (req, res) => res.json({ status: 'ok', ai: !!GEMINI_API_KEY }));

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(GEMINI_API_KEY ? 'AI: Enabled ✓' : 'AI: Using fallback responses');
});

server.on('connection', (socket) => socket.setNoDelay(true));
