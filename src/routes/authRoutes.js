import express from 'express';
import { registerUser, loginUser, changePassword } from '../controllers/authController.js';
const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/change-password', changePassword);

export default router;
