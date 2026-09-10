import express from 'express';
import { getAuditLogs, getAuditStats, getAuditLogById, exportAuditLogs } from '../controllers/auditLogController.js';
import { protect } from '../middleware/authMiddleware.js';

import { getPermissionsForRole } from '../config/permissions.js';
import Role from '../models/Role.js';
import { findMatchingRoleInList } from '../utils/roleMatcher.js';

const router = express.Router();

// Middleware to check admin or audit access
const auditAccessCheck = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required to access audit logs' });
  }

  const roleName = req.user.role || '';
  const normalized = roleName.trim().toLowerCase();

  // 1. Super admin roles (strictly admin / superadmin)
  if (['admin', 'superadmin', 'super admin'].includes(normalized)) {
    return next();
  }

  // 2. Built-in permission matrix
  const basePerms = getPermissionsForRole(roleName);
  if (basePerms?.admin || basePerms?.audit_logs) {
    return next();
  }

  // 3. Dynamic role permissions from DB
  try {
    const allRoles = await Role.find();
    const matchedRole = findMatchingRoleInList(roleName, allRoles);
    if (matchedRole?.permissions?.audit_logs || matchedRole?.permissions?.admin) {
      return next();
    }
  } catch (err) {
    console.warn('Error verifying audit permissions from DB:', err.message);
  }

  return res.status(403).json({ message: 'Access denied to audit logs' });
};

// Protect all audit routes
router.use(protect);
router.use(auditAccessCheck);

// Static routes MUST come before /:id
router.get('/stats', getAuditStats);
router.get('/export', exportAuditLogs);

// Dynamic routes
router.get('/', getAuditLogs);
router.get('/:id', getAuditLogById);

export default router;
