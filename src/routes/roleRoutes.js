import express from 'express';
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
} from '../controllers/roleController.js';

const router = express.Router();

router.route('/')
  .get(getRoles)
  .post(createRole);

router.route('/:id')
  .put(updateRole)
  .delete(deleteRole);

export default router;
