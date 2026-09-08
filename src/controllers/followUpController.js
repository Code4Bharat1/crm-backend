import FollowUp from '../models/FollowUp.js';
import { generateFollowUps, getFollowUpCounts } from '../utils/followUpEngine.js';

// GET /api/follow-ups -- syncs fresh from real documents, then returns the list
export const getFollowUps = async (req, res) => {
  try {
    await generateFollowUps();
    const { status } = req.query;
    const query = status ? { status } : {};
    const followUps = await FollowUp.find(query).sort({ dueDate: 1 });
    res.json(followUps);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching follow-ups', error: error.message });
  }
};

// GET /api/follow-ups/stats
export const getFollowUpStats = async (req, res) => {
  try {
    await generateFollowUps();
    const counts = await getFollowUpCounts();
    res.json(counts);
  } catch (error) {
    res.status(500).json({ message: 'Error computing follow-up stats', error: error.message });
  }
};

// POST /api/follow-ups/generate -- explicit re-sync trigger (e.g. a "Sync now" button)
export const syncFollowUps = async (req, res) => {
  try {
    const before = await FollowUp.countDocuments();
    await generateFollowUps();
    const after = await FollowUp.countDocuments();
    res.json({ created: after - before });
  } catch (error) {
    res.status(500).json({ message: 'Error syncing follow-ups', error: error.message });
  }
};

// POST /api/follow-ups -- manual entry
export const createFollowUp = async (req, res) => {
  try {
    const { customerName, dueDate, owner, priority, note } = req.body;
    if (!customerName || !dueDate) {
      return res.status(400).json({ message: 'customerName and dueDate are required' });
    }
    const followUp = await FollowUp.create({
      customerName,
      dueDate,
      owner: owner || 'Sales Team',
      priority: priority || 'Medium',
      note: note || '',
      type: 'Manual',
      source: 'Manual',
    });
    res.status(201).json(followUp);
  } catch (error) {
    res.status(400).json({ message: 'Error creating follow-up', error: error.message });
  }
};

// PUT /api/follow-ups/:id -- edit, or change status (Pending/Completed/Snoozed)
export const updateFollowUp = async (req, res) => {
  try {
    const followUp = await FollowUp.findById(req.params.id);
    if (!followUp) return res.status(404).json({ message: 'Follow-up not found' });

    const { status, dueDate, owner, priority, note } = req.body;
    if (status && status !== followUp.status) {
      followUp.status = status;
      if (status === 'Completed') {
        followUp.completedAt = new Date();
        followUp.completedBy = req.user?.name || req.user?.email || req.body.completedBy || 'CRM User';
      } else {
        followUp.completedAt = null;
        followUp.completedBy = '';
      }
    }
    if (dueDate) followUp.dueDate = dueDate;
    if (owner) followUp.owner = owner;
    if (priority) followUp.priority = priority;
    if (note !== undefined) followUp.note = note;

    await followUp.save();
    res.json(followUp);
  } catch (error) {
    res.status(400).json({ message: 'Error updating follow-up', error: error.message });
  }
};

// DELETE /api/follow-ups/:id
export const deleteFollowUp = async (req, res) => {
  try {
    const followUp = await FollowUp.findByIdAndDelete(req.params.id);
    if (!followUp) return res.status(404).json({ message: 'Follow-up not found' });
    res.json({ message: 'Follow-up deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting follow-up', error: error.message });
  }
};
