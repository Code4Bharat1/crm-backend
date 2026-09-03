import express from 'express';
import { getAuditLogs, getAuditStats, getAuditLogById, exportAuditLogs } from '../controllers/auditLogController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Middleware to check admin access (basic implementation based on requested role check)
const adminCheck = (req, res, next) => {
  // Allow if role is Admin, Director, Admin Manager (customize as per exact role names in system)
  const allowedRoles = ['Admin', 'Director', 'Admin Manager'];
  if (req.user && allowedRoles.includes(req.user.role)) {
    next();
  } else {
    // If not admin, you may optionally allow if there's a specific 'export' or 'audit' permission
    // But for safety, deny access
    res.status(403).json({ message: 'Access denied to audit logs' });
  }
};

// Protect all audit routes
router.use(protect);
router.use(adminCheck);

// Static routes MUST come before /:id
router.get('/stats', getAuditStats);
router.get('/export', exportAuditLogs);

// Dynamic routes
router.get('/', getAuditLogs);
router.get('/:id', getAuditLogById);

export default router;
