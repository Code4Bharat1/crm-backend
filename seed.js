const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Customer = require('./src/models/Customer');
const Lead = require('./src/models/Lead');
const SalesDocument = require('./src/models/SalesDocument');

dotenv.config();

const customers = [
  { id: "CUST-1001", name: "Apex Manufacturing Solutions", type: "OEM", status: "Active", area: "Pune North", industry: "Automotive", salesPerson: "Kiran Jadhav", totalRevenue: 2500000, outstanding: 450000 },
  { id: "CUST-1002", name: "Global Tech Robotics", type: "System Integrator", status: "Active", area: "Bengaluru East", industry: "Robotics", salesPerson: "Amit Patel", totalRevenue: 5600000, outstanding: 0 },
  { id: "CUST-1003", name: "Sunrise Heavy Engineering", type: "End User", status: "Inactive", area: "Chennai South", industry: "Manufacturing", salesPerson: "Neha Sharma", totalRevenue: 1200000, outstanding: 150000 },
];

const leads = [
  { id: "LD-2001", customerName: "Future Dynamics", source: "Website", stage: "New", priority: "High", value: 450000, salesperson: "Kiran Jadhav", area: "Pune North" },
  { id: "LD-2002", customerName: "Vishwa Auto", source: "Exhibition", stage: "Quotation Sent", priority: "Medium", value: 120000, salesperson: "Amit Patel", area: "Bengaluru East" },
  { id: "LD-2003", customerName: "TechPro Systems", source: "Reference", stage: "Won", priority: "High", value: 890000, salesperson: "Neha Sharma", area: "Chennai South" }
];

const salesDocs = [
  {
    id: "QT-1001", type: "Quotation", customerName: "Apex Manufacturing Solutions", status: "Sent",
    items: [{ name: "Siemens S7-1200 PLC", qty: 2, rate: 45000, amount: 90000 }],
    subtotal: 90000, taxAmount: 16200, totalAmount: 106200, salesperson: "Kiran Jadhav"
  },
  {
    id: "SO-1024", type: "Sales Order", customerName: "Global Tech Robotics", status: "Confirmed",
    items: [{ name: "Schneider Drive 5kW", qty: 5, rate: 32000, amount: 160000 }],
    subtotal: 160000, taxAmount: 28800, totalAmount: 188800, salesperson: "Amit Patel"
  },
  {
    id: "INV-1004", type: "Invoice", customerName: "Sunrise Heavy Engineering", status: "Overdue",
    items: [{ name: "Sensor Pack", qty: 10, rate: 2500, amount: 25000 }],
    subtotal: 25000, taxAmount: 4500, totalAmount: 29500, receivedAmount: 0, salesperson: "Neha Sharma",
    dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
  }
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");
    
    await Customer.deleteMany();
    await Lead.deleteMany();
    await SalesDocument.deleteMany();
    console.log("Deleted existing records");
    
    await Customer.insertMany(customers);
    await Lead.insertMany(leads);
    await SalesDocument.insertMany(salesDocs);
    console.log("Seeded successfully");
    
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedDB();
