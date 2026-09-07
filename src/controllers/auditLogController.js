import AuditLog from '../models/AuditLog.js';

export const getAuditStats = async (req, res) => {
  try {
    const [entries, critical, warnings, logins, failedLogins] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.countDocuments({ severity: 'CRITICAL' }),
      AuditLog.countDocuments({ severity: 'WARNING' }),
      AuditLog.countDocuments({ action: 'LOGIN' }),
      AuditLog.countDocuments({ action: 'LOGIN_FAILED' })
    ]);

    res.json({
      entries,
      critical,
      warnings,
      logins,
      failedLogins,
      retention: '7 years'
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch audit stats', error: error.message });
  }
};

export const getAuditLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    
    // Search
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { userName: regex },
        { userRole: regex },
        { action: regex },
        { module: regex },
        { description: regex },
        { resourceId: regex },
        { ipAddress: regex }
      ];
    }

    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.module) filter.module = req.query.module;
    if (req.query.action) {
      if (req.query.action.includes(',')) {
        filter.action = { $in: req.query.action.split(',').map(s => s.trim()) };
      } else {
        filter.action = req.query.action;
      }
    }
    if (req.query.severity) filter.severity = req.query.severity;
    
    // Date ranges
    if (req.query.fromDate || req.query.toDate) {
      filter.createdAt = {};
      if (req.query.fromDate) filter.createdAt.$gte = new Date(req.query.fromDate);
      if (req.query.toDate) filter.createdAt.$lte = new Date(req.query.toDate);
    }

    const auditLogs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await AuditLog.countDocuments(filter);

    res.json({
      auditLogs,
      page,
      pages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch audit logs', error: error.message });
  }
};

export const getAuditLogById = async (req, res) => {
  try {
    const auditLog = await AuditLog.findById(req.params.id).lean();
    if (!auditLog) return res.status(404).json({ message: 'Audit log not found' });
    res.json(auditLog);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch audit log', error: error.message });
  }
};

export const exportAuditLogs = async (req, res) => {
  try {
    const filter = {};
    
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { userName: regex },
        { action: regex },
        { module: regex },
        { description: regex },
        { resourceId: regex },
        { ipAddress: regex }
      ];
    }
    
    // Additional filters if provided...
    if (req.query.module) filter.module = req.query.module;
    if (req.query.severity) filter.severity = req.query.severity;

    const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).lean();

    // Generate CSV
    const headers = ['When', 'User', 'Role', 'Action', 'Module', 'Resource', 'Description', 'IP Address', 'Severity', 'Status'];
    const escapeCsv = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
    
    let csv = headers.join(',') + '\n';
    
    logs.forEach(log => {
      const row = [
        log.createdAt.toISOString(),
        log.userName,
        log.userRole,
        log.action,
        log.module,
        log.resourceType ? `${log.resourceType} ${log.resourceId || ''}`.trim() : (log.resourceId || ''),
        log.description,
        log.ipAddress,
        log.severity,
        log.status
      ];
      csv += row.map(escapeCsv).join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    res.status(200).send(csv);
  } catch (error) {
    res.status(500).json({ message: 'Failed to export audit logs', error: error.message });
  }
};
