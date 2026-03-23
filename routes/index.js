import express from 'express';
import authRoutes from './auth.routes.js';
import chatRoutes from './chat.routes.js';

const router = express.Router();

router.use(authRoutes);
router.use(chatRoutes);

export default router;
