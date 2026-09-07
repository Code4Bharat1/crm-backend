import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import connectDB from '../src/config/db.js';
import Customer from '../src/models/Customer.js';
import Lead from '../src/models/Lead.js';
import Product from '../src/models/Product.js';
import Quotation from '../src/models/Quotation.js';
import SalesOrder from '../src/models/SalesOrder.js';
import SalesInvoice from '../src/models/SalesInvoice.js';
import ProformaInvoice from '../src/models/ProformaInvoice.js';
import DeliveryNote from '../src/models/DeliveryNote.js';
import Employee from '../src/models/Employee.js';

async function seedCompanyData() {
  await connectDB();
  console.log('Connected to MongoDB. Seeding realistic CONTECH CRM company records...');

  const employees = await Employee.find();
  const salesEmp = employees.find(e => e.role?.toLowerCase().includes('sale')) || employees[0];
  const salesName = salesEmp ? salesEmp.fullName : 'Sales  Test';

  const now = new Date();
  const daysAgo = (d) => new Date(now.getTime() - d * 86400000);
  const monthsAgo = (m) => new Date(now.getFullYear(), now.getMonth() - m, 15);

  // ─── 1. SEED REAL CUSTOMERS ──────────────────────────────────────────────────
  const customerDocs = [
    {
      id: 'CUST-001',
      name: 'Tata AutoComp Systems Ltd.',
      type: 'OEM',
      status: 'Active',
      industry: 'Automotive',
      area: 'Chakan MIDC, Pune',
      salesPerson: salesName,
      contactPerson: { name: 'Rajesh Kulkarni', email: 'rajesh.k@tataautocomp.com', phone: '+91 98220 54321', designation: 'General Manager - Automation' },
      address: { street: 'Plot No. 28, Phase II, Chakan MIDC', city: 'Pune', state: 'Maharashtra', pinCode: '410501', country: 'India' },
      gstNumber: '27AAACT2849L1Z5',
      panNumber: 'AAACT2849L',
      paymentTerms: '30 Days Net',
      creditLimit: 5000000,
      totalRevenue: 3450000,
      outstanding: 485000
    },
    {
      id: 'CUST-002',
      name: 'Bharat Forge Limited',
      type: 'End User',
      status: 'Active',
      industry: 'Automotive',
      area: 'Mundhwa, Pune',
      salesPerson: salesName,
      contactPerson: { name: 'Sunil Jagtap', email: 'sunil.jagtap@bharatforge.com', phone: '+91 98500 11223', designation: 'Chief Maintenance Engineer' },
      address: { street: 'Mundhwa Cantonment, Pune', city: 'Pune', state: 'Maharashtra', pinCode: '411036', country: 'India' },
      gstNumber: '27AAACB0563G1ZV',
      panNumber: 'AAACB0563G',
      paymentTerms: '45 Days Net',
      creditLimit: 8000000,
      totalRevenue: 5200000,
      outstanding: 620000
    },
    {
      id: 'CUST-003',
      name: 'Deccan Sugar Mills Ltd.',
      type: 'End User',
      status: 'Active',
      industry: 'Food & Beverage',
      area: 'Baramati MIDC',
      salesPerson: salesName,
      contactPerson: { name: 'Dattatray Shinde', email: 'd.shinde@deccansugar.com', phone: '+91 94220 78901', designation: 'Plant Head' },
      address: { street: 'Plot 15/A, Baramati Industrial Area', city: 'Baramati', state: 'Maharashtra', pinCode: '413133', country: 'India' },
      gstNumber: '27AABCD3321K1ZW',
      panNumber: 'AABCD3321K',
      paymentTerms: '30 Days Net',
      creditLimit: 3000000,
      totalRevenue: 2800000,
      outstanding: 485000
    },
    {
      id: 'CUST-004',
      name: 'Sai Precision Auto Pvt Ltd',
      type: 'OEM',
      status: 'Active',
      industry: 'Industrial Automation',
      area: 'Bhosari MIDC',
      salesPerson: salesName,
      contactPerson: { name: 'Nilesh Pawar', email: 'nilesh@saiprecision.co.in', phone: '+91 98901 23456', designation: 'Director of Procurement' },
      address: { street: 'Sector 10, PCNTDA, Bhosari', city: 'Pune', state: 'Maharashtra', pinCode: '411026', country: 'India' },
      gstNumber: '27AAMCS1920J1ZY',
      panNumber: 'AAMCS1920J',
      paymentTerms: '15 Days Net',
      creditLimit: 2000000,
      totalRevenue: 1950000,
      outstanding: 150000
    },
    {
      id: 'CUST-005',
      name: 'Thermax Limited',
      type: 'System Integrator',
      status: 'Active',
      industry: 'Engineering',
      area: 'Chinchwad, Pune',
      salesPerson: salesName,
      contactPerson: { name: 'Anand Deshpande', email: 'anand.deshpande@thermaxglobal.com', phone: '+91 98600 99887', designation: 'Project Purchase Lead' },
      address: { street: 'Thermax House, Mumbai-Pune Road', city: 'Pune', state: 'Maharashtra', pinCode: '411019', country: 'India' },
      gstNumber: '27AAACT1470F1ZK',
      panNumber: 'AAACT1470F',
      paymentTerms: '60 Days Net',
      creditLimit: 10000000,
      totalRevenue: 6400000,
      outstanding: 0
    }
  ];

  const savedCustomers = {};
  for (const c of customerDocs) {
    const saved = await Customer.findOneAndUpdate({ id: c.id }, c, { upsert: true, returnDocument: 'after' });
    savedCustomers[c.id] = saved;
  }
  console.log(`✅ Seeded ${customerDocs.length} real enterprise customers.`);

  // ─── 2. SEED REAL PRODUCTS ───────────────────────────────────────────────────
  const productDocs = [
    {
      itemCode: 'PLC-S7-1200',
      name: 'Siemens SIMATIC S7-1200 CPU 1214C',
      description: 'Compact CPU, DC/DC/DC, 14 DI / 10 DO / 2 AI, Profinet interface',
      category: 'PLC',
      hsnCode: '85371000',
      unit: 'NOS',
      unitPrice: 38500,
      costPrice: 28000,
      taxRate: 18,
      stock: 14,
      minStock: 5,
      brand: 'Siemens',
      status: 'Active'
    },
    {
      itemCode: 'VFD-ATV320',
      name: 'Schneider Altivar ATV320 5.5kW VFD',
      description: 'Variable Speed Drive 3-phase 380-500V 5.5kW / 7.5HP with Modbus',
      category: 'Drives',
      hsnCode: '85044090',
      unit: 'NOS',
      unitPrice: 42000,
      costPrice: 31000,
      taxRate: 18,
      stock: 4,
      minStock: 8, // Triggers Stock Alert!
      brand: 'Schneider Electric',
      status: 'Active'
    },
    {
      itemCode: 'HMI-KTP700',
      name: 'Siemens KTP700 Basic HMI 7-inch Touch',
      description: '7" TFT display, 800x480 resolution, 64k colors, Ethernet PROFINET',
      category: 'HMI',
      hsnCode: '85285900',
      unit: 'NOS',
      unitPrice: 29500,
      costPrice: 21500,
      taxRate: 18,
      stock: 9,
      minStock: 4,
      brand: 'Siemens',
      status: 'Active'
    },
    {
      itemCode: 'SNR-OMR-E3Z',
      name: 'Omron E3Z-D62 Photoelectric Sensor',
      description: 'Diffuse-reflective, sensing distance 1m, NPN output, IP67 waterproof',
      category: 'Sensors',
      hsnCode: '85365090',
      unit: 'NOS',
      unitPrice: 2850,
      costPrice: 1950,
      taxRate: 18,
      stock: 3,
      minStock: 15, // Triggers Stock Alert!
      brand: 'Omron',
      status: 'Active'
    },
    {
      itemCode: 'SMPS-24V-10A',
      name: 'Mean Well NDR-240-24 DIN Rail SMPS',
      description: '24V DC 10A 240W industrial DIN rail power supply with active PFC',
      category: 'Power Supply',
      hsnCode: '85044090',
      unit: 'NOS',
      unitPrice: 4800,
      costPrice: 3400,
      taxRate: 18,
      stock: 22,
      minStock: 10,
      brand: 'Mean Well',
      status: 'Active'
    },
    {
      itemCode: 'ISO-4-20MA',
      name: 'Signal Isolator 4-20mA Dual Output',
      description: 'Galvanic 3-way isolation 1.5kV, 24V DC powered, high precision 0.1%',
      category: 'Instrumentation',
      hsnCode: '85437099',
      unit: 'NOS',
      unitPrice: 6200,
      costPrice: 4100,
      taxRate: 18,
      stock: 2,
      minStock: 6, // Triggers Stock Alert!
      brand: 'CONTECH',
      status: 'Active'
    }
  ];

  for (const p of productDocs) {
    await Product.findOneAndUpdate({ itemCode: p.itemCode }, p, { upsert: true, returnDocument: 'after' });
  }
  console.log(`✅ Seeded ${productDocs.length} real automation products.`);

  // ─── 3. SEED REAL LEADS ──────────────────────────────────────────────────────
  const leadDocs = [
    {
      id: 'LD-1001',
      customerName: 'Tata AutoComp Systems Ltd.',
      date: daysAgo(5),
      source: 'IndiaMART',
      stage: 'Hot',
      priority: 'Critical',
      value: 850000,
      salesperson: salesName,
      area: 'Chakan MIDC',
      notes: 'Urgent line upgrade inquiry for 4 automated PLC panels with barcode scanning integration.'
    },
    {
      id: 'LD-1002',
      customerName: 'Bharat Forge Limited',
      date: daysAgo(12),
      source: 'Exhibition',
      stage: 'Quotation Sent',
      priority: 'High',
      value: 1420000,
      salesperson: salesName,
      area: 'Mundhwa',
      notes: 'Quotation submitted for Robotic MIG welding cell safety interlock retrofitting.'
    },
    {
      id: 'LD-1003',
      customerName: 'Sai Precision Auto Pvt Ltd',
      date: daysAgo(20),
      source: 'Reference',
      stage: 'Potential',
      priority: 'Medium',
      value: 450000,
      salesperson: salesName,
      area: 'Bhosari MIDC',
      notes: 'Requirement discussion underway for VFD energy-saving panels across 6 stamping presses.'
    },
    {
      id: 'LD-1004',
      customerName: 'Deccan Sugar Mills Ltd.',
      date: daysAgo(35),
      source: 'Website',
      stage: 'Won',
      priority: 'High',
      value: 2800000,
      salesperson: salesName,
      area: 'Baramati MIDC',
      notes: 'Won complete automation order for boiler draft fan VFDs and SCADA logging.'
    },
    {
      id: 'LD-1005',
      customerName: 'Thermax Limited',
      date: daysAgo(8),
      source: 'Email Inquiry',
      stage: 'Contacted',
      priority: 'Medium',
      value: 620000,
      salesperson: salesName,
      area: 'Chinchwad',
      notes: 'Site visit scheduled for flue gas monitoring instrumentation sensors.'
    },
    {
      id: 'LD-1006',
      customerName: 'Kirloskar Oil Engines Ltd',
      date: daysAgo(15),
      source: 'Cold Call',
      stage: 'New',
      priority: 'Low',
      value: 320000,
      salesperson: salesName,
      area: 'Khadki, Pune',
      notes: 'Inquired about replacing obsolete Omron PLCs with modern S7-1200 hardware.'
    },
    {
      id: 'LD-1007',
      customerName: 'Mahindra CIE Automotive Ltd',
      date: daysAgo(40),
      source: 'Existing Customer',
      stage: 'Lost',
      priority: 'Medium',
      value: 550000,
      salesperson: salesName,
      area: 'Kanhe',
      notes: 'Project deferred to next financial year due to capex freeze.'
    }
  ];

  for (const l of leadDocs) {
    await Lead.findOneAndUpdate({ id: l.id }, l, { upsert: true, returnDocument: 'after' });
  }
  console.log(`✅ Seeded ${leadDocs.length} real sales leads.`);

  // ─── 4. SEED REAL QUOTATIONS ─────────────────────────────────────────────────
  const quotationDocs = [
    {
      quotationNo: 'QT-2026-001',
      customer: {
        id: savedCustomers['CUST-001']._id,
        name: 'Tata AutoComp Systems Ltd.',
        address: 'Plot No. 28, Phase II, Chakan MIDC, Pune',
        gstNumber: '27AAACT2849L1Z5',
        state: 'Maharashtra',
        contactPerson: 'Rajesh Kulkarni',
        email: 'rajesh.k@tataautocomp.com',
        phone: '+91 98220 54321'
      },
      date: daysAgo(4),
      status: 'Sent',
      salesperson: salesName,
      subtotal: 720000,
      totalCgst: 64800,
      totalSgst: 64800,
      grandTotal: 849600,
      items: [
        { description: 'Siemens SIMATIC S7-1200 CPU 1214C', qty: 6, rate: 38500, taxableAmount: 231000, totalAmount: 272580 },
        { description: 'Siemens KTP700 Basic HMI 7-inch Touch', qty: 6, rate: 29500, taxableAmount: 177000, totalAmount: 208860 },
        { description: 'Schneider Altivar ATV320 5.5kW VFD', qty: 4, rate: 42000, taxableAmount: 168000, totalAmount: 198240 },
        { description: 'Mean Well NDR-240-24 DIN Rail SMPS', qty: 12, rate: 4800, taxableAmount: 57600, totalAmount: 67968 },
        { description: 'Control Panel Engineering & FAT', qty: 1, rate: 86400, taxableAmount: 86400, totalAmount: 101952 }
      ],
      createdAt: daysAgo(4)
    },
    {
      quotationNo: 'QT-2026-002',
      customer: {
        id: savedCustomers['CUST-002']._id,
        name: 'Bharat Forge Limited',
        address: 'Mundhwa Cantonment, Pune',
        gstNumber: '27AAACB0563G1ZV',
        state: 'Maharashtra',
        contactPerson: 'Sunil Jagtap',
        email: 'sunil.jagtap@bharatforge.com',
        phone: '+91 98500 11223'
      },
      date: daysAgo(10),
      status: 'Viewed',
      salesperson: salesName,
      subtotal: 1200000,
      totalCgst: 108000,
      totalSgst: 108000,
      grandTotal: 1416000,
      items: [
        { description: 'Robotic Welding Safety Interlock Panels', qty: 2, rate: 450000, taxableAmount: 900000, totalAmount: 1062000 },
        { description: 'Omron E3Z-D62 Photoelectric Sensor', qty: 40, rate: 2850, taxableAmount: 114000, totalAmount: 134520 },
        { description: 'On-site Installation and Safety Validation', qty: 1, rate: 186000, taxableAmount: 186000, totalAmount: 219480 }
      ],
      createdAt: daysAgo(10)
    },
    {
      quotationNo: 'QT-2026-003',
      customer: {
        id: savedCustomers['CUST-004']._id,
        name: 'Sai Precision Auto Pvt Ltd',
        address: 'Sector 10, PCNTDA, Bhosari',
        gstNumber: '27AAMCS1920J1ZY',
        state: 'Maharashtra',
        contactPerson: 'Nilesh Pawar',
        email: 'nilesh@saiprecision.co.in',
        phone: '+91 98901 23456'
      },
      date: daysAgo(18),
      status: 'Draft',
      salesperson: salesName,
      subtotal: 380000,
      totalCgst: 34200,
      totalSgst: 34200,
      grandTotal: 448400,
      items: [
        { description: 'Schneider Altivar ATV320 5.5kW VFD', qty: 6, rate: 42000, taxableAmount: 252000, totalAmount: 297360 },
        { description: 'Signal Isolator 4-20mA Dual Output', qty: 10, rate: 6200, taxableAmount: 62000, totalAmount: 73160 },
        { description: 'Panel Enclosures and Wiring Kit', qty: 6, rate: 11000, taxableAmount: 66000, totalAmount: 77880 }
      ],
      createdAt: daysAgo(18)
    },
    {
      quotationNo: 'QT-2026-004',
      customer: {
        id: savedCustomers['CUST-003']._id,
        name: 'Deccan Sugar Mills Ltd.',
        address: 'Plot 15/A, Baramati Industrial Area',
        gstNumber: '27AABCD3321K1ZW',
        state: 'Maharashtra',
        contactPerson: 'Dattatray Shinde',
        email: 'd.shinde@deccansugar.com',
        phone: '+91 94220 78901'
      },
      date: monthsAgo(1),
      status: 'Accepted',
      salesperson: salesName,
      subtotal: 2372881,
      totalCgst: 213559,
      totalSgst: 213559,
      grandTotal: 2800000,
      items: [
        { description: 'Boiler Draft Fan 90kW VFD Drive Panels', qty: 2, rate: 850000, taxableAmount: 1700000, totalAmount: 2006000 },
        { description: 'Siemens S7-1200 SCADA Telemetry Unit', qty: 1, rate: 350000, taxableAmount: 350000, totalAmount: 413000 },
        { description: 'Erection & Commissioning Engineering', qty: 1, rate: 322881, taxableAmount: 322881, totalAmount: 381000 }
      ],
      createdAt: monthsAgo(1)
    }
  ];

  for (const q of quotationDocs) {
    await Quotation.findOneAndUpdate({ quotationNo: q.quotationNo }, q, { upsert: true, returnDocument: 'after' });
  }
  console.log(`✅ Seeded ${quotationDocs.length} real quotations.`);

  // ─── 5. SEED REAL SALES ORDERS ───────────────────────────────────────────────
  const orderDocs = [
    {
      soNo: 'SO-2026-001',
      customer: {
        id: savedCustomers['CUST-003']._id,
        name: 'Deccan Sugar Mills Ltd.',
        address: 'Plot 15/A, Baramati Industrial Area',
        gstNumber: '27AABCD3321K1ZW',
        state: 'Maharashtra',
        contactPerson: 'Dattatray Shinde',
        email: 'd.shinde@deccansugar.com',
        phone: '+91 94220 78901'
      },
      quotationRef: 'QT-2026-004',
      date: monthsAgo(1),
      status: 'Confirmed',
      salesperson: salesName,
      subtotal: 2372881,
      totalCgst: 213559,
      totalSgst: 213559,
      grandTotal: 2800000,
      items: [
        { description: 'Boiler Draft Fan 90kW VFD Drive Panels', qty: 2, rate: 850000, taxableAmount: 1700000, totalAmount: 2006000 },
        { description: 'Siemens S7-1200 SCADA Telemetry Unit', qty: 1, rate: 350000, taxableAmount: 350000, totalAmount: 413000 },
        { description: 'Erection & Commissioning Engineering', qty: 1, rate: 322881, taxableAmount: 322881, totalAmount: 381000 }
      ],
      createdAt: monthsAgo(1)
    },
    {
      soNo: 'SO-2026-002',
      customer: {
        id: savedCustomers['CUST-004']._id,
        name: 'Sai Precision Auto Pvt Ltd',
        address: 'Sector 10, PCNTDA, Bhosari',
        gstNumber: '27AAMCS1920J1ZY',
        state: 'Maharashtra',
        contactPerson: 'Nilesh Pawar',
        email: 'nilesh@saiprecision.co.in',
        phone: '+91 98901 23456'
      },
      date: daysAgo(14),
      status: 'Confirmed',
      salesperson: salesName,
      subtotal: 350000,
      totalCgst: 31500,
      totalSgst: 31500,
      grandTotal: 413000,
      items: [
        { description: 'Schneider Altivar ATV320 5.5kW VFD', qty: 4, rate: 42000, taxableAmount: 168000, totalAmount: 198240 },
        { description: 'Mean Well NDR-240-24 DIN Rail SMPS', qty: 10, rate: 4800, taxableAmount: 48000, totalAmount: 56640 },
        { description: 'Siemens SIMATIC S7-1200 CPU 1214C', qty: 2, rate: 38500, taxableAmount: 77000, totalAmount: 90860 },
        { description: 'Installation Service Charges', qty: 1, rate: 57000, taxableAmount: 57000, totalAmount: 67260 }
      ],
      createdAt: daysAgo(14)
    }
  ];

  for (const so of orderDocs) {
    await SalesOrder.findOneAndUpdate({ soNo: so.soNo }, so, { upsert: true, returnDocument: 'after' });
  }
  console.log(`✅ Seeded ${orderDocs.length} real sales orders.`);

  // ─── 6. SEED REAL SALES INVOICES ─────────────────────────────────────────────
  const invoiceDocs = [
    {
      invoiceNo: 'INV-2026-001',
      customer: {
        id: savedCustomers['CUST-003']._id,
        name: 'Deccan Sugar Mills Ltd.',
        address: 'Plot 15/A, Baramati Industrial Area',
        gstNumber: '27AABCD3321K1ZW',
        state: 'Maharashtra',
        contactPerson: 'Dattatray Shinde',
        email: 'd.shinde@deccansugar.com',
        phone: '+91 94220 78901'
      },
      soRef: 'SO-2026-001',
      date: monthsAgo(1),
      dueDate: daysAgo(12), // Overdue by 12 days!
      status: 'Overdue',
      subtotal: 2372881,
      totalCgst: 213559,
      totalSgst: 213559,
      grandTotal: 2800000,
      receivedAmount: 2315000,
      balanceAmount: 485000,
      payments: [
        { amount: 1400000, date: monthsAgo(1), mode: 'NEFT', reference: 'NEFT-SBIN883921' },
        { amount: 915000, date: daysAgo(20), mode: 'RTGS', reference: 'RTGS-HDFC190234' }
      ],
      items: [
        { description: 'Boiler Draft Fan 90kW VFD Drive Panels', qty: 2, rate: 850000, taxableAmount: 1700000, totalAmount: 2006000 }
      ],
      createdAt: monthsAgo(1)
    },
    {
      invoiceNo: 'INV-2026-002',
      customer: {
        id: savedCustomers['CUST-002']._id,
        name: 'Bharat Forge Limited',
        address: 'Mundhwa Cantonment, Pune',
        gstNumber: '27AAACB0563G1ZV',
        state: 'Maharashtra',
        contactPerson: 'Sunil Jagtap',
        email: 'sunil.jagtap@bharatforge.com',
        phone: '+91 98500 11223'
      },
      date: monthsAgo(2),
      dueDate: daysAgo(25), // Overdue by 25 days!
      status: 'Overdue',
      subtotal: 1050000,
      totalCgst: 94500,
      totalSgst: 94500,
      grandTotal: 1239000,
      receivedAmount: 619000,
      balanceAmount: 620000,
      payments: [
        { amount: 619000, date: monthsAgo(2), mode: 'RTGS', reference: 'RTGS-ICICI90231' }
      ],
      items: [
        { description: 'Robotic Welding Safety Interlock Panels', qty: 2, rate: 450000, taxableAmount: 900000, totalAmount: 1062000 }
      ],
      createdAt: monthsAgo(2)
    },
    {
      invoiceNo: 'INV-2026-003',
      customer: {
        id: savedCustomers['CUST-001']._id,
        name: 'Tata AutoComp Systems Ltd.',
        address: 'Plot No. 28, Phase II, Chakan MIDC, Pune',
        gstNumber: '27AAACT2849L1Z5',
        state: 'Maharashtra',
        contactPerson: 'Rajesh Kulkarni',
        email: 'rajesh.k@tataautocomp.com',
        phone: '+91 98220 54321'
      },
      date: daysAgo(15),
      dueDate: new Date(Date.now() + 15 * 86400000), // Due in 15 days
      status: 'Sent',
      subtotal: 850000,
      totalCgst: 76500,
      totalSgst: 76500,
      grandTotal: 1003000,
      receivedAmount: 500000,
      balanceAmount: 503000,
      payments: [
        { amount: 500000, date: daysAgo(10), mode: 'NEFT', reference: 'NEFT-TATA39012' }
      ],
      items: [
        { description: 'Siemens SIMATIC S7-1200 CPU 1214C', qty: 6, rate: 38500, taxableAmount: 231000, totalAmount: 272580 }
      ],
      createdAt: daysAgo(15)
    }
  ];

  for (const inv of invoiceDocs) {
    await SalesInvoice.findOneAndUpdate({ invoiceNo: inv.invoiceNo }, inv, { upsert: true, returnDocument: 'after' });
  }
  console.log(`✅ Seeded ${invoiceDocs.length} real sales invoices with overdue balances.`);

  // ─── 7. SEED REAL PROFORMAS & DELIVERIES ──────────────────────────────────────
  const proformaDocs = [
    {
      proformaNo: 'PI-2026-001',
      customer: {
        id: savedCustomers['CUST-001']._id,
        name: 'Tata AutoComp Systems Ltd.',
        address: 'Plot No. 28, Phase II, Chakan MIDC, Pune',
        gstNumber: '27AAACT2849L1Z5',
        state: 'Maharashtra'
      },
      date: daysAgo(6),
      status: 'Sent',
      subtotal: 720000,
      grandTotal: 849600,
      advanceRequired: 424800,
      advanceReceived: 0,
      items: [
        { description: 'Siemens SIMATIC S7-1200 CPU 1214C', qty: 6, rate: 38500, taxableAmount: 231000, totalAmount: 272580 }
      ]
    },
    {
      proformaNo: 'PI-2026-002',
      customer: {
        id: savedCustomers['CUST-002']._id,
        name: 'Bharat Forge Limited',
        address: 'Mundhwa Cantonment, Pune',
        gstNumber: '27AAACB0563G1ZV',
        state: 'Maharashtra'
      },
      date: daysAgo(12),
      status: 'Confirmed',
      subtotal: 1200000,
      grandTotal: 1416000,
      advanceRequired: 708000,
      advanceReceived: 708000,
      items: [
        { description: 'Robotic Welding Safety Interlock Panels', qty: 2, rate: 450000, taxableAmount: 900000, totalAmount: 1062000 }
      ]
    }
  ];

  for (const pi of proformaDocs) {
    await ProformaInvoice.findOneAndUpdate({ proformaNo: pi.proformaNo }, pi, { upsert: true, returnDocument: 'after' });
  }

  const deliveryDocs = [
    {
      dnNo: 'DN-2026-001',
      soRef: 'SO-2026-001',
      customer: {
        id: savedCustomers['CUST-003']._id,
        name: 'Deccan Sugar Mills Ltd.',
        address: 'Plot 15/A, Baramati Industrial Area',
        gstNumber: '27AABCD3321K1ZW',
        state: 'Maharashtra'
      },
      date: daysAgo(8),
      status: 'Dispatched',
      transporter: 'V-Trans Express',
      lrNumber: 'VTR-889021',
      items: [
        { description: 'Boiler Draft Fan 90kW VFD Drive Panels', orderedQty: 2, dispatchedQty: 2 }
      ]
    }
  ];

  for (const dn of deliveryDocs) {
    await DeliveryNote.findOneAndUpdate({ dnNo: dn.dnNo }, dn, { upsert: true, returnDocument: 'after' });
  }
  console.log(`✅ Seeded Proformas and Delivery Notes.`);

  console.log('🎉 REAL COMPANY DATABASE SEEDING COMPLETED SUCCESSFULLY!');
  process.exit(0);
}

seedCompanyData().catch(err => {
  console.error('Failed to seed company data:', err);
  process.exit(1);
});
