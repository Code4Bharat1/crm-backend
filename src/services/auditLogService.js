import AuditLog from '../models/AuditLog.js';

/**
 * Audit Log Service
 * Automates the extraction of user data, IP, and user-agent from the request object
 * and saves a standardized audit log entry.
 */
export const createAuditLog = async ({
  req,
  action,
  module,
  resourceType,
  resourceId,
  description,
  severity = 'INFO',
  status = 'SUCCESS',
  metadata = {}
}) => {
  try {
    let userId = null;
    let userName = null;
    let userRole = null;

    // Extract user info if request is authenticated
    if (req && req.user) {
      userId = req.user._id;
      userName = req.user.name;
      userRole = req.user.role;
    }

    // Extract IP address correctly, prioritizing x-forwarded-for if behind a proxy
    let ipAddress = 'unknown';
    if (req) {
      ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
      // Handle IPv4 mapped IPv6 addresses (e.g., ::ffff:127.0.0.1)
      if (ipAddress && ipAddress.includes('::ffff:')) {
        ipAddress = ipAddress.split('::ffff:')[1];
      }
    }

    // Extract User Agent
    let userAgent = 'unknown';
    if (req && req.headers['user-agent']) {
      userAgent = req.headers['user-agent'];
    }

    const logEntry = new AuditLog({
      userId,
      userName,
      userRole,
      action,
      module,
      resourceType,
      resourceId: resourceId ? String(resourceId) : undefined,
      description,
      ipAddress,
      userAgent,
      severity,
      status,
      metadata
    });

    await logEntry.save();
    return logEntry;
  } catch (error) {
    // We log the error but don't typically want an audit log failure to break the main business flow
    console.error('Failed to create audit log:', error);
  }
};
