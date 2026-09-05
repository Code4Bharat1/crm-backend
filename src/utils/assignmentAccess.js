import Employee from '../models/Employee.js';
import Project from '../models/Project.js';
import Customer from '../models/Customer.js';
import ServiceRequest from '../models/ServiceRequest.js';

const escapeRegex = (str = '') => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Grants sidebar access to modules an employee has a direct assignment in,
 * overriding whatever their role's configured permissions say -- a Project
 * Manager, a Customer's salesperson, or a Service Request's engineer/
 * technician must always be able to reach the module that shows the work
 * assigned to them, regardless of role permissions. Attendance is always
 * unlocked for everyone: viewing your own attendance never needs a
 * permission.
 *
 * No-op when `sidebarPermissions` is null -- the caller already falls back
 * to showing everything in that case, so there's nothing to widen.
 *
 * Assignments are stored as free-text names (Project.manager,
 * Customer.salesPerson, ServiceRequest.engineer.name), not employee ids --
 * matched the same way the rest of the app already cross-references them.
 */
export const applyAssignmentOverrides = async (sidebarPermissions, employeeId) => {
  if (!sidebarPermissions) return sidebarPermissions;

  const overridden = { ...sidebarPermissions, attendance: true };
  if (!employeeId) return overridden;

  const employee = await Employee.findById(employeeId).select('fullName');
  const name = employee?.fullName?.trim();
  if (!name) return overridden;

  const nameMatch = new RegExp(`^${escapeRegex(name)}$`, 'i');
  const [isProjectManager, isSalesperson, isServiceEngineer] = await Promise.all([
    Project.exists({ manager: nameMatch }),
    Customer.exists({ salesPerson: nameMatch }),
    ServiceRequest.exists({ 'engineer.name': nameMatch }),
  ]);

  if (isProjectManager) overridden.projects = true;
  if (isSalesperson) overridden.customers = true;
  if (isServiceEngineer) overridden.service = true;

  return overridden;
};
