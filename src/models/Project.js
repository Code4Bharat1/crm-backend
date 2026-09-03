import mongoose from 'mongoose';

const costItemSchema = new mongoose.Schema({
  head: { type: String, required: true },
  category: {
    type: String,
    enum: ['Materials', 'Subcontractor', 'Labor', 'Travel & Site', 'Expenses', 'Other'],
    default: 'Materials'
  },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
  reference: { type: String, default: '' },
  notes: { type: String, default: '' }
}, { _id: true });

const milestoneSchema = new mongoose.Schema({
  title: { type: String, required: true },
  dueDate: { type: Date },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed'],
    default: 'Pending'
  },
  progress: { type: Number, default: 0, min: 0, max: 100 }
}, { _id: true });

const siteVisitSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  engineer: { type: String, required: true },
  purpose: { type: String, required: true },
  outcome: { type: String, default: '' }
}, { _id: true });

const projectSchema = new mongoose.Schema({
  projectId: { type: String, unique: true }, // e.g. PRJ-2026-001
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  customer: {
    id: { type: String },
    name: { type: String, required: true },
    email: { type: String, default: '' },
    phone: { type: String, default: '' }
  },
  manager: { type: String, default: 'Unassigned' },
  team: [{
    employeeId: { type: String },
    name: { type: String, required: true },
    role: { type: String, default: 'Project Engineer' },
    daysAllocated: { type: Number, default: 0 }
  }],
  suppliers: [{
    supplierId: { type: String },
    name: { type: String, required: true },
    amount: { type: Number, default: 0 },
    poRef: { type: String, default: '' }
  }],
  status: {
    type: String,
    enum: ['Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled'],
    default: 'Planning'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  start: { type: Date, default: Date.now },
  end: { type: Date },
  actualEnd: { type: Date },
  revenue: { type: Number, default: 0, min: 0 }, // Contract value / Billed revenue
  estimatedCost: { type: Number, default: 0, min: 0 }, // Budget
  costs: [costItemSchema],
  milestones: [milestoneSchema],
  siteVisits: [siteVisitSchema],
  soRef: { type: String, default: '' },
  notes: { type: String, default: '' }
}, { timestamps: true });

// Auto-generate projectId if not provided
projectSchema.pre('validate', async function () {
  if (!this.projectId) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Project').countDocuments();
    this.projectId = `PRJ-${year}-${String(count + 1).padStart(3, '0')}`;
  }
});

export default mongoose.model('Project', projectSchema);
