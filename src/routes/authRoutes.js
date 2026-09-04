import express from 'express';
<<<<<<< HEAD
import { registerUser, loginUser, changePassword } from '../controllers/authController.js';
=======
import { registerUser, loginUser, logoutUser } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
>>>>>>> b6de593d8d680589e143ab06edd884b3bebc6a99
const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
<<<<<<< HEAD
router.post('/change-password', changePassword);
=======
router.post('/logout', protect, logoutUser);
>>>>>>> b6de593d8d680589e143ab06edd884b3bebc6a99

export default router;
