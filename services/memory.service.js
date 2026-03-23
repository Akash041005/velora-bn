import Memory from '../models/Memory.js';
import { extractImportantInfo } from './ai.service.js';

const MAX_MEMORIES = 50;

export const saveMemory = async (userId, key, value, importance = 5) => {
  try {
    const existing = await Memory.findOne({ userId, key });
    
    if (existing) {
      existing.value = value;
      existing.importance = importance;
      await existing.save();
    } else {
      await Memory.create({ userId, key, value, importance });
    }

    await trimMemories(userId);
    
    return true;
  } catch (error) {
    console.error('Save memory error:', error);
    return false;
  }
};

export const saveMemoriesFromMessage = async (userId, message) => {
  try {
    const importantInfo = extractImportantInfo(message);
    
    for (const info of importantInfo) {
      await saveMemory(userId, info.key, info.value, info.importance);
    }
    
    return importantInfo.length > 0;
  } catch (error) {
    console.error('Save memories from message error:', error);
    return false;
  }
};

export const getRelevantMemory = async (userId) => {
  try {
    const memories = await Memory.find({ userId })
      .sort({ importance: -1, createdAt: -1 })
      .limit(20);
    
    return memories;
  } catch (error) {
    console.error('Get relevant memory error:', error);
    return [];
  }
};

const trimMemories = async (userId) => {
  try {
    const count = await Memory.countDocuments({ userId });
    
    if (count > MAX_MEMORIES) {
      const toDelete = await Memory.find({ userId })
        .sort({ importance: 1, createdAt: 1 })
        .limit(count - MAX_MEMORIES);
      
      const idsToDelete = toDelete.map(m => m._id);
      await Memory.deleteMany({ _id: { $in: idsToDelete } });
    }
  } catch (error) {
    console.error('Trim memories error:', error);
  }
};

export const getAllMemories = async (userId) => {
  try {
    const memories = await Memory.find({ userId }).sort({ createdAt: -1 });
    return memories;
  } catch (error) {
    console.error('Get all memories error:', error);
    return [];
  }
};
