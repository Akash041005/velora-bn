import axios from 'axios';
import { detectMood, detectIntent, updateIntensity, extractPreferences, getResponseStyle, buildContextForAI } from './ml.service.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export const generateAIResponse = async (context) => {
  try {
    const { userMessage, memory, lastMessages, user, userIntensity } = context;

    const mood = detectMood(userMessage);
    const intent = detectIntent(userMessage);
    const intensity = updateIntensity(userIntensity || 2, userMessage);
    const style = getResponseStyle(user, mood, intent);
    const newPreferences = extractPreferences(userMessage);

    const prompt = buildContextForAI({
      userMessage,
      mood,
      intent,
      intensity,
      style,
      memories: memory,
      lastMessages,
    });

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: style.tone === 'romantic' ? 0.8 : 0.7,
          maxOutputTokens: 1000,
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const aiMessage = response.data.candidates[0].content.parts[0].text;
    
    return {
      message: aiMessage,
      mood,
      intent,
      intensity,
      preferences: newPreferences,
    };
  } catch (error) {
    console.error('AI generation error:', error.response?.data || error.message);
    return {
      message: "I'm sorry, I'm having trouble thinking right now. Can you try again?",
      mood: 'neutral',
      intent: 'casual',
      intensity: 2,
      preferences: [],
    };
  }
};

export const extractImportantInfo = (message) => {
  return extractPreferences(message);
};
