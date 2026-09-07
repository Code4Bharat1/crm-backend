import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import connectDB from '../src/config/db.js';
import Notification from '../src/models/Notification.js';
import Employee from '../src/models/Employee.js';
import ServiceRequest from '../src/models/ServiceRequest.js';
import Project from '../src/models/Project.js';
import Customer from '../src/models/Customer.js';

async function seedNotifications() {
  await connectDB();
  console.log('Connected to MongoDB. Cleaning dummy notifications and seeding real ones...');

  // Delete all old dummy test notifications
  await Notification.deleteMany({
    $or: [
      { projectName: { $regex: /TEMP_TEST/i } },
      { customerName: { $regex: /Temp Test/i } },
      { title: { $regex: /TEMP_/i } },
      { detail: { $regex: /TEMP_/i } }
    ]
  });

  const employees = await Employee.find().lean();
  const techEmp = employees.find(e => e.role?.toLowerCase().includes('tech')) || employees[1];
  const mgrEmp = employees.find(e => e.role?.toLowerCase().includes('manager')) || employees[0];
  const salesEmp = employees.find(e => e.role?.toLowerCase().includes('sale')) || employees[employees.length - 1];

  const now = new Date();
  const hoursAgo = (h) => new Date(now.getTime() - h * 3600000);

  const realNotifs = [
    // 1. Service Ticket Assignment for Technician
    {
      recipient: techEmp ? techEmp.fullName : 'Amit Patel',
      recipientEmail: techEmp?.email || 'amit.patel@nexcore.com',
      recipientRole: 'Technician',
      title: 'Service Request Assigned: SR-2026-001',
      detail: 'You have been assigned to service ticket SR-2026-001 (Intermittent Profinet communication drop) for Tata AutoComp Systems Ltd. Equipment: Siemens S7-1500 PLC CPU 1515-2 PN. Priority: High.',
      type: 'Service',
      severity: 'warning',
      link: '/service',
      projectId: 'PRJ-2026-001',
      projectName: 'Weighbridge Automation & SCADA Integration',
      customerName: 'Tata AutoComp Systems Ltd.',
      revenue: 0,
      read: false,
      at: hoursAgo(2)
    },
    {
      recipient: techEmp ? techEmp.fullName : 'Amit Patel',
      recipientEmail: techEmp?.email || 'amit.patel@nexcore.com',
      recipientRole: 'Technician',
      title: 'Emergency Breakdown Alert: SR-2026-002',
      detail: 'Urgent service ticket SR-2026-002: Danfoss VFD FC-302 tripping on Alarm 14 at Sai Precision Auto Bhosari plant. Immediate dispatch required.',
      type: 'Service',
      severity: 'danger',
      link: '/service',
      projectId: 'PRJ-2026-004',
      projectName: 'Automotive Conveyor Assembly VFD Modernisation',
      customerName: 'Sai Precision Auto Pvt Ltd',
      revenue: 0,
      read: false,
      at: hoursAgo(5)
    },

    // 2. Project Assignment for Project Manager
    {
      recipient: mgrEmp ? mgrEmp.fullName : 'Demo Employee',
      recipientEmail: mgrEmp?.email || 'nextdemo09@gmail.com',
      recipientRole: 'Project Manager',
      title: 'Project Assigned: PRJ-2026-001',
      detail: 'You are assigned as Project Manager for "Weighbridge Automation & SCADA Integration" (Client: Tata AutoComp Systems Ltd., Contract: ₹18.5L). Kickoff milestone is scheduled for next Monday.',
      type: 'Project',
      severity: 'info',
      link: '/projects',
      projectId: 'PRJ-2026-001',
      projectName: 'Weighbridge Automation & SCADA Integration',
      customerName: 'Tata AutoComp Systems Ltd.',
      revenue: 1850000,
      read: false,
      at: hoursAgo(12)
    },
    {
      recipient: mgrEmp ? mgrEmp.fullName : 'Demo Employee',
      recipientEmail: mgrEmp?.email || 'nextdemo09@gmail.com',
      recipientRole: 'Project Manager',
      title: 'Milestone FAT Approved: PRJ-2026-002',
      detail: 'Robotic Welding Cell Safety & PLC Overhaul at Bharat Forge Limited has passed Factory Acceptance Testing. Ready for site installation.',
      type: 'Project',
      severity: 'success',
      link: '/projects',
      projectId: 'PRJ-2026-002',
      projectName: 'Robotic Welding Cell Safety & PLC Overhaul',
      customerName: 'Bharat Forge Limited',
      revenue: 1450000,
      read: false,
      at: hoursAgo(24)
    },

    // 3. Customer Account Assignment for Sales
    {
      recipient: salesEmp ? salesEmp.fullName : 'raj fsdafdsfd',
      recipientEmail: salesEmp?.email || 'rs9940806@gmail.com',
      recipientRole: 'sales',
      title: 'Key Account Assigned: Tata AutoComp Systems Ltd.',
      detail: 'You have been assigned as primary Salesperson & Account Manager for Tata AutoComp Systems Ltd. (Automotive OEM, Chakan MIDC).',
      type: 'Customer',
      severity: 'info',
      link: '/customers',
      projectId: '',
      projectName: '',
      customerName: 'Tata AutoComp Systems Ltd.',
      revenue: 3450000,
      read: false,
      at: hoursAgo(18)
    },
    {
      recipient: salesEmp ? salesEmp.fullName : 'raj fsdafdsfd',
      recipientEmail: salesEmp?.email || 'rs9940806@gmail.com',
      recipientRole: 'sales',
      title: 'Key Account Assigned: Bharat Forge Limited',
      detail: 'You have been assigned as primary Salesperson & Account Manager for Bharat Forge Limited (Mundhwa, Pune). Commercial quotation pending review.',
      type: 'Customer',
      severity: 'info',
      link: '/customers',
      projectId: '',
      projectName: '',
      customerName: 'Bharat Forge Limited',
      revenue: 5200000,
      read: false,
      at: hoursAgo(30)
    },
    // Also duplicate for Sales  Test so either salesperson sees their assignments
    {
      recipient: 'Sales  Test',
      recipientEmail: 'mohdnexcore@gmail.com',
      recipientRole: 'sales',
      title: 'Key Account Assigned: Deccan Sugar Mills Ltd.',
      detail: 'You have been assigned as primary Salesperson for Deccan Sugar Mills Ltd. (Baramati MIDC). Boiler VFD drive order confirmed.',
      type: 'Customer',
      severity: 'info',
      link: '/customers',
      projectId: '',
      projectName: '',
      customerName: 'Deccan Sugar Mills Ltd.',
      revenue: 2800000,
      read: false,
      at: hoursAgo(8)
    }
  ];

  for (const n of realNotifs) {
    await Notification.findOneAndUpdate(
      { title: n.title, recipient: n.recipient },
      n,
      { upsert: true, returnDocument: 'after' }
    );
  }

  const count = await Notification.countDocuments();
  console.log(`✅ Seeded ${realNotifs.length} real company notifications. Total notifications in DB: ${count}`);
  process.exit(0);
}

seedNotifications().catch(err => {
  console.error('Error seeding notifications:', err);
  process.exit(1);
});
