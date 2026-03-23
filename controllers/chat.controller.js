import Message from '../models/Message.js';
import User from '../models/User.js';
import { generateAIResponse } from '../services/ai.service.js';
import { saveMemoriesFromMessage, getRelevantMemory } from '../services/memory.service.js';

export const sendMessage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { content, intensity } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const userMessage = await Message.create({
      userId,
      content: content.trim(),
      sender: 'user'
    });

    await saveMemoriesFromMessage(userId, content);

    const lastMessages = await Message.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const memories = await getRelevantMemory(userId);

    const user = await User.findById(userId).lean();

    const context = {
      userMessage: content,
      memory: memories.map(m => ({ key: m.key, value: m.value })),
      lastMessages: lastMessages.reverse(),
      user,
      userIntensity: intensity || 2
    };

    const aiResult = await generateAIResponse(context);

    const aiMessage = await Message.create({
      userId,
      content: aiResult.message,
      sender: 'ai'
    });

    res.json({
      userMessage: {
        id: userMessage._id,
        content: userMessage.content,
        sender: userMessage.sender,
        createdAt: userMessage.createdAt
      },
      aiMessage: {
        id: aiMessage._id,
        content: aiMessage.content,
        sender: aiMessage.sender,
        createdAt: aiMessage.createdAt
      },
      aiContext: {
        mood: aiResult.mood,
        intent: aiResult.intent,
        intensity: aiResult.intensity
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getMessages = async (req, res) => {
  try {
    const userId = req.user.userId;

    const messages = await Message.find({ userId })
      .sort({ createdAt: 1 })
      .limit(100);

    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { messageId } = req.params;

    await Message.findOneAndDelete({ _id: messageId, userId });

    res.json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const clearChat = async (req, res) => {
  try {
    const userId = req.user.userId;

    await Message.deleteMany({ userId });

    res.json({ message: 'Chat cleared' });
  } catch (error) {
    console.error('Clear chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
