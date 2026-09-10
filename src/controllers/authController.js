import User from '../models/User.js';
import Employee from '../models/Employee.js';
import RefreshToken from '../models/RefreshToken.js';
import Role from '../models/Role.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getPermissionsForRole, ALL_SIDEBAR_MODULE_KEYS, isAdminRole } from '../config/permissions.js';
import { findMatchingRoleInList } from '../utils/roleMatcher.js';
import { applyAssignmentOverrides } from '../utils/assignmentAccess.js';
import { createAuditLog } from '../services/auditLogService.js';

const resolveUserPermissions = async (roleName) => {
  let permissions = getPermissionsForRole(roleName);
  if (!roleName) return permissions;
  if (isAdminRole(roleName)) {
    return { view: true, create: true, edit: true, delete: true, approve: true, export: true, financial: true, admin: true };
  }
  try {
    const dbRole = await Role.findOne({
      name: { $regex: new RegExp(`^${roleName.trim()}$`, 'i') }
    });
    if (dbRole && dbRole.permissions) {
      permissions = { ...permissions, ...dbRole.permissions, modulePermissions: dbRole.permissions };
    }
  } catch (err) {
    console.warn('Could not query role permissions from DB:', err.message);
  }
  return permissions;
};

/**
 * Looks up the granular per-sidebar-module permission map for a user's role.
 * - If admin, returns ALL 34 sidebar modules set to true.
 * - If non-admin, strictly fetches from the Role collection in DB.
 * - Defaults to { dashboard: true } if no role configured. Never returns null or full access!
 */
const getSidebarPermissionsForRole = async (roleName) => {
  if (!roleName) return { dashboard: true };
  if (isAdminRole(roleName)) {
    const adminPermissions = {};
    ALL_SIDEBAR_MODULE_KEYS.forEach((key) => {
      adminPermissions[key] = true;
    });
    return adminPermissions;
  }
  const allRoles = await Role.find();
  const match = findMatchingRoleInList(roleName, allRoles);
  if (match && match.permissions) {
    return { ...match.permissions, dashboard: true };
  }
  return { dashboard: true };
};

const generateToken = (id, type = 'access') => {
  const secret = type === 'access' ? process.env.JWT_SECRET : (process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET);
  const expiresIn = type === 'access' ? (process.env.ACCESS_TOKEN_EXPIRES_IN || '15m') : (process.env.REFRESH_TOKEN_EXPIRES_IN || '7d');
  return jwt.sign({ id, type }, secret, { expiresIn });
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const user = await User.create({ name, email, password, role });
  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } else {
    res.status(400).json({ message: 'Invalid user data' });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (user && (await user.matchPassword(password))) {
    const permissions = await resolveUserPermissions(user.role);
    let sidebarPermissions = await getSidebarPermissionsForRole(user.role);

    // Auto-link employeeId if not set
    let employeeId = user.employeeId;
    if (!employeeId) {
      const emp = await Employee.findOne({ email: user.email });
      if (emp) {
        employeeId = emp._id;
        user.employeeId = emp._id;
        await user.save().catch(() => {});
      }
    }

    sidebarPermissions = await applyAssignmentOverrides(sidebarPermissions, employeeId);

    const accessToken = generateToken(user._id, 'access');
    const refreshToken = generateToken(user._id, 'refresh');

    const decodedRefresh = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET);
    
    await RefreshToken.create({
      userId: user._id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(decodedRefresh.exp * 1000),
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    req.user = user;
    await createAuditLog({
      req,
      action: 'LOGIN',
      module: 'AUTHENTICATION',
      description: 'User logged in successfully',
      severity: 'INFO',
      status: 'SUCCESS'
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          employeeId: employeeId || undefined
        },
        permissions,
        sidebarPermissions,
        token: accessToken,
        accessToken
      }
    });
  } else {
    await createAuditLog({
      req,
      action: 'LOGIN_FAILED',
      module: 'AUTHENTICATION',
      description: `Failed login attempt for email: ${email}`,
      severity: 'WARNING',
      status: 'FAILED',
      metadata: { email }
    });
    res.status(401).json({ message: 'Invalid email or password' });
  }
};

const refreshAccessToken = async (req, res) => {
  const { refreshToken } = req.cookies;
  
  if (!refreshToken) {
    return res.status(401).json({ success: false, message: 'Refresh token not found' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET);
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ success: false, message: 'Invalid token type' });
    }

    const tokenHash = hashToken(refreshToken);
    const existingToken = await RefreshToken.findOne({ tokenHash });

    if (!existingToken || existingToken.revokedAt) {
      return res.status(401).json({ success: false, message: 'Refresh token invalid or revoked' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const permissions = await resolveUserPermissions(user.role);
    let sidebarPermissions = await getSidebarPermissionsForRole(user.role);

    let employeeId = user.employeeId;
    if (!employeeId) {
      const emp = await Employee.findOne({ email: user.email });
      if (emp) employeeId = emp._id;
    }
    sidebarPermissions = await applyAssignmentOverrides(sidebarPermissions, employeeId);

    const newAccessToken = generateToken(user._id, 'access');
    const newRefreshToken = generateToken(user._id, 'refresh');
    const newDecodedRefresh = jwt.verify(newRefreshToken, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET);

    existingToken.revokedAt = new Date();
    existingToken.replacedByTokenHash = hashToken(newRefreshToken);
    await existingToken.save();

    await RefreshToken.create({
      userId: user._id,
      tokenHash: hashToken(newRefreshToken),
      expiresAt: new Date(newDecodedRefresh.exp * 1000),
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    req.user = user;
    await createAuditLog({
      req,
      action: 'TOKEN_REFRESH',
      module: 'AUTHENTICATION',
      description: 'Access token refreshed successfully',
      severity: 'INFO',
      status: 'SUCCESS'
    });

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          employeeId: user.employeeId || undefined
        },
        permissions,
        sidebarPermissions
      }
    });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
};

const logoutUser = async (req, res) => {
  const { refreshToken } = req.cookies;
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await RefreshToken.findOneAndUpdate({ tokenHash }, { revokedAt: new Date() });
  }

  res.clearCookie('refreshToken');
  
  await createAuditLog({
    req,
    action: 'LOGOUT',
    module: 'AUTHENTICATION',
    description: 'User logged out successfully',
    severity: 'INFO',
    status: 'SUCCESS'
  });
  res.json({ success: true, message: 'Logged out successfully' });
};

const logoutAll = async (req, res) => {
  await RefreshToken.deleteMany({ userId: req.user._id });
  res.clearCookie('refreshToken');

  await createAuditLog({
    req,
    action: 'LOGOUT_ALL',
    module: 'AUTHENTICATION',
    description: 'User logged out from all devices',
    severity: 'INFO',
    status: 'SUCCESS'
  });
  res.json({ success: true, message: 'Logged out from all devices successfully' });
};

const changePassword = async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email and new password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (currentPassword && !(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ success: false, message: 'Current password does not match' });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully. You can now log in with your new password.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current user profile & latest role permissions
// @route   GET /api/auth/me
// @access  Protected
const getCurrentUser = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    const permissions = await resolveUserPermissions(user.role);
    let sidebarPermissions = await getSidebarPermissionsForRole(user.role);
    if (user.employeeId) {
      sidebarPermissions = await applyAssignmentOverrides(sidebarPermissions, user.employeeId);
    }
    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          employeeId: user.employeeId
        },
        permissions,
        sidebarPermissions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all registered users for user/role management
// @route   GET /api/auth/users
// @access  Protected (Admin only)
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a user's role
// @route   PUT /api/auth/users/:id/role
// @access  Protected (Admin only)
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) {
      return res.status(400).json({ success: false, message: 'Role is required' });
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.role = role.trim();
    await user.save();

    await createAuditLog({
      req,
      action: 'ROLE_ASSIGNMENT',
      module: 'USERS_ROLES',
      description: `Role updated for user ${user.email} to ${user.role}`,
      severity: 'WARNING',
      status: 'SUCCESS'
    });

    res.json({
      success: true,
      message: `Role for ${user.name} successfully changed to ${user.role}`,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new system user account
// @route   POST /api/auth/users
// @access  Protected (Admin only)
const createAdminUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }
    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: role ? role.trim() : 'Sales'
    });

    res.status(201).json({
      success: true,
      message: `User ${user.name} created successfully`,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
  registerUser,
  loginUser,
  logoutUser,
  changePassword,
  refreshAccessToken,
  logoutAll,
  getCurrentUser,
  getAllUsers,
  updateUserRole,
  createAdminUser,
  getSidebarPermissionsForRole,
  resolveUserPermissions
};
