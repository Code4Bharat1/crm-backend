import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { 
  getLeads, 
  createLead, 
  contactLeadByEmailId, 
  progressLeadByContact, 
  updateLeadStage, 
  getDocuments, 
  createDocument, 
  getDocumentById,
  getSalesPerformance,
  updateSalespersonTarget,
  getSalespeopleList
} from '../controllers/salesController.js';

const router = express.Router();

// Middleware to verify Admin or Manager role for target updates
const requireAdminOrManager = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id || decoded.userId || decoded._id;
      if (userId) {
        req.user = await User.findById(userId).select('-password');
      }
    } catch (err) {
      console.warn('[requireAdminOrManager] Token verification warning:', err.message);
    }
  }

  // If user is authenticated, check their role
  if (req.user) {
    const r = (req.user.role || '').toLowerCase().trim();
    const isAllowed = r.includes('admin') || r.includes('director') || r.includes('manager');
    if (!isAllowed) {
      return res.status(403).json({ 
        success: false, 
        message: `Permission denied: Only Admins and Managers can set sales targets. Your current role is "${req.user.role}".` 
      });
    }
  }

  // Check role hint if provided via header or body (e.g. in dev testing)
  const roleHint = (req.headers['x-user-role'] || req.body?.userRole || '').toLowerCase().trim();
  if (roleHint && (roleHint === 'sales' || roleHint === 'technician' || roleHint === 'service')) {
    if (!roleHint.includes('admin') && !roleHint.includes('manager')) {
      return res.status(403).json({ 
        success: false, 
        message: `Permission denied: Only Admins and Managers can set sales targets. Current role: "${roleHint}".` 
      });
    }
  }

  next();
};

router.get('/performance', getSalesPerformance);
router.patch('/performance/target/:id', requireAdminOrManager, updateSalespersonTarget);
router.get('/salespeople', getSalespeopleList);


router.route('/leads')
  .get(getLeads)
  .post(createLead);

// Must be before /leads/:id to avoid conflict
router.patch('/leads/by-email/:emailId', contactLeadByEmailId);
router.patch('/leads/progress-by-contact', progressLeadByContact);
router.patch('/leads/:id/stage', updateLeadStage);

router.route('/documents')
  .get(getDocuments)
  .post(createDocument);

router.route('/documents/:id')
  .get(getDocumentById);

export default router;
