import express from 'express';
import { sendMessage, getMessages, deleteMessage, clearChat } from '../controllers/chat.controller.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.post('/chat/send', auth, sendMessage);
router.get('/chat/messages', auth, getMessages);
router.delete('/chat/message/:messageId', auth, deleteMessage);
router.delete('/chat/clear', auth, clearChat);

export default router;
