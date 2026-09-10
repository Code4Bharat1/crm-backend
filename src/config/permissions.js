export const ALL_SIDEBAR_MODULE_KEYS = [
  "dashboard",
  "leads",
  "customers",
  "whatsapp",
  "email",
  "ai_processing",
  "follow_ups",
  "quotations",
  "proformas",
  "orders",
  "deliveries",
  "invoices",
  "payments",
  "products",
  "inventory",
  "serial_numbers",
  "suppliers",
  "purchase",
  "projects",
  "profitability",
  "service",
  "warranty",
  "ledger",
  "banking",
  "gst",
  "hr",
  "attendance",
  "sales_performance",
  "reports",
  "notifications",
  "company_settings",
  "users_roles",
  "audit_logs",
  "deployment"
];

export const isAdminRole = (role) => {
  if (!role) return false;
  const r = role.trim().toLowerCase();
  return r === 'admin' || r === 'superadmin' || r === 'super admin';
};

export const PERMISSION_MATRIX = {
  "Admin": { view: true, create: true, edit: true, delete: true, approve: true, export: true, financial: true, admin: true },
  "admin": { view: true, create: true, edit: true, delete: true, approve: true, export: true, financial: true, admin: true },
  "Director": { view: true, create: true, edit: true, delete: false, approve: true, export: true, financial: true, admin: false },
  "Admin Manager": { view: true, create: true, edit: true, delete: false, approve: true, export: true, financial: false, admin: false },
  "Accounts Manager": { view: true, create: true, edit: true, delete: true, approve: true, export: true, financial: true, admin: false },
  "Accounts Executive": { view: true, create: true, edit: true, delete: false, approve: false, export: true, financial: true, admin: false },
  "Salesperson": { view: true, create: true, edit: true, delete: false, approve: false, export: true, financial: false, admin: false },
  "Engineer": { view: true, create: true, edit: true, delete: false, approve: false, export: true, financial: false, admin: false },
  "HR": { view: true, create: true, edit: true, delete: false, approve: true, export: true, financial: false, admin: false },
  "Purchase": { view: true, create: true, edit: true, delete: false, approve: false, export: true, financial: false, admin: false },
  "Project Manager": { view: true, create: true, edit: true, delete: false, approve: true, export: true, financial: false, admin: false },
  "Service": { view: true, create: true, edit: true, delete: false, approve: false, export: true, financial: false, admin: false }
};

export const getPermissionsForRole = (role) => {
  if (!role) return { view: false, create: false, edit: false, delete: false, approve: false, export: false, financial: false, admin: false };
  const r = role.trim();
  if (isAdminRole(r)) {
    return { view: true, create: true, edit: true, delete: true, approve: true, export: true, financial: true, admin: true };
  }
  return PERMISSION_MATRIX[r] || { view: true, create: false, edit: false, delete: false, approve: false, export: false, financial: false, admin: false };
};

