import express from 'express';
import { registerController, loginController, updatePreferences, updateProfile } from '../controllers/auth.controller.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.post('/auth/register', registerController);
router.post('/auth/login', loginController);
router.put('/auth/preferences', auth, updatePreferences);
router.put('/auth/profile', auth, updateProfile);

export default router;
