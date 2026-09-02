export const PERMISSION_MATRIX = {
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
  return PERMISSION_MATRIX[role] || { view: false, create: false, edit: false, delete: false, approve: false, export: false, financial: false, admin: false };
};
