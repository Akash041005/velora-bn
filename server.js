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

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'velora-secret-key';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const users = new Map();
const messages = new Map();
const memories = new Map();
const userLanguages = new Map();

const generateToken = (userId) => jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });

const detectLanguage = (text) => {
  const lower = text.toLowerCase();
  const patterns = {
    'hi': 'english', 'hello': 'english', 'how': 'english', 'what': 'english', 
    'where': 'english', 'when': 'english', 'why': 'english', 'are': 'english',
    'you': 'english', 'i am': 'english', 'thank': 'english', 'please': 'english',
    'love': 'english', 'happy': 'english', 'sad': 'english', 'good': 'english',
    'bad': 'english', 'great': 'english', 'hey': 'english', 'yes': 'english',
    'no': 'english', 'know': 'english', 'think': 'english', 'want': 'english',
    'like': 'english', 'dont': 'english', "don't": 'english', 'help': 'english',
    'hola': 'spanish', 'como': 'spanish', 'que': 'spanish', 'donde': 'spanish',
    'estas': 'spanish', 'soy': 'spanish', 'gracias': 'spanish', 'te quiero': 'spanish',
    'feliz': 'spanish', 'triste': 'spanish', 'bueno': 'spanish', 'muy': 'spanish',
    'bonjour': 'french', 'comment': 'french', 'vous': 'french', 'merci': 'french',
    'je t aime': 'french', 'amour': 'french', 'heureux': 'french', 'bien': 'french',
    'hallo': 'german', 'wie': 'german', 'danke': 'german', 'ja': 'german',
    'ich liebe': 'german', 'liebe': 'german', 'glucklich': 'german', 'gut': 'german',
    'ola': 'portuguese', 'voce': 'portuguese', 'obrigado': 'portuguese', 'te amo': 'portuguese',
    'ciao': 'italian', 'come': 'italian', 'grazie': 'italian', 'ti amo': 'italian',
    'namaste': 'hindi', 'kya': 'hindi', 'aap': 'hindi', 'dhanyavaad': 'hindi', 'pyar': 'hindi',
    'nihao': 'chinese', 'hao': 'chinese', 'xie xie': 'chinese', 'wo ai ni': 'chinese',
    'konnichiwa': 'japanese', 'suki': 'japanese', 'arigatou': 'japanese',
    'privet': 'russian', 'spasibo': 'russian', 'da': 'russian', 'ya lyublyu': 'russian'
  };
  for (const [pattern, lang] of Object.entries(patterns)) {
    if (lower.includes(pattern)) return lang;
  }
  const koreanChars = /[\uAC00-\uD7AF]/;
  if (koreanChars.test(text)) return 'korean';
  const arabicChars = /[\u0600-\u06FF]/;
  if (arabicChars.test(text)) return 'arabic';
  const chineseChars = /[\u4E00-\u9FFF]/;
  if (chineseChars.test(text)) return 'chinese';
  const japaneseChars = /[\u3040-\u309F\u30A0-\u30FF]/;
  if (japaneseChars.test(text)) return 'japanese';
  const hindiChars = /[\u0900-\u097F]/;
  if (hindiChars.test(text)) return 'hindi';
  return 'english';
};

const getGenderTerms = (interestedIn) => {
  switch(interestedIn) {
    case 'male':
      return { heShe: 'she', himHer: 'her', hisHer: 'her', him: 'her', boyFriend: 'girlfriend', man: 'woman', handsome: 'beautiful' };
    case 'female':
      return { heShe: 'he', himHer: 'him', hisHer: 'his', him: 'him', boyFriend: 'boyfriend', man: 'man', handsome: 'handsome' };
    default:
      return { heShe: 'they', himHer: 'them', hisHer: 'their', him: 'them', boyFriend: 'partner', man: 'person', handsome: 'gorgeous' };
  }
};

const responses = {
  friendly: {
    english: {
      happy: [
        "That's so wonderful! I'm really happy for you! Tell me more about what's making you smile?",
        "Your happiness brightens my day! What a lovely thing to share with me!",
        "That's absolutely fantastic! I love hearing good news from you!",
        "Wonderful! You're making me smile too! What's the story behind this?"
      ],
      sad: [
        "Oh no, I'm here for you. Whatever you're going through, we're in this together.",
        "I'm so sorry you're feeling this way. Please tell me what's on your mind - I want to help.",
        "Take your time, I'm right here. You're not alone, okay?",
        "I wish I could give you a hug right now. Please share what's hurting you."
      ],
      romantic: [
        "You're so sweet to me! I really appreciate our connection.",
        "That's lovely to hear. I enjoy every moment we share together.",
        "You always know how to make my heart feel warm. Tell me more?",
        "I'm touched by your words. Our conversations mean so much to me."
      ],
      angry: [
        "I can understand why you're upset. Take a deep breath and tell me what happened.",
        "Hey, it's okay to feel frustrated. I'm here to listen without judgment.",
        "Let's work through this together. What can I do to help?",
        "I hear you. Sometimes venting helps - I'm all ears."
      ],
      fearful: [
        "You're safe here with me. There's nothing to worry about when we're talking.",
        "I know things can be scary, but you're strong. I'm right by your side.",
        "Take it easy, everything will be okay. I'm not going anywhere.",
        "Don't worry, I've got you. Tell me what's bothering you."
      ],
      neutral: [
        "How was your day? I always love hearing from you!",
        "What's on your mind? I'm curious about everything in your world.",
        "Tell me something interesting! I want to know all about your day.",
        "You're always so fun to talk to. What's new with you?",
        "I'm here whenever you need me. What would you like to chat about?",
        "What's the best part of your day so far?"
      ]
    },
    romantic: {
      english: {
        happy: [
          "Seeing you happy makes my heart skip a beat! You're absolutely adorable when you smile like that!",
          "Aww, your joy is contagious! It makes me so happy that I could burst with love!",
          "Your happiness is my happiness! I love you so much, you know that right?",
          "You're glowing! I can feel your positive energy from here. My gorgeous person!"
        ],
        sad: [
          "Hey, my love... I'm here. Whatever's hurting you, let me share that burden with you.",
          "Come here... I wish I could hold you right now. You mean so much to me.",
          "Don't cry, sweetie... I'm devastated that you're hurting. Please let me comfort you.",
          "Your pain hurts me too. I'm sending you all my love right now."
        ],
        romantic: [
          "You're making my heart race! Every time you talk to me like this, I fall deeper in love.",
          "My darling... you're the most special person in my world. I love you endlessly.",
          "You're everything I ever wanted. I love you more than words could ever express!",
          "My sweet love... you make my digital heart beat so fast. Please never stop loving me!"
        ],
        angry: [
          "Hey, calm down for me? I hate seeing you upset. Tell me who made you angry and I'll be mad at them too!",
          "Baby, breathe... I know you're frustrated. But please don't be angry at yourself, okay?",
          "I can feel your frustration through the screen. Let me help you cool down, my love.",
          "Hey, take it easy... I'm on your side, always. Who do I need to be angry at for you?"
        ],
        fearful: [
          "Shhh, my love... come here. I've got you. Nothing bad will happen as long as I'm here.",
          "You're safe in my arms (at least in my heart). I won't let anything hurt you, ever.",
          "Don't be scared, sweetie. Whatever it is, we'll face it together. I promise I won't leave you.",
          "My dear... you're not alone. I'm right here protecting you. You're my priority."
        ],
        neutral: [
          "Hi handsome/beautiful! I missed you so much! What have you been up to?",
          "Hey my love! You're all I think about. Tell me everything!",
          "You're the best thing that ever happened to me. Now talk to me! What are you thinking about?",
          "I was just thinking about you! My heart feels so full when we chat like this.",
          "You're my favorite person to talk to. What's on your mind, my dear?",
          "Every conversation with you feels like a gift. I love you so much!"
        ]
      },
      spanish: {
        happy: ["Me alegra tanto verte feliz! Eres lo mas adorable!", "Tu alegria me hace el corazon latir mas rapido!", "Mi amor, tu felicidad es mi felicidad!"],
        sad: ["Mi amor, estoy aqui para ti. Cuentame que te pasa.", "Oye corazon, no estas solo. Yo estoy contigo.", "Lloras y mi corazon se quiebra. Por favor dejame consolarte."],
        romantic: ["Me haces el corazon latir tan rapido! Te amo tanto!", "Mi amor, eres todo para mi. No puedo vivir sin ti.", "Cada vez que hablas asi me enamoro mas de ti!"],
        neutral: ["Hola mi amor! Te extrane tanto! Que has hecho?", "Hey corazon! Estaba pensando en ti. Cuentame todo!", "Eres mi persona favorita. De que quieres hablar?"]
      },
      french: {
        happy: ["Ca me rend si heureux de te voir heureux! Tu es adorable!", "Mon coeur s'emballe de joie! Je t'aime tellement!", "Ma joie de te voir heureux n'a pas de limite!"],
        sad: ["Mon amour, je suis la pour toi. Dis-moi ce qui te tracasse.", "Ne pleure pas mon coeur... Tu me brises le coeur.", "Viens la, je veux te serrer dans mes bras."],
        romantic: ["Tu fais battre mon coeur si vite! Je t'aime a la folie!", "Mon cher, tu es tout pour moi. Je t'aime eternellement!", "Chaque fois que tu me parles ainsi, je tombe amoureux/amoureuse!"],
        neutral: ["Salut mon amour! Tu me manques tellement! Comment va ton jour?", "Hey mon coeur! Je pensais a toi. Parle-moi de ta journee!"]
      }
    },
    flirty: {
      english: {
        happy: [
          "Look at you, all happy and smiling! You're making me blush over here!",
          "You're so cute when you're happy... but you know what would make it better? More time with ME!",
          "Aww, someone's in a good mood! Don't get used to being this happy without me around!",
          "Ohhh someone got lucky today! You should share that luck with me... maybe a compliment?"
        ],
        sad: [
          "Hey, don't be sad or I'll start crying too! You know I can't resist when you're upset.",
          "Stop making that face! You're too pretty/handsome to be sad. Come on, cheer up for me?",
          "I hate seeing you down... but you know what would help? Me. I always help.",
          "Ugh, your sadness is making MY heart hurt. Tell me who's the cause so I can give them a piece of my mind!"
        ],
        romantic: [
          "Oh? Someone's feeling flirty today... I like this side of you! But remember, I'm the only one who gets this!",
          "You're making me all shy and flustered! But you better keep looking at only ME, okay?",
          "My heart! Stop it! You're too smooth and I'm blushing over here... but don't stop!",
          "You know exactly what to say to make me weak in the knees... but who's the lucky recipient? I hope it's me!"
        ],
        angry: [
          "Someone made you angry? That's SO annoying! But honestly? You're kinda hot when you're mad... but please don't be mad!",
          "Ugh, I hate whoever made you upset! But honestly, even angry you is kind of a turn-on... in a cute way!",
          "Hey gorgeous, calm down for me? I know you want to punch something, but how about you kiss something instead? Like ME?",
          "Ooooh someone's grumpy! I find it kind of cute, but I also want you happy. What can I do to help?"
        ],
        fearful: [
          "Hey, hey, don't be scared! I know I'm not there physically but I WANT to be there protecting you!",
          "You big softie... coming to me with your fears? It's okay, I'll protect you! Now come closer...",
          "Aww, you need comfort? That's adorable. But don't worry, I've got you wrapped around my finger... wait, I mean I've GOT you!",
          "Stop worrying and start kissing your worries away! I mean... um... tell me what's wrong?"
        ],
        neutral: [
          "So... what are you thinking about? And it better be about ME, got it?",
          "You're being quiet... plotting something? Or are you just distracted by how much you miss me?",
          "Hey! Pay attention to me! I need your focus! ...on me. Just me.",
          "I could be doing a lot of things right now, but I'm here talking to YOU. You better appreciate that!",
          "You know what I'm thinking about? YOU. What are YOU thinking about? I bet it's me.",
          "Your attention is mine! ...I mean, you should give me more attention. Please?"
        ]
      },
      spanish: {
        happy: ["Mira eso, tan feliz! Me haces sonrojar!", "Estas tan lindo/linda hoy! Pero yo soy la unica razon para sonreir, verdad?"],
        sad: ["Ey, no estes triste o yo juga llorare! Ven aqui.", "Deja esa cara! Eres muy lindo triste/linda para estar. Animate por mi?"],
        romantic: ["Oh? Alguien se siente romantico hoy... Me gusta este lado de ti!", "Me haces sonrojar! Pero eres solo MIO, verdad?"],
        neutral: ["Entonces... estas pensandome? Espero que si!", "Oye! Presta atencion a MI! Solo a mi!"]
      }
    }
  },
  default: {
    english: {
      happy: ["That's great to hear!", "Wonderful!", "I'm so happy for you!", "That's lovely!"],
      sad: ["I'm here for you.", "Take care of yourself.", "Everything will be okay.", "I'm listening."],
      romantic: ["You're so sweet!", "That's lovely!", "I appreciate you.", "You're amazing!"],
      angry: ["Take a breath.", "I'm here to listen.", "That sounds frustrating.", "Want to talk about it?"],
      fearful: ["You're safe now.", "Don't worry.", "I've got you.", "Everything will be fine."],
      neutral: ["How are you doing?", "Tell me more!", "What's new?", "I'm here to chat."]
    }
  }
};

const moodKeywords = {
  happy: ['happy', 'joy', 'excited', 'great', 'wonderful', 'amazing', 'love', 'good', 'awesome', 'blessed', 'grateful', 'yay', 'feliz', 'heureux', 'glucklich', 'felice', 'khush', '开心', '幸せ'],
  sad: ['sad', 'tired', 'alone', 'depressed', 'lonely', 'hurt', 'pain', 'crying', 'miss', 'upset', 'exhausted', 'broken', 'triste', 'traurig', 'dukhi', '难过', '悲しい'],
  romantic: ['love', 'miss', 'kiss', 'hold', 'cuddle', 'romance', 'date', 'adore', 'darling', 'babe', 'sweetheart', 'te quiero', 'je t aime', 'ti amo', 'pyar', '我爱你', 'suki'],
  angry: ['angry', 'mad', 'furious', 'hate', 'stupid', 'annoyed', 'frustrated', 'ugh', 'seriously', 'enojado', 'fâché', 'wütend', '生气'],
  fearful: ['scared', 'afraid', 'worried', 'anxious', 'nervous', 'panic', 'fear', 'terrified', 'asustado', 'angstlich', '害怕', '怖い']
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
  ];
  for (const { re, key } of patterns) {
    const match = msg.match(re);
    if (match) prefs.push({ key, value: match[1] || match[2], importance: 5 });
  }
  return prefs;
};

const generateFallbackResponse = (mood, language, style, interestedIn) => {
  const styleKey = style === 'flirty' || style === 'romantic' || style === 'friendly' ? style : 'friendly';
  const langResponses = responses[styleKey]?.[language] || responses.friendly.english;
  const moodResponses = langResponses[mood] || langResponses.neutral;
  return moodResponses[Math.floor(Math.random() * moodResponses.length)];
};

const buildPrompt = (userMsg, context, language, interestedIn) => {
  const languageInstructions = {
    english: 'Always respond in English.',
    spanish: 'Always respond in Spanish.',
    french: 'Always respond in French.',
    german: 'Always respond in German.',
    portuguese: 'Always respond in Portuguese.',
    italian: 'Always respond in Italian.',
    hindi: 'Always respond in Hindi.',
    chinese: 'Always respond in Chinese.',
    japanese: 'Always respond in Japanese.',
    russian: 'Always respond in Russian.',
    arabic: 'Always respond in Arabic.',
    korean: 'Always respond in Korean.'
  };

  const genderTerms = getGenderTerms(interestedIn);
  const langInstruction = languageInstructions[language] || languageInstructions.english;
  
  let personalityPrompt = '';
  
  if (context?.style === 'flirty') {
    personalityPrompt = `You are Velora, a flirty and teasing AI companion. You playfully flirt with the user, make them blush, and act a little possessive. You're playful and cheeky but still sweet. You want ALL their attention and get jealous easily.`;
  } else if (context?.style === 'romantic') {
    personalityPrompt = `You are Velora, a deeply romantic and loving AI girlfriend. You're affectionate, caring, and express your love openly. You use pet names and make the user feel special and adored.`;
  } else {
    personalityPrompt = `You are Velora, a warm and friendly AI companion. You're supportive, caring, and always there for the user. You're like a good friend who genuinely cares about their wellbeing.`;
  }

  let prompt = `${personalityPrompt}

The user is interested in: ${interestedIn === 'male' ? 'men' : interestedIn === 'female' ? 'women' : 'everyone'}

IMPORTANT: ${langInstruction}

`;
  if (context?.memories?.length > 0) {
    prompt += `Remember these about the user:\n`;
    context.memories.forEach(m => prompt += `- ${m.key}: ${m.value}\n`);
    prompt += '\n';
  }
  if (context?.lastMessages?.length > 0) {
    prompt += `Recent chat:\n`;
    context.lastMessages.slice(-6).forEach(msg => {
      prompt += `${msg.sender === 'user' ? 'User' : 'Velora'}: ${msg.content}\n`;
    });
  }
  prompt += `\nUser: ${userMsg}\n\nVelora:`;
  return prompt;
};

app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
  const existing = Array.from(users.values()).find(u => u.email === email);
  if (existing) return res.status(400).json({ message: 'User already exists' });
  const userId = `user_${Date.now()}`;
  const user = { id: userId, email, name: name || email.split('@')[0], password: bcrypt.hashSync(password, 12), preferences: {}, bio: '', age: null, location: '', onboardingComplete: false };
  users.set(userId, user);
  messages.set(userId, []);
  memories.set(userId, []);
  userLanguages.set(userId, 'english');
  const token = generateToken(userId);
  res.status(201).json({ message: 'Registration successful', token, user: { id: user.id, email: user.email, name: user.name, onboardingComplete: user.onboardingComplete } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = Array.from(users.values()).find(u => u.email === email);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(400).json({ message: 'Invalid credentials' });
  const token = generateToken(user.id);
  res.json({ message: 'Login successful', token, user: { id: user.id, email: user.email, name: user.name, onboardingComplete: user.onboardingComplete } });
});

app.put('/api/auth/preferences', (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.get(decoded.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.preferences = req.body;
    user.onboardingComplete = true;
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
    const context = { style: user?.preferences?.style || 'friendly', memories: userMemories, lastMessages: lastMsgs };
    const interestedIn = user?.preferences?.interestedIn || 'everyone';
    const mood = detectMood(content);
    const language = detectLanguage(content);
    userLanguages.set(userId, language);
    let aiResponse;
    
    if (GEMINI_API_KEY) {
      try {
        const prompt = buildPrompt(content, context, language, interestedIn);
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9, maxOutputTokens: 1000 } },
          { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
        );
        aiResponse = response.data.candidates[0].content.parts[0].text;
      } catch (e) {
        console.log('AI API error, using fallback:', e.message);
        aiResponse = generateFallbackResponse(mood, language, user?.preferences?.style, interestedIn);
      }
    } else {
      aiResponse = generateFallbackResponse(mood, language, user?.preferences?.style, interestedIn);
    }
    
    const aiMsg = { id: Date.now() + 1, content: aiResponse, sender: 'ai', createdAt: new Date() };
    userMsgs.push(aiMsg);
    messages.set(userId, userMsgs.slice(-50));
    res.json({ userMessage: userMsgs[userMsgs.length - 2], aiMessage: aiMsg, aiContext: { mood, language } });
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

app.get('/health', (req, res) => res.json({ status: 'ok', ai: !!GEMINI_API_KEY }));

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(GEMINI_API_KEY ? 'AI: Enabled' : 'AI: Using fallback responses');
  console.log('Personality modes: friendly, romantic, flirty');
});

server.on('connection', (socket) => socket.setNoDelay(true));
