import express from 'express';
import {
  getFollowUps,
  getFollowUpStats,
  syncFollowUps,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp,
} from '../controllers/followUpController.js';

const router = express.Router();

router.get('/stats', getFollowUpStats);
router.post('/generate', syncFollowUps);
router.route('/').get(getFollowUps).post(createFollowUp);
router.route('/:id').put(updateFollowUp).delete(deleteFollowUp);

export default router;
