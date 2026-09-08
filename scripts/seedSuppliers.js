import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Supplier from '../src/models/Supplier.js';

dotenv.config({ path: './.env' });

const initialSuppliers = [
  {
    supplierCode: 'SUP-001',
    name: 'Siemens India Distribution',
    contactPerson: 'Ramesh Kulkarni',
    phone: '+91 98220 11445',
    email: 'orders.west@siemens-dist.in',
    address: {
      street: 'Plot 42, MIDC Chakan Phase 2',
      city: 'Pune',
      state: 'Maharashtra',
      pinCode: '410501',
      country: 'India'
    },
    gstNumber: '27AAACS1234F1Z5',
    panNumber: 'AAACS1234F',
    paymentTerms: '30 Days Net',
    status: 'Active',
    notes: 'Primary PLC, VFD, Switchgear, and HMI authorized distributor.'
  },
  {
    supplierCode: 'SUP-002',
    name: 'Schneider Authorised Partner - Pune',
    contactPerson: 'Pooja Deshmukh',
    phone: '+91 98231 44556',
    email: 'sales@schneider-pune.com',
    address: {
      street: 'Gala 14, Bhosari Industrial Area',
      city: 'Pune',
      state: 'Maharashtra',
      pinCode: '411026',
      country: 'India'
    },
    gstNumber: '27AABCS5678K1Z2',
    panNumber: 'AABCS5678K',
    paymentTerms: '30 Days Net',
    status: 'Active',
    notes: 'Schneider VFDs, Contactors, MCBs, and Relays.'
  },
  {
    supplierCode: 'SUP-003',
    name: 'Delta Electronics India',
    contactPerson: 'Sanjay Sharma',
    phone: '+91 98110 33221',
    email: 'industrial.sales@deltaww.in',
    address: {
      street: 'Plot 27, Sector 8, IMT Manesar',
      city: 'Gurugram',
      state: 'Haryana',
      pinCode: '122050',
      country: 'India'
    },
    gstNumber: '06AABCD9012M1Z8',
    panNumber: 'AABCD9012M',
    paymentTerms: '45 Days Net',
    status: 'Active',
    notes: 'Servo Motors, Drives, and SMPS power supplies (Inter-State IGST).'
  },
  {
    supplierCode: 'SUP-004',
    name: 'Autonics India Pvt Ltd',
    contactPerson: 'Manoj Nair',
    phone: '+91 98450 77889',
    email: 'info@autonics.co.in',
    address: {
      street: 'Unit 301, Sigma Tech Park, Whitefield',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '560066',
      country: 'India'
    },
    gstNumber: '29AABCA3456P1Z3',
    panNumber: 'AABCA3456P',
    paymentTerms: '30 Days Net',
    status: 'Active',
    notes: 'Sensors, Encoders, Temperature Controllers.'
  },
  {
    supplierCode: 'SUP-005',
    name: 'Phoenix Contact India',
    contactPerson: 'Anand Verma',
    phone: '+91 98101 22334',
    email: 'delhi.orders@phoenixcontact.co.in',
    address: {
      street: 'A-66, Sector 64',
      city: 'Noida',
      state: 'Uttar Pradesh',
      pinCode: '201301',
      country: 'India'
    },
    gstNumber: '09AABCP7890Q1Z7',
    panNumber: 'AABCP7890Q',
    paymentTerms: '30 Days Net',
    status: 'Active',
    notes: 'Terminal Blocks, Interface Relays, Ethernet Switches.'
  },
  {
    supplierCode: 'SUP-006',
    name: 'Neelkanth Panel Fabricators',
    contactPerson: 'Rajesh Patel',
    phone: '+91 98250 88990',
    email: 'neelkanth.panels@gmail.com',
    address: {
      street: 'W-128, MIDC Waluj',
      city: 'Chhatrapati Sambhajinagar',
      state: 'Maharashtra',
      pinCode: '431136',
      country: 'India'
    },
    gstNumber: '27AAEFN2345R1Z9',
    panNumber: 'AAEFN2345R',
    paymentTerms: '15 Days Net',
    status: 'Active',
    notes: 'Custom MS and SS Control Enclosures and Cabinets.'
  },
  {
    supplierCode: 'SUP-007',
    name: 'Sunrise Cables & Wires',
    contactPerson: 'Vikas Agarwal',
    phone: '+91 98200 55667',
    email: 'sales@sunrisecables.in',
    address: {
      street: 'Shop 18, Lohar Chawl, Kalbadevi',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400002',
      country: 'India'
    },
    gstNumber: '27AAGCS6789S1Z4',
    panNumber: 'AAGCS6789S',
    paymentTerms: '30 Days Net',
    status: 'Active',
    notes: 'Profinet, Shielded Instrumentation & Control Cables.'
  },
  {
    supplierCode: 'SUP-008',
    name: 'Omkar Automation Spares',
    contactPerson: 'Sachin Shinde',
    phone: '+91 98900 12345',
    email: 'omkar.spares@rediffmail.com',
    address: {
      street: 'Shed 9, Pimpri Industrial Belt',
      city: 'Pune',
      state: 'Maharashtra',
      pinCode: '411018',
      country: 'India'
    },
    gstNumber: '27AAHCS1122T1Z1',
    panNumber: 'AAHCS1122T',
    paymentTerms: 'Immediate',
    status: 'Active',
    notes: 'Local hardware, relays, connectors, and cable glands.'
  }
];

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    for (const sup of initialSuppliers) {
      const exists = await Supplier.findOne({ name: sup.name });
      if (!exists) {
        await Supplier.create(sup);
        console.log(`Created supplier: ${sup.name} (${sup.supplierCode})`);
      } else {
        console.log(`Supplier already exists: ${sup.name}`);
      }
    }

    const count = await Supplier.countDocuments();
    console.log(`Total suppliers in DB now: ${count}`);
    process.exit(0);
  } catch (err) {
    console.error('Error seeding suppliers:', err);
    process.exit(1);
  }
}

run();
