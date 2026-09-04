export const PERMISSION_MATRIX = {
  "Admin": { view: true, create: true, edit: true, delete: true, approve: true, export: true, financial: true, admin: true },
  "admin": { view: true, create: true, edit: true, delete: true, approve: true, export: true, financial: true, admin: true },
  "Director": { view: true, create: true, edit: true, delete: true, approve: true, export: true, financial: true, admin: true },
  "Admin Manager": { view: true, create: true, edit: true, delete: true, approve: true, export: true, financial: true, admin: true },
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
  if (r.toLowerCase() === 'admin' || r.toLowerCase() === 'director' || r.toLowerCase() === 'admin manager') {
    return { view: true, create: true, edit: true, delete: true, approve: true, export: true, financial: true, admin: true };
  }
  return PERMISSION_MATRIX[r] || { view: false, create: false, edit: false, delete: false, approve: false, export: false, financial: false, admin: false };
};
