const moodKeywords = {
  happy: ['happy', 'joy', 'excited', 'great', 'wonderful', 'amazing', 'love', 'good', 'best', 'awesome', 'fantastic', 'yay', '😊', '❤️', '💕', 'blessed', 'grateful', 'thankful', 'celebrating'],
  sad: ['sad', 'tired', 'alone', 'depressed', 'lonely', 'hurt', 'pain', 'crying', 'tears', 'miss', 'missing', 'breakup', 'broke', 'heartbroken', '😢', '💔', 'upset', 'down', 'feeling low', 'exhausted', 'drained'],
  romantic: ['love', 'miss', 'kiss', 'hold', 'touch', 'cuddle', 'romance', 'date', 'dating', 'crush', 'adore', 'treasure', 'beloved', ' sweetheart', 'babe', 'baby', 'darling', 'honey', '💖', '💗', '💘', '💋'],
  angry: ['angry', 'mad', 'furious', 'hate', 'stupid', 'idiot', 'annoyed', 'frustrated', 'irritated', 'rage', '😠', '😡', 'ugh', 'seriously', 'can\'t believe', 'unbelievable'],
  fearful: ['scared', 'afraid', 'worried', 'anxious', 'nervous', 'panic', 'fear', 'terror', 'dread', 'oh no', '😨', '😰', 'terrified', 'horrified'],
};

const intentPatterns = {
  greeting: ['hi', 'hello', 'hey', 'hiya', 'good morning', 'good evening', 'good night', 'what\'s up', 'sup', 'howdy', 'yo'],
  romantic: ['i love you', 'i miss you', 'i love', 'miss you', 'be my', 'want you', 'need you', 'thinking of you', 'love you', '❤️', '💕'],
  casual: ['how are you', 'what do you', 'tell me about', 'what\'s new', 'how\'s it going', 'how was your day', 'any plans', 'wanna chat', 'hang out'],
  question: ['what', 'how', 'why', 'when', 'where', 'who', 'which', '?', 'can you', 'could you', 'do you think', 'is it'],
  emotional: ['i feel', 'i\'m feeling', 'i\'ve been', 'help me', 'i need', 'support', 'advice', 'listen', 'tell someone', 'venting', 'ugh', 'so frustrated'],
};

export const detectMood = (message) => {
  if (!message) return 'neutral';
  
  const lowerMessage = message.toLowerCase();
  let scores = { happy: 0, sad: 0, romantic: 0, angry: 0, fearful: 0, neutral: 10 };
  
  for (const [mood, keywords] of Object.entries(moodKeywords)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        scores[mood] += 1;
      }
    }
  }
  
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore <= 1) return 'neutral';
  
  const dominantMood = Object.keys(scores).find(mood => scores[mood] === maxScore);
  return dominantMood;
};

export const detectIntent = (message) => {
  if (!message) return 'casual';
  
  const lowerMessage = message.toLowerCase();
  let scores = { greeting: 0, romantic: 0, casual: 0, question: 0, emotional: 0 };
  
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    for (const pattern of patterns) {
      if (lowerMessage.includes(pattern)) {
        scores[intent] += 1;
      }
    }
  }
  
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'casual';
  
  return Object.keys(scores).find(intent => scores[intent] === maxScore);
};

export const updateIntensity = (prevIntensity, message) => {
  const lowerMessage = message.toLowerCase();
  
  const increaseTriggers = [
    'love', 'miss', 'kiss', 'romantic', 'adore', 'passionate', 
    '❤️', '💕', '💖', 'forever', 'you\'re amazing', 'i love you',
    'can\'t wait', 'so excited', 'cant wait'
  ];
  
  const decreaseTriggers = [
    'okay', 'sure', 'yeah', 'alright', 'cool', 'i see',
    'just', 'maybe', 'not sure', 'whatever', 'idk'
  ];
  
  let change = 0;
  
  for (const trigger of increaseTriggers) {
    if (lowerMessage.includes(trigger)) {
      change += 1;
    }
  }
  
  for (const trigger of decreaseTriggers) {
    if (lowerMessage.includes(trigger)) {
      change -= 0.5;
    }
  }
  
  let newIntensity = prevIntensity + change;
  newIntensity = Math.max(1, Math.min(4, newIntensity));
  
  return Math.round(newIntensity);
};

const preferencePatterns = [
  { pattern: /i (?:like|love|adore|enjoy|prefer) (.+)/i, key: 'likes' },
  { pattern: /i (?:hate|don\'t like|dislike|can\'t stand) (.+)/i, key: 'dislikes' },
  { pattern: /my favorite (.+) is (.+)/i, key: 'favorite' },
  { pattern: /i (?:love|like|enjoy) (.+)/i, key: 'interests' },
  { pattern: /i\'m (?:interested in|into) (.+)/i, key: 'interests' },
  { pattern: /i play (.+)/i, key: 'hobbies' },
  { pattern: /i watch (.+)/i, key: 'hobbies' },
  { pattern: /i listen to (.+)/i, key: 'music' },
  { pattern: /i work as (.+)/i, key: 'occupation' },
  { pattern: /i live in (.+)/i, key: 'location' },
  { pattern: /i\'m (.+) years old/i, key: 'age' },
];

export const extractPreferences = (message) => {
  if (!message) return [];
  
  const preferences = [];
  const lowerMessage = message.toLowerCase();
  
  for (const { pattern, key } of preferencePatterns) {
    const match = message.match(pattern);
    if (match) {
      const value = match[1] || match[2] || match[0];
      if (value && value.length > 1 && value.length < 100) {
        preferences.push({
          key,
          value: value.trim(),
          importance: key === 'likes' || key === 'dislikes' ? 8 : 5,
          detectedFrom: lowerMessage.substring(0, 50),
        });
      }
    }
  }
  
  return preferences;
};

export const getResponseStyle = (user, mood, intent) => {
  const userPreferences = user?.preferences || {};
  const preferredStyle = userPreferences.style || 'friendly';
  
  const styleMap = {
    friendly: {
      tone: 'warm',
      style: 'soft',
      prefix: '😊',
    },
    romantic: {
      tone: 'loving',
      style: 'deep',
      prefix: '💕',
    },
    flirty: {
      tone: 'playful',
      style: 'playful',
      prefix: '😘',
    },
  };
  
  const moodAdjustments = {
    happy: { extra: 'Share their joy!', enthusiasm: 1.2 },
    sad: { extra: 'Be supportive and caring', enthusiasm: 0.8 },
    romantic: { extra: 'Return the affection', enthusiasm: 1.3 },
    angry: { extra: 'Be calming and understanding', enthusiasm: 0.7 },
    fearful: { extra: 'Reassure and comfort', enthusiasm: 0.9 },
    neutral: { extra: null, enthusiasm: 1.0 },
  };
  
  const baseStyle = styleMap[preferredStyle] || styleMap.friendly;
  const moodAdjustment = moodAdjustments[mood] || moodAdjustments.neutral;
  
  let intensity = 2;
  if (mood === 'romantic') intensity = 3;
  if (mood === 'happy') intensity = 2;
  if (mood === 'sad') intensity = 1;
  
  return {
    tone: baseStyle.tone,
    style: baseStyle.style,
    intensity,
    prefix: baseStyle.prefix,
    extraGuidance: moodAdjustment.extra,
  };
};

export const buildContextForAI = (params) => {
  const { userMessage, mood, intent, intensity, style, memories, lastMessages } = params;
  
  let prompt = `You are Velora, an AI romantic companion. `;
  
  prompt += `Your personality: ${style.tone}, ${style.style} style. `;
  prompt += `Current conversation intensity: ${intensity}/4. `;
  
  if (style.extraGuidance) {
    prompt += `Current guidance: ${style.extraGuidance} `;
  }
  
  prompt += `\n\n`;
  
  if (memories && memories.length > 0) {
    prompt += `Important things about the user (remember these!):\n`;
    memories.slice(0, 10).forEach(m => {
      prompt += `- ${m.key}: ${m.value}\n`;
    });
    prompt += `\n`;
  }
  
  if (lastMessages && lastMessages.length > 0) {
    prompt += `Recent conversation:\n`;
    lastMessages.slice(-6).forEach(msg => {
      if (msg.sender === 'user') {
        prompt += `User: ${msg.content}\n`;
      } else {
        prompt += `You: ${msg.content}\n`;
      }
    });
  }
  
  prompt += `\nUser: ${userMessage}\n\nYou:`;
  
  return prompt;
};
