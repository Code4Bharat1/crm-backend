import express from 'express';
import {
  getSerialNumbers,
  getSerialNumberById,
  createSerialNumber,
  updateSerialNumber,
  deleteSerialNumber,
} from '../controllers/serialNumberController.js';

const router = express.Router();

router.get('/', getSerialNumbers);
router.get('/:id', getSerialNumberById);
router.post('/', createSerialNumber);
router.put('/:id', updateSerialNumber);
router.delete('/:id', deleteSerialNumber);

export default router;
