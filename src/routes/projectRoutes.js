import express from 'express';
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  addProjectCost,
  updateProjectCost,
  deleteProjectCost,
  getProfitabilitySummary
} from '../controllers/projectController.js';

const router = express.Router();

router.get('/profitability-summary', getProfitabilitySummary);

router.route('/')
  .get(getProjects)
  .post(createProject);

router.route('/:id')
  .get(getProject)
  .put(updateProject)
  .delete(deleteProject);

router.post('/:id/costs', addProjectCost);
router.route('/:id/costs/:costId')
  .put(updateProjectCost)
  .delete(deleteProjectCost);

export default router;
