import express from 'express';
import { registerUser, loginUser, logoutUser, changePassword, refreshAccessToken, logoutAll } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/change-password', changePassword);
router.post('/refresh', refreshAccessToken);
router.post('/logout', protect, logoutUser);
router.post('/logout-all', protect, logoutAll);

export default router;
