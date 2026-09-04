import Project from '../models/Project.js';
import Notification from '../models/Notification.js';
import Employee from '../models/Employee.js';
import { sendProjectAssignmentEmail } from '../utils/sendProjectAssignmentEmail.js';

// Helper to calculate actual cost of a project
export const calculateProjectActualCost = (project) => {
  if (!project || !project.costs) return 0;
  return project.costs.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
};

// GET /api/projects — List projects with search, status filter & KPIs
export const getProjects = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const query = {};

    if (status && status !== 'All') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { projectId: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { manager: { $regex: search, $options: 'i' } }
      ];
    }

    const projects = await Project.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Project.countDocuments(query);

    // Calculate aggregated KPIs across all projects
    const allProjects = await Project.find();
    const totalCount = allProjects.length;
    const inProgressCount = allProjects.filter(p => p.status === 'In Progress').length;
    const completedCount = allProjects.filter(p => p.status === 'Completed').length;
    const totalRevenue = allProjects.reduce((sum, p) => sum + (Number(p.revenue) || 0), 0);
    const totalActualCost = allProjects.reduce((sum, p) => sum + calculateProjectActualCost(p), 0);
    const totalGrossProfit = totalRevenue - totalActualCost;
    const avgMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
    const lossMakingCount = allProjects.filter(p => {
      const rev = Number(p.revenue) || 0;
      const cost = calculateProjectActualCost(p);
      return (rev - cost) < 0;
    }).length;

    // Attach calculated financial fields to each returned project
    const enrichedProjects = projects.map(p => {
      const actualCost = calculateProjectActualCost(p);
      const grossProfit = (Number(p.revenue) || 0) - actualCost;
      const margin = (Number(p.revenue) || 0) > 0 ? (grossProfit / Number(p.revenue)) * 100 : 0;
      return {
        ...p.toObject(),
        actualCost,
        grossProfit,
        margin
      };
    });

    res.json({
      success: true,
      projects: enrichedProjects,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit))
      },
      kpis: {
        total: totalCount,
        inProgress: inProgressCount,
        completed: completedCount,
        totalRevenue,
        totalActualCost,
        totalGrossProfit,
        avgMargin,
        lossMakingCount
      }
    });
  } catch (error) {
    console.error('Error in getProjects:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch projects', error: error.message });
  }
};

// GET /api/projects/:id — Single project detail with enriched metrics
export const getProject = async (req, res) => {
  try {
    const { id } = req.params;
    // Find by _id or projectId (e.g. PRJ-2026-001)
    const project = await Project.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { projectId: id }]
    });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const actualCost = calculateProjectActualCost(project);
    const grossProfit = (Number(project.revenue) || 0) - actualCost;
    const margin = (Number(project.revenue) || 0) > 0 ? (grossProfit / Number(project.revenue)) * 100 : 0;

    // Category breakdown
    const categoryCosts = {
      Materials: 0,
      Subcontractor: 0,
      Labor: 0,
      'Travel & Site': 0,
      Expenses: 0,
      Other: 0
    };

    project.costs.forEach(c => {
      const cat = c.category || 'Other';
      categoryCosts[cat] = (categoryCosts[cat] || 0) + (Number(c.amount) || 0);
    });

    res.json({
      success: true,
      project: {
        ...project.toObject(),
        actualCost,
        grossProfit,
        margin,
        categoryCosts
      }
    });
  } catch (error) {
    console.error('Error in getProject:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch project', error: error.message });
  }
};

// POST /api/projects — Create project
export const createProject = async (req, res) => {
  try {
    const {
      name,
      description,
      customer,
      manager,
      team,
      suppliers,
      status = 'Planning',
      priority = 'Medium',
      progress = 0,
      start = new Date(),
      end,
      revenue = 0,
      estimatedCost = 0,
      costs = [],
      milestones = [],
      soRef = '',
      notes = ''
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Project name is required' });
    }
    if (!customer || !customer.name) {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }

    const project = new Project({
      name,
      description,
      customer,
      manager: manager || 'Unassigned',
      team: team || [],
      suppliers: suppliers || [],
      status,
      priority,
      progress: Number(progress) || 0,
      start: start || new Date(),
      end,
      revenue: Number(revenue) || 0,
      estimatedCost: Number(estimatedCost) || 0,
      costs: costs || [],
      milestones: milestones || [],
      soRef,
      notes
    });

    await project.save();

    // Trigger Notification for the assigned Project Manager
    if (project.manager && project.manager !== 'Unassigned') {
      try {
        const emp = await Employee.findOne({
          $or: [
            { fullName: { $regex: `^${project.manager.trim()}$`, $options: 'i' } },
            { firstName: { $regex: `^${project.manager.trim()}$`, $options: 'i' } }
          ]
        });

        const formattedRev = Number(project.revenue || 0).toLocaleString('en-IN');
        await Notification.create({
          recipient: project.manager,
          recipientEmail: emp?.email || '',
          recipientRole: emp?.role || 'project manager',
          title: `Project Assigned: ${project.name}`,
          detail: `You have been assigned as Project Manager for "${project.name}" (Client: ${project.customer?.name || 'Customer'}, Value: ₹${formattedRev}, Code: ${project.projectId}).`,
          type: 'Project',
          severity: 'info',
          link: `/projects/${project.projectId || project._id}`,
          projectId: project.projectId,
          projectName: project.name,
          customerName: project.customer?.name || '',
          revenue: project.revenue || 0,
          read: false,
          at: new Date()
        });
        console.log(`🔔 [Notification] Project assignment notification generated for PM: ${project.manager}`);

        if (emp?.email) {
          sendProjectAssignmentEmail(project, emp).catch((err) => {
            console.warn('[Notification] Background assignment email failed:', err.message);
          });
        }
      } catch (notifErr) {
        console.error('⚠️ [Notification] Failed to create project assignment notification:', notifErr);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(400).json({ success: false, message: 'Failed to create project', error: error.message });
  }
};

// PUT /api/projects/:id — Update project
export const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { projectId: id }]
    });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const prevManager = project.manager;
    Object.assign(project, req.body);
    await project.save();

    // Trigger notification if project manager is newly assigned or changed
    if (req.body.manager && req.body.manager !== prevManager && req.body.manager !== 'Unassigned') {
      try {
        const emp = await Employee.findOne({
          $or: [
            { fullName: { $regex: `^${req.body.manager.trim()}$`, $options: 'i' } },
            { firstName: { $regex: `^${req.body.manager.trim()}$`, $options: 'i' } }
          ]
        });

        const formattedRev = Number(project.revenue || 0).toLocaleString('en-IN');
        await Notification.create({
          recipient: req.body.manager,
          recipientEmail: emp?.email || '',
          recipientRole: emp?.role || 'project manager',
          title: `Project Assigned: ${project.name}`,
          detail: `You have been assigned as Project Manager for "${project.name}" (Client: ${project.customer?.name || 'Customer'}, Value: ₹${formattedRev}, Code: ${project.projectId}).`,
          type: 'Project',
          severity: 'info',
          link: `/projects/${project.projectId || project._id}`,
          projectId: project.projectId,
          projectName: project.name,
          customerName: project.customer?.name || '',
          revenue: project.revenue || 0,
          read: false,
          at: new Date()
        });

        if (emp?.email) {
          sendProjectAssignmentEmail(project, emp).catch(() => {});
        }
      } catch (notifErr) {
        console.error('⚠️ [Notification] Failed to create project reassignment notification:', notifErr);
      }
    }

    res.json({
      success: true,
      message: 'Project updated successfully',
      project
    });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(400).json({ success: false, message: 'Failed to update project', error: error.message });
  }
};

// DELETE /api/projects/:id — Delete project
export const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findOneAndDelete({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { projectId: id }]
    });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete project', error: error.message });
  }
};

// POST /api/projects/:id/costs — Add cost line to project
export const addProjectCost = async (req, res) => {
  try {
    const { id } = req.params;
    const { head, category, amount, reference, notes, date } = req.body;

    if (!head || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Cost head and amount are required' });
    }

    const project = await Project.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { projectId: id }]
    });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    project.costs.push({
      head,
      category: category || 'Materials',
      amount: Number(amount) || 0,
      reference: reference || '',
      notes: notes || '',
      date: date || new Date()
    });

    await project.save();

    res.json({
      success: true,
      message: 'Cost added successfully',
      project
    });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Failed to add cost', error: error.message });
  }
};

// PUT /api/projects/:id/costs/:costId — Update a cost line
export const updateProjectCost = async (req, res) => {
  try {
    const { id, costId } = req.params;
    const { head, category, amount, reference, notes, date } = req.body;

    const project = await Project.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { projectId: id }]
    });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const costItem = (project.costs && project.costs.id)
      ? project.costs.id(costId)
      : project.costs.find((c) => c._id && c._id.toString() === costId);

    if (!costItem) {
      return res.status(404).json({ success: false, message: 'Cost entry not found' });
    }

    if (head !== undefined) costItem.head = head;
    if (category !== undefined) costItem.category = category;
    if (amount !== undefined) costItem.amount = Number(amount) || 0;
    if (reference !== undefined) costItem.reference = reference;
    if (notes !== undefined) costItem.notes = notes;
    if (date !== undefined) costItem.date = date;

    await project.save();

    res.json({
      success: true,
      message: 'Cost entry updated successfully',
      project,
      costItem
    });
  } catch (error) {
    console.error('Error updating project cost:', error);
    res.status(400).json({ success: false, message: 'Failed to update cost entry', error: error.message });
  }
};

// DELETE /api/projects/:id/costs/:costId — Delete a cost line
export const deleteProjectCost = async (req, res) => {
  try {
    const { id, costId } = req.params;
    const project = await Project.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { projectId: id }]
    });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    project.costs = project.costs.filter((c) => c._id && c._id.toString() !== costId);
    await project.save();

    res.json({
      success: true,
      message: 'Cost entry deleted successfully',
      project
    });
  } catch (error) {
    console.error('Error deleting project cost:', error);
    res.status(500).json({ success: false, message: 'Failed to delete cost entry', error: error.message });
  }
};

// GET /api/projects/profitability-summary — Deep profitability analytics across all projects
export const getProfitabilitySummary = async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });

    let totalRevenue = 0;
    let totalEstimatedCost = 0;
    let totalActualCost = 0;

    const categoryBreakdown = {
      Materials: 0,
      Subcontractor: 0,
      Labor: 0,
      'Travel & Site': 0,
      Expenses: 0,
      Other: 0
    };

    const projectBreakdown = projects.map(p => {
      const revenue = Number(p.revenue) || 0;
      const estimatedCost = Number(p.estimatedCost) || 0;
      const actualCost = calculateProjectActualCost(p);
      const grossProfit = revenue - actualCost;
      const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
      const variance = estimatedCost > 0 ? actualCost - estimatedCost : 0;

      totalRevenue += revenue;
      totalEstimatedCost += estimatedCost;
      totalActualCost += actualCost;

      p.costs.forEach(c => {
        const cat = c.category || 'Other';
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + (Number(c.amount) || 0);
      });

      return {
        id: p.projectId || p._id,
        _id: p._id,
        name: p.name,
        customerName: p.customer?.name || '—',
        status: p.status,
        progress: p.progress,
        revenue,
        estimatedCost,
        actualCost,
        grossProfit,
        margin,
        variance,
        isLoss: grossProfit < 0,
        supplierCount: p.suppliers?.length || 0,
        teamCount: p.team?.length || 0
      };
    });

    const totalGrossProfit = totalRevenue - totalActualCost;
    const overallMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
    const lossMakingCount = projectBreakdown.filter(p => p.isLoss).length;
    const highMarginCount = projectBreakdown.filter(p => p.margin >= 25).length;
    const healthyMarginCount = projectBreakdown.filter(p => p.margin >= 15 && p.margin < 25).length;
    const lowMarginCount = projectBreakdown.filter(p => p.margin >= 0 && p.margin < 15).length;

    const allCosts = [];
    projects.forEach((p) => {
      (p.costs || []).forEach((c) => {
        allCosts.push({
          _id: c._id,
          projectId: p.projectId || p._id,
          projectName: p.name,
          customerName: p.customer?.name || '—',
          head: c.head,
          category: c.category || 'Other',
          amount: Number(c.amount) || 0,
          reference: c.reference || '',
          notes: c.notes || '',
          date: c.date || p.createdAt
        });
      });
    });
    allCosts.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      success: true,
      summary: {
        totalProjects: projects.length,
        totalRevenue,
        totalEstimatedCost,
        totalActualCost,
        totalGrossProfit,
        overallMargin,
        lossMakingCount,
        highMarginCount,
        healthyMarginCount,
        lowMarginCount
      },
      categoryBreakdown,
      projects: projectBreakdown,
      allCosts,
      rawProjects: projects.map((p) => ({
        id: p.projectId || p._id,
        _id: p._id,
        name: p.name,
        customerName: p.customer?.name || '—'
      }))
    });
  } catch (error) {
    console.error('Error in getProfitabilitySummary:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profitability analytics', error: error.message });
  }
};
