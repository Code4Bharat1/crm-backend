import express from 'express';
import {
  registerUser,
  loginUser,
  logoutUser,
  changePassword,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  refreshAccessToken,
  logoutAll,
  getCurrentUser,
  getAllUsers,
  updateUserRole,
  createAdminUser
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/change-password', changePassword);
router.post('/forgot-password', forgotPassword);
router.get('/verify-reset-token', verifyResetToken);
router.post('/reset-password', resetPassword);
router.post('/refresh', refreshAccessToken);
router.post('/logout', protect, logoutUser);
router.post('/logout-all', protect, logoutAll);

// Current user profile & live permissions
router.get('/me', protect, getCurrentUser);

// User and role management
router.get('/users', protect, getAllUsers);
router.put('/users/:id/role', protect, updateUserRole);
router.post('/users', protect, createAdminUser);

export default router;

