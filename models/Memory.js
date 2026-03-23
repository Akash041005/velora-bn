import mongoose from 'mongoose';

const memorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  key: {
    type: String,
    required: true
  },
  value: {
    type: String,
    required: true
  },
  importance: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  }
}, { timestamps: true });

memorySchema.index({ userId: 1, key: 1 });

const Memory = mongoose.model('Memory', memorySchema);

export default Memory;
