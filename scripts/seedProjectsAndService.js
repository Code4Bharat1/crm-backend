import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import connectDB from '../src/config/db.js';
import Project from '../src/models/Project.js';
import ServiceRequest from '../src/models/ServiceRequest.js';
import Warranty from '../src/models/Warranty.js';
import Customer from '../src/models/Customer.js';
import SerialNumber from '../src/models/SerialNumber.js';
import Employee from '../src/models/Employee.js';

async function seed() {
  await connectDB();
  console.log('Connected to MongoDB. Seeding Projects & Service...');

  const customers = await Customer.find().limit(10);
  const employees = await Employee.find().limit(10);
  const serials = await SerialNumber.find().limit(12);

  const getCust = (i, fallback) => (customers[i] ? { id: customers[i].id, name: customers[i].name, email: customers[i].contactPerson?.email || 'contact@client.com', phone: customers[i].contactPerson?.phone || '+91 98220 12345' } : fallback);
  const getEmpName = (i, fallback) => (employees[i] ? employees[i].fullName : fallback);

  // ─── 1. SEED PROJECTS ────────────────────────────────────────────────────────
  await Project.deleteMany({});

  const sampleProjects = [
    {
      projectId: 'PRJ-2026-001',
      name: 'Weighbridge Automation & SCADA Integration',
      description: 'End-to-end automated weighbridge monitoring, RFID truck identification, and SAP ERP weighment integration.',
      customer: getCust(0, { id: 'CUST-001', name: 'Tata AutoComp Systems Ltd.' }),
      manager: getEmpName(0, 'Rohit Sharma'),
      team: [
        { employeeId: 'EMP-001', name: getEmpName(0, 'Rohit Sharma'), role: 'Project Manager', daysAllocated: 24 },
        { employeeId: 'EMP-002', name: getEmpName(1, 'Amit Patel'), role: 'PLC Automation Engineer', daysAllocated: 30 },
        { employeeId: 'EMP-003', name: getEmpName(2, 'Priya Nair'), role: 'SCADA & Software Developer', daysAllocated: 18 }
      ],
      suppliers: [
        { supplierId: 'SUP-001', name: 'Schneider Electric India', amount: 320000, poRef: 'PO-2026-001' },
        { supplierId: 'SUP-002', name: 'Phoenix Contact Pune', amount: 145000, poRef: 'PO-2026-002' }
      ],
      status: 'In Progress',
      priority: 'High',
      progress: 65,
      start: new Date(Date.now() - 45 * 86400000),
      end: new Date(Date.now() + 30 * 86400000),
      revenue: 1850000,
      estimatedCost: 1200000,
      costs: [
        { head: 'PLC Hardware & I/O Modules', category: 'Materials', amount: 465000, date: new Date(Date.now() - 35 * 86400000), reference: 'PO-2026-001' },
        { head: 'Control Panel Fabrication & Wiring', category: 'Subcontractor', amount: 185000, date: new Date(Date.now() - 25 * 86400000) },
        { head: 'Engineering & Commissioning Effort', category: 'Labor', amount: 240000, date: new Date(Date.now() - 15 * 86400000) },
        { head: 'Site Installation & Vehicle RFID Setup', category: 'Travel & Site', amount: 75000, date: new Date(Date.now() - 5 * 86400000) }
      ],
      milestones: [
        { title: 'Functional Design Specification (FDS)', dueDate: new Date(Date.now() - 35 * 86400000), status: 'Completed', progress: 100 },
        { title: 'Control Panel Assembly & FAT', dueDate: new Date(Date.now() - 15 * 86400000), status: 'Completed', progress: 100 },
        { title: 'Site Cabling & RFID Hardware Deployment', dueDate: new Date(Date.now() + 5 * 86400000), status: 'In Progress', progress: 70 },
        { title: 'Final Handover & Client Signoff', dueDate: new Date(Date.now() + 30 * 86400000), status: 'Pending', progress: 0 }
      ],
      siteVisits: [
        { date: new Date(Date.now() - 20 * 86400000), engineer: getEmpName(1, 'Amit Patel'), purpose: 'Initial cable layout and pit dimension verification', outcome: 'Pit dimensions confirmed, conduit routes marked' },
        { date: new Date(Date.now() - 8 * 86400000), engineer: getEmpName(0, 'Rohit Sharma'), purpose: 'Panel installation on site', outcome: 'Cabinet mounted on plinth, power source tested' }
      ]
    },
    {
      projectId: 'PRJ-2026-002',
      name: 'Robotic Welding Cell Safety & PLC Overhaul',
      description: 'Upgrading existing robotic MIG cell with safety interlocks, light curtains, and Siemens S7-1500 safety PLC.',
      customer: getCust(1, { id: 'CUST-002', name: 'Bharat Forge Limited' }),
      manager: getEmpName(0, 'Rohit Sharma'),
      team: [
        { employeeId: 'EMP-001', name: getEmpName(0, 'Rohit Sharma'), role: 'Project Manager', daysAllocated: 15 },
        { employeeId: 'EMP-004', name: getEmpName(3, 'Suresh Kadam'), role: 'Robotics Specialist', daysAllocated: 20 }
      ],
      suppliers: [
        { supplierId: 'SUP-003', name: 'Siemens Industrial Automation', amount: 540000, poRef: 'PO-2026-005' }
      ],
      status: 'In Progress',
      priority: 'Critical',
      progress: 40,
      start: new Date(Date.now() - 20 * 86400000),
      end: new Date(Date.now() + 40 * 86400000),
      revenue: 1420000,
      estimatedCost: 950000,
      costs: [
        { head: 'Siemens Safety PLC & Safety Gate Switches', category: 'Materials', amount: 540000, date: new Date(Date.now() - 15 * 86400000) },
        { head: 'Safety Audit & Risk Assessment Certification', category: 'Subcontractor', amount: 110000, date: new Date(Date.now() - 10 * 86400000) },
        { head: 'Robot Teaching & PLC Programming', category: 'Labor', amount: 120000, date: new Date(Date.now() - 3 * 86400000) }
      ],
      milestones: [
        { title: 'Hazard & Safety Audit Document', dueDate: new Date(Date.now() - 10 * 86400000), status: 'Completed', progress: 100 },
        { title: 'PLC Panel Rewiring', dueDate: new Date(Date.now() + 10 * 86400000), status: 'In Progress', progress: 50 },
        { title: 'Safety Validation & Interlock Testing', dueDate: new Date(Date.now() + 25 * 86400000), status: 'Pending', progress: 0 }
      ]
    },
    {
      projectId: 'PRJ-2026-003',
      name: 'Pharmaceutical Packaging Line SCADA & CFR Part 11 Compliance',
      description: 'Audit trail logging, e-signatures, and batch record generation complying with US FDA 21 CFR Part 11.',
      customer: getCust(2, { id: 'CUST-003', name: 'Cipla Pharmaceuticals Ltd.' }),
      manager: getEmpName(2, 'Priya Nair'),
      team: [
        { employeeId: 'EMP-003', name: getEmpName(2, 'Priya Nair'), role: 'Validation Specialist', daysAllocated: 35 },
        { employeeId: 'EMP-002', name: getEmpName(1, 'Amit Patel'), role: 'SCADA Engineer', daysAllocated: 25 }
      ],
      suppliers: [
        { supplierId: 'SUP-004', name: 'Rockwell Automation India', amount: 620000, poRef: 'PO-2026-008' }
      ],
      status: 'Completed',
      priority: 'High',
      progress: 100,
      start: new Date(Date.now() - 90 * 86400000),
      end: new Date(Date.now() - 5 * 86400000),
      actualEnd: new Date(Date.now() - 5 * 86400000),
      revenue: 2600000,
      estimatedCost: 1650000,
      costs: [
        { head: 'Industrial PC & FactoryTalk SCADA License', category: 'Materials', amount: 620000, date: new Date(Date.now() - 75 * 86400000) },
        { head: 'IQ/OQ/PQ Validation Protocol Documentation', category: 'Labor', amount: 350000, date: new Date(Date.now() - 40 * 86400000) },
        { head: 'Database Backup Server & UPS', category: 'Materials', amount: 180000, date: new Date(Date.now() - 30 * 86400000) },
        { head: 'Third-party CFR Compliance Audit', category: 'Subcontractor', amount: 220000, date: new Date(Date.now() - 10 * 86400000) }
      ],
      milestones: [
        { title: 'User Requirement Specification (URS)', dueDate: new Date(Date.now() - 80 * 86400000), status: 'Completed', progress: 100 },
        { title: 'Installation Qualification (IQ)', dueDate: new Date(Date.now() - 50 * 86400000), status: 'Completed', progress: 100 },
        { title: 'Operational Qualification (OQ)', dueDate: new Date(Date.now() - 20 * 86400000), status: 'Completed', progress: 100 },
        { title: 'Final Production Handover (PQ)', dueDate: new Date(Date.now() - 5 * 86400000), status: 'Completed', progress: 100 }
      ]
    },
    {
      projectId: 'PRJ-2026-004',
      name: 'Automotive Conveyor Assembly VFD Modernisation',
      description: 'Replacement of legacy DC drives with energy-efficient AC VFDs across 14 conveyor sections.',
      customer: getCust(3, { id: 'CUST-004', name: 'Mahindra & Mahindra Chakan' }),
      manager: getEmpName(1, 'Amit Patel'),
      team: [
        { employeeId: 'EMP-002', name: getEmpName(1, 'Amit Patel'), role: 'Drives Engineer', daysAllocated: 20 },
        { employeeId: 'EMP-004', name: getEmpName(3, 'Suresh Kadam'), role: 'Electrician', daysAllocated: 15 }
      ],
      suppliers: [
        { supplierId: 'SUP-005', name: 'Danfoss Drives India', amount: 780000, poRef: 'PO-2026-012' }
      ],
      status: 'In Progress',
      priority: 'Medium',
      progress: 80,
      start: new Date(Date.now() - 30 * 86400000),
      end: new Date(Date.now() + 10 * 86400000),
      revenue: 1680000,
      estimatedCost: 1100000,
      costs: [
        { head: '14x Danfoss VLT Automation Drives', category: 'Materials', amount: 780000, date: new Date(Date.now() - 25 * 86400000) },
        { head: 'Busbar & Heavy Cable Modifications', category: 'Materials', amount: 95000, date: new Date(Date.now() - 18 * 86400000) },
        { head: 'Weekend Shift Commissioning Labor', category: 'Labor', amount: 160000, date: new Date(Date.now() - 8 * 86400000) }
      ],
      milestones: [
        { title: 'Drive Procurement & Delivery', dueDate: new Date(Date.now() - 20 * 86400000), status: 'Completed', progress: 100 },
        { title: 'Section 1-7 Retrofit', dueDate: new Date(Date.now() - 5 * 86400000), status: 'Completed', progress: 100 },
        { title: 'Section 8-14 Retrofit', dueDate: new Date(Date.now() + 10 * 86400000), status: 'In Progress', progress: 60 }
      ]
    },
    {
      projectId: 'PRJ-2026-005',
      name: 'Boiler Combustion Air Ratio Control System',
      description: 'Precision oxygen trim and variable speed combustion blower system to reduce heavy oil consumption.',
      customer: getCust(4, { id: 'CUST-005', name: 'Thermax Limited' }),
      manager: getEmpName(0, 'Rohit Sharma'),
      team: [
        { employeeId: 'EMP-001', name: getEmpName(0, 'Rohit Sharma'), role: 'Combustion Specialist', daysAllocated: 18 }
      ],
      suppliers: [],
      status: 'Planning',
      priority: 'Medium',
      progress: 15,
      start: new Date(Date.now() - 10 * 86400000),
      end: new Date(Date.now() + 60 * 86400000),
      revenue: 950000,
      estimatedCost: 650000,
      costs: [
        { head: 'Zirconia Oxygen Analyzer Probe', category: 'Materials', amount: 145000, date: new Date(Date.now() - 5 * 86400000) },
        { head: 'Site Engineering Survey & Flue Gas Sampling', category: 'Travel & Site', amount: 35000, date: new Date(Date.now() - 2 * 86400000) }
      ],
      milestones: [
        { title: 'Flue Gas Baseline Audit', dueDate: new Date(Date.now() - 2 * 86400000), status: 'Completed', progress: 100 },
        { title: 'Analyzer & Damper Actuator Mounting', dueDate: new Date(Date.now() + 20 * 86400000), status: 'Pending', progress: 0 }
      ]
    },
    {
      projectId: 'PRJ-2026-006',
      name: 'Cleanroom AHU Airflow Balancing & HEPA Monitoring',
      description: 'Automated differential pressure dampers, particle counter integration, and BMS communication.',
      customer: getCust(2, { id: 'CUST-003', name: 'Cipla Pharmaceuticals Ltd.' }),
      manager: getEmpName(2, 'Priya Nair'),
      team: [{ employeeId: 'EMP-003', name: getEmpName(2, 'Priya Nair'), role: 'BMS Engineer', daysAllocated: 12 }],
      suppliers: [],
      status: 'In Progress',
      priority: 'Low',
      progress: 50,
      start: new Date(Date.now() - 25 * 86400000),
      end: new Date(Date.now() + 25 * 86400000),
      revenue: 720000,
      estimatedCost: 780000, // Loss making demonstration
      costs: [
        { head: 'Magnehelic Differential Pressure Transmitters', category: 'Materials', amount: 280000, date: new Date(Date.now() - 20 * 86400000) },
        { head: 'Unscheduled Ducting Re-routing Fabrication', category: 'Subcontractor', amount: 310000, date: new Date(Date.now() - 10 * 86400000) },
        { head: 'Emergency Calibration Engineer Deployment', category: 'Labor', amount: 210000, date: new Date(Date.now() - 2 * 86400000) }
      ],
      milestones: [
        { title: 'Duct Pressure Sensor Hookup', dueDate: new Date(Date.now() - 10 * 86400000), status: 'Completed', progress: 100 },
        { title: 'Ducting Rework Due To Interference', dueDate: new Date(Date.now() + 5 * 86400000), status: 'In Progress', progress: 50 }
      ]
    }
  ];

  await Project.insertMany(sampleProjects);
  console.log(`✅ Seeded ${sampleProjects.length} Projects`);

  // ─── 2. SEED WARRANTIES ───────────────────────────────────────────────────────
  await Warranty.deleteMany({});

  const sampleWarranties = [
    {
      warrantyNo: 'WAR-2026-001',
      serialNo: serials[0]?.serialNo || 'SN-2026-0001',
      product: { id: 'PRD-001', name: 'Siemens S7-1500 PLC CPU 1515-2 PN', itemCode: '6ES7515-2AM02-0AB0' },
      customer: getCust(0, { id: 'CUST-001', name: 'Tata AutoComp Systems Ltd.' }),
      invoiceRef: 'INV-2026-0089',
      startDate: new Date(Date.now() - 180 * 86400000),
      endDate: new Date(Date.now() + 185 * 86400000),
      durationMonths: 12,
      status: 'Active',
      coverageType: 'Comprehensive',
      serviceCount: 1
    },
    {
      warrantyNo: 'WAR-2026-002',
      serialNo: serials[1]?.serialNo || 'SN-2026-0002',
      product: { id: 'PRD-002', name: 'Danfoss VFD FC-302 Automation Drive 15kW', itemCode: 'FC-302P15KT4' },
      customer: getCust(3, { id: 'CUST-004', name: 'Mahindra & Mahindra Chakan' }),
      invoiceRef: 'INV-2026-0074',
      startDate: new Date(Date.now() - 340 * 86400000),
      endDate: new Date(Date.now() + 25 * 86400000), // Expiring in 25 days!
      durationMonths: 12,
      status: 'Expiring Soon',
      coverageType: 'Standard Manufacturer',
      serviceCount: 2
    },
    {
      warrantyNo: 'WAR-2026-003',
      serialNo: serials[2]?.serialNo || 'SN-2026-0003',
      product: { id: 'PRD-003', name: 'Endress+Hauser Promass Coriolis Flowmeter', itemCode: '83F50-AA2SAAA' },
      customer: getCust(4, { id: 'CUST-005', name: 'Thermax Limited' }),
      invoiceRef: 'INV-2025-0142',
      startDate: new Date(Date.now() - 400 * 86400000),
      endDate: new Date(Date.now() - 35 * 86400000), // Expired
      durationMonths: 12,
      status: 'Expired',
      coverageType: 'Standard Manufacturer',
      serviceCount: 0
    },
    {
      warrantyNo: 'WAR-2026-004',
      serialNo: serials[3]?.serialNo || 'SN-2026-0004',
      product: { id: 'PRD-004', name: 'Schneider Magelis HMI 12-Inch Touch Panel', itemCode: 'HMISTU855' },
      customer: getCust(1, { id: 'CUST-002', name: 'Bharat Forge Limited' }),
      invoiceRef: 'INV-2025-0098',
      startDate: new Date(Date.now() - 450 * 86400000),
      endDate: new Date(Date.now() + 270 * 86400000),
      durationMonths: 24,
      status: 'Active',
      coverageType: 'AMC',
      serviceCount: 3,
      amc: { isAmc: true, contractNo: 'AMC-2026-BF-01', value: 85000, renewalDate: new Date(Date.now() - 85 * 86400000) }
    },
    {
      warrantyNo: 'WAR-2026-005',
      serialNo: serials[4]?.serialNo || 'SN-2026-0005',
      product: { id: 'PRD-005', name: 'Weidmuller 24VDC 20A Switched Power Supply', itemCode: 'PRO-MAX-480W' },
      customer: getCust(2, { id: 'CUST-003', name: 'Cipla Pharmaceuticals Ltd.' }),
      invoiceRef: 'INV-2026-0045',
      startDate: new Date(Date.now() - 60 * 86400000),
      endDate: new Date(Date.now() + 305 * 86400000),
      durationMonths: 12,
      status: 'Active',
      coverageType: 'Comprehensive',
      serviceCount: 0
    },
    {
      warrantyNo: 'WAR-2026-006',
      serialNo: serials[5]?.serialNo || 'SN-2026-0006',
      product: { id: 'PRD-006', name: 'Sick Laser Scanner S3000 Safety Sensor', itemCode: 'S30A-4011BA' },
      customer: getCust(1, { id: 'CUST-002', name: 'Bharat Forge Limited' }),
      invoiceRef: 'INV-2026-0012',
      startDate: new Date(Date.now() - 345 * 86400000),
      endDate: new Date(Date.now() + 20 * 86400000), // Expiring in 20 days!
      durationMonths: 12,
      status: 'Expiring Soon',
      coverageType: 'Standard Manufacturer',
      serviceCount: 1
    }
  ];

  await Warranty.insertMany(sampleWarranties);
  console.log(`✅ Seeded ${sampleWarranties.length} Warranties`);

  // ─── 3. SEED SERVICE REQUESTS ────────────────────────────────────────────────
  await ServiceRequest.deleteMany({});

  const sampleServiceRequests = [
    {
      requestId: 'SR-2026-001',
      customer: getCust(0, { id: 'CUST-001', name: 'Tata AutoComp Systems Ltd.' }),
      project: { id: 'PRJ-2026-001', name: 'Weighbridge Automation & SCADA Integration' },
      productName: 'Siemens S7-1500 PLC CPU 1515-2 PN',
      serialNo: serials[0]?.serialNo || 'SN-2026-0001',
      issue: 'Intermittent Profinet communication drop on IO rack 2',
      description: 'Communication drop occurs when main hydraulic press starts. Error code 0x8093 reported in diagnostic buffer.',
      type: 'Breakdown / Repair',
      priority: 'High',
      status: 'In Progress',
      underWarranty: true,
      warrantyRef: 'WAR-2026-001',
      engineer: { id: 'EMP-002', name: getEmpName(1, 'Amit Patel'), phone: '+91 98220 54321' },
      scheduledOn: new Date(Date.now() + 1 * 86400000),
      serviceCharges: 0,
      partsCost: 12500,
      travelCost: 1800,
      engineerHours: 6
    },
    {
      requestId: 'SR-2026-002',
      customer: getCust(3, { id: 'CUST-004', name: 'Mahindra & Mahindra Chakan' }),
      project: { id: 'PRJ-2026-004', name: 'Automotive Conveyor Assembly VFD Modernisation' },
      productName: 'Danfoss VFD FC-302 Automation Drive 15kW',
      serialNo: serials[1]?.serialNo || 'SN-2026-0002',
      issue: 'Drive tripping on Alarm 14 - Ground Fault during acceleration',
      description: 'Motor cable insulation tested OK. Drive triggers alarm within 3 seconds of speed ramp up.',
      type: 'Breakdown / Repair',
      priority: 'Urgent',
      status: 'Assigned',
      underWarranty: true,
      warrantyRef: 'WAR-2026-002',
      engineer: { id: 'EMP-004', name: getEmpName(3, 'Suresh Kadam'), phone: '+91 98220 99887' },
      scheduledOn: new Date(),
      serviceCharges: 0,
      partsCost: 0,
      travelCost: 1500,
      engineerHours: 2
    },
    {
      requestId: 'SR-2026-003',
      customer: getCust(4, { id: 'CUST-005', name: 'Thermax Limited' }),
      project: { id: '', name: '' },
      productName: 'Endress+Hauser Promass Coriolis Flowmeter',
      serialNo: serials[2]?.serialNo || 'SN-2026-0003',
      issue: 'Annual Calibration & Zero-Point Recalibration',
      description: 'Customer requested annual on-site calibration verification for ISO 9001 compliance audit.',
      type: 'Calibration',
      priority: 'Medium',
      status: 'Resolved',
      resolvedOn: new Date(Date.now() - 2 * 86400000),
      underWarranty: false, // Expired warranty, chargeable!
      engineer: { id: 'EMP-001', name: getEmpName(0, 'Rohit Sharma'), phone: '+91 98220 11223' },
      scheduledOn: new Date(Date.now() - 3 * 86400000),
      serviceCharges: 28000,
      partsCost: 4500,
      travelCost: 2200,
      engineerHours: 5,
      resolutionNotes: 'Zero-point recalibrated using reference calibrator. Calibration certificate CERT-2026-041 issued.'
    },
    {
      requestId: 'SR-2026-004',
      customer: getCust(1, { id: 'CUST-002', name: 'Bharat Forge Limited' }),
      project: { id: 'PRJ-2026-002', name: 'Robotic Welding Cell Safety & PLC Overhaul' },
      productName: 'Schneider Magelis HMI 12-Inch Touch Panel',
      serialNo: serials[3]?.serialNo || 'SN-2026-0004',
      issue: 'Quarterly Preventive Maintenance & Backup Battery Replacement',
      description: 'Scheduled AMC service check, cleaning cooling fans, running diagnostic self-test, and CMOS battery replacement.',
      type: 'Preventive Maintenance',
      priority: 'Low',
      status: 'Resolved',
      resolvedOn: new Date(Date.now() - 10 * 86400000),
      underWarranty: true,
      warrantyRef: 'WAR-2026-004',
      engineer: { id: 'EMP-004', name: getEmpName(3, 'Suresh Kadam'), phone: '+91 98220 99887' },
      scheduledOn: new Date(Date.now() - 11 * 86400000),
      serviceCharges: 0, // Covered under AMC
      partsCost: 1800,
      travelCost: 1200,
      engineerHours: 4,
      resolutionNotes: 'Completed quarterly PM. Replaced CMOS battery, updated firmware to v3.4, system verified in operation.'
    },
    {
      requestId: 'SR-2026-005',
      customer: getCust(1, { id: 'CUST-002', name: 'Bharat Forge Limited' }),
      project: { id: 'PRJ-2026-002', name: 'Robotic Welding Cell Safety & PLC Overhaul' },
      productName: 'Sick Laser Scanner S3000 Safety Sensor',
      serialNo: serials[5]?.serialNo || 'SN-2026-0006',
      issue: 'Optical window contamination warning and safety interlock trip',
      description: 'Laser scanner window scratched from weld spatter. Causing false trips on safety perimeter.',
      type: 'Breakdown / Repair',
      priority: 'High',
      status: 'New',
      underWarranty: true,
      warrantyRef: 'WAR-2026-006',
      engineer: { id: '', name: 'Unassigned', phone: '' },
      scheduledOn: new Date(Date.now() + 2 * 86400000),
      serviceCharges: 0,
      partsCost: 0,
      travelCost: 0,
      engineerHours: 0
    }
  ];

  await ServiceRequest.insertMany(sampleServiceRequests);
  console.log(`✅ Seeded ${sampleServiceRequests.length} Service Requests`);

  console.log('🎉 Seeding of Projects & Service suite complete!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
