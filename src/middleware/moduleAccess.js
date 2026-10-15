import { protect } from './authMiddleware.js';
import { getSidebarPermissionsForRole } from '../controllers/authController.js';
import { applyAssignmentOverrides } from '../utils/assignmentAccess.js';

// Server-side twin of the sidebar permissions the website and app already enforce in the UI.
//
// 1. Every /api route needs a logged-in user, except login/password routes (/auth) and the
//    WhatsApp webhook Meta calls.
// 2. Changes (POST/PUT/PATCH/DELETE) need one of the listed sidebar modules. Several modules are
//    listed where another screen legitimately writes there (e.g. quick-adding a customer from the
//    quotation form, recording a payment against an invoice).
// 3. Reads are open to any logged-in user, because every form's pickers read across modules
//    (customers, products, employees...). The exceptions are the screens that are sensitive on
//    their own: bank, audit logs, reports.
// Prefixes not listed (attendance, expense claims, notifications, dashboard) are per-user and
// stay open to every logged-in user.

const PUBLIC = [/^\/auth(\/|$)/, /^\/whatsapp\/webhook(\/|$)/];

const WRITE_MODULES = {
  customers: ['customers', 'leads', 'quotations', 'proformas', 'orders', 'invoices', 'deliveries'],
  'sales/leads': ['leads', 'ai_processing', 'email', 'whatsapp', 'follow_ups'],
  'sales/documents': ['quotations', 'proformas', 'orders', 'invoices', 'deliveries'],
  'sales/performance': ['sales_performance'],
  ai: ['email', 'ai_processing', 'leads'],
  whatsapp: ['whatsapp'],
  products: ['products', 'inventory'],
  'serial-numbers': ['serial_numbers', 'deliveries', 'warranty'],
  company: ['company_settings'],
  suppliers: ['suppliers', 'purchase'],
  quotations: ['quotations'],
  proformas: ['proformas', 'payments'],
  'sales-orders': ['orders'],
  'delivery-notes': ['deliveries', 'orders'],
  invoices: ['invoices', 'payments', 'deliveries'],
  'purchase-orders': ['purchase', 'orders'],
  employees: ['hr', 'users_roles'],
  projects: ['projects', 'profitability'],
  'service-requests': ['service', 'warranty'],
  warranties: ['warranty', 'service'],
  roles: ['users_roles', 'hr'],
  bank: ['banking'],
  'follow-ups': ['follow_ups', 'leads'],
};

const READ_MODULES = {
  bank: ['banking'],
  'audit-logs': ['audit_logs'],
  reports: ['reports'],
};

// "/sales/leads/123/stage" -> "sales/leads"; "/invoices/INV-1" -> "invoices"
const routeKey = (path) => {
  const [a, b] = path.split('/').filter(Boolean);
  return a === 'sales' ? `sales/${b || ''}` : a;
};

// Same 30s cache idea as authMiddleware's user cache: permissions are a few DB round trips and
// only change when an admin edits a role.
const PERMS_TTL_MS = 30_000;
const permsCache = new Map(); // userId -> { perms, expiresAt }

const getPermissions = async (user) => {
  const id = String(user._id);
  const hit = permsCache.get(id);
  if (hit && hit.expiresAt > Date.now()) return hit.perms;
  let perms = await getSidebarPermissionsForRole(user.role);
  if (user.employeeId) perms = await applyAssignmentOverrides(perms, user.employeeId);
  permsCache.set(id, { perms, expiresAt: Date.now() + PERMS_TTL_MS });
  return perms;
};

export const requiredModules = (method, path) => {
  const key = routeKey(path);
  return method === 'GET' || method === 'HEAD' ? READ_MODULES[key] : WRITE_MODULES[key];
};

export const moduleAccess = (req, res, next) => {
  if (req.method === 'OPTIONS' || PUBLIC.some((re) => re.test(req.path))) return next();
  return protect(req, res, async () => {
    try {
      const needed = requiredModules(req.method, req.path);
      if (!needed) return next();
      const perms = await getPermissions(req.user);
      if (needed.some((m) => perms?.[m])) return next();
      return res.status(403).json({ success: false, message: 'You are not authorized to access this module.' });
    } catch (err) {
      return next(err);
    }
  });
};
