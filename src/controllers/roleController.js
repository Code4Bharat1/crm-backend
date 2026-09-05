import Role from '../models/Role.js';
import { findMatchingRoleInList } from '../utils/roleMatcher.js';

// @desc    Get all roles
// @route   GET /api/roles
// @access  Public
export const getRoles = async (req, res) => {
  try {
    const roles = await Role.find().sort({ createdAt: 1 });
    res.status(200).json({
      success: true,
      count: roles.length,
      data: roles,
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch roles',
      error: error.message,
    });
  }
};

// @desc    Create a new role
// @route   POST /api/roles
// @access  Public
export const createRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Role name is required',
      });
    }

    const trimmedName = name.trim();

    // Smart check for existing role (case-insensitive & singular/plural e.g. Sale vs Sales)
    const allRoles = await Role.find();
    const existingMatch = findMatchingRoleInList(trimmedName, allRoles);

    if (existingMatch) {
      return res.status(400).json({
        success: false,
        message: `Role "${existingMatch.name}" is already defined`,
        alreadyDefined: true,
        data: existingMatch,
      });
    }

    const newRole = await Role.create({
      name: trimmedName,
      description: description ? description.trim() : '',
      permissions: permissions || {
        view: true,
        create: false,
        edit: false,
        delete: false,
        approve: false,
        export: false,
        financial: false,
        admin: false,
      },
    });

    res.status(201).json({
      success: true,
      message: `Role "${newRole.name}" created successfully`,
      data: newRole,
    });
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create role',
      error: error.message,
    });
  }
};

// @desc    Update role
// @route   PUT /api/roles/:id
// @access  Public
export const updateRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;

    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    if (name && name.trim()) {
      const trimmedName = name.trim();
      const existing = await Role.findOne({
        _id: { $ne: req.params.id },
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Role "${trimmedName}" already exists`,
        });
      }
      role.name = trimmedName;
    }

    if (description !== undefined) {
      role.description = description.trim();
    }

    if (permissions) {
      // Replace outright rather than merge: the editor always submits the
      // full current module set, so merging would let permission keys for
      // modules that no longer exist (or were unchecked) linger forever.
      role.permissions = permissions;
      role.markModified('permissions');
    }

    await role.save();

    res.status(200).json({
      success: true,
      message: 'Role updated successfully',
      data: role,
    });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update role',
      error: error.message,
    });
  }
};

// @desc    Delete role
// @route   DELETE /api/roles/:id
// @access  Public
export const deleteRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    await Role.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: `Role "${role.name}" deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete role',
      error: error.message,
    });
  }
};
