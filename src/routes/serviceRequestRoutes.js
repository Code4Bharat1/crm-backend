import express from 'express';
import {
  getServiceRequests,
  getServiceRequest,
  createServiceRequest,
  updateServiceRequest,
  deleteServiceRequest,
  resolveServiceRequest
} from '../controllers/serviceRequestController.js';

const router = express.Router();

router.route('/')
  .get(getServiceRequests)
  .post(createServiceRequest);

router.route('/:id')
  .get(getServiceRequest)
  .put(updateServiceRequest)
  .delete(deleteServiceRequest);

router.post('/:id/resolve', resolveServiceRequest);

export default router;
