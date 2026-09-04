import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { getPermissionsForRole } from '../config/permissions.js';
import { createAuditLog } from '../services/auditLogService.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
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
      token: generateToken(user._id),
    });
  } else {
    res.status(400).json({ message: 'Invalid user data' });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (user && (await user.matchPassword(password))) {
    const permissions = getPermissionsForRole(user.role);
    
    // We mock req.user for the audit log since protect middleware hasn't run
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
          role: user.role
        },
        permissions,
        token: generateToken(user._id)
      }
    });
  } else {
    // Audit failed login
    await createAuditLog({
      req,
      action: 'LOGIN_FAILED',
      module: 'AUTHENTICATION',
      description: `Failed login attempt for email: ${email}`,
      severity: 'WARNING',
      status: 'FAILED'
    });
    res.status(401).json({ message: 'Invalid email or password' });
  }
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

const logoutUser = async (req, res) => {
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

export { registerUser, loginUser, logoutUser, changePassword };


