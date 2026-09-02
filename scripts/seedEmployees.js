import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Employee from '../src/models/Employee.js';
import User from '../src/models/User.js';

dotenv.config();

const employeesToSeed = [
  { firstName: "Rajesh", lastName: "Deshpande", role: "Director", department: "Management", email: "rajesh@example.com" },
  { firstName: "Sunita", lastName: "Kulkarni", role: "Director", department: "Management", email: "sunita@example.com" },
  { firstName: "Zaid", lastName: "Shaikh", role: "Admin Manager", department: "Administration", email: "zaid@example.com" },
  { firstName: "Amruta", lastName: "Joshi", role: "HR", department: "Human Resources", email: "amruta@example.com" },
  { firstName: "Nilesh", lastName: "Pawar", role: "Salesperson", department: "Sales", email: "nilesh@example.com" },
  { firstName: "Prasad", lastName: "Bhosale", role: "Engineer", department: "Engineering", email: "prasad@example.com" },
  { firstName: "Kiran", lastName: "Jadhav", role: "Service", department: "Service", email: "kiran@example.com" },
  { firstName: "Snehal", lastName: "Patil", role: "Accounts Manager", department: "Accounts", email: "snehal@example.com" },
  { firstName: "Vivek", lastName: "Ranade", role: "Project Manager", department: "Management", email: "vivek@example.com" },
  { firstName: "Imran", lastName: "Qureshi", role: "Engineer", department: "Engineering", email: "imran@example.com" },
  { firstName: "Rohit", lastName: "Shinde", role: "Salesperson", department: "Sales", email: "rohit@example.com" },
  { firstName: "Pooja", lastName: "Nair", role: "Purchase", department: "Procurement", email: "pooja@example.com" }
];

const seedEmployees = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    let createdCount = 0;

    for (let i = 0; i < employeesToSeed.length; i++) {
      const empData = employeesToSeed[i];
      let existing = await Employee.findOne({ email: empData.email });
      
      if (!existing) {
        const employeeCode = `EMP${(i + 1).toString().padStart(3, '0')}`;
        existing = await Employee.create({
          employeeCode,
          firstName: empData.firstName,
          lastName: empData.lastName,
          fullName: `${empData.firstName} ${empData.lastName}`,
          role: empData.role,
          department: empData.department,
          phone: `+91 98000000${i.toString().padStart(2, '0')}`,
          email: empData.email,
          employmentType: 'Full Time',
          status: 'Active',
          presentDays: 0,
          leaveDays: 0,
          overtimeHours: 0,
          isActive: true
        });
        createdCount++;
      }

      // Create corresponding User account if it doesn't exist
      const existingUser = await User.findOne({ email: empData.email });
      if (!existingUser) {
        await User.create({
          name: `${empData.firstName} ${empData.lastName}`,
          email: empData.email,
          password: '123456', // default password
          role: empData.role,
          employeeId: existing._id
        });
        console.log(`Created user account for ${empData.email}`);
      }
    }

    console.log(`Seeded ${createdCount} employees and ensured user accounts exist.`);
    process.exit(0);
  } catch (error) {
    console.error("Error seeding employees:", error);
    process.exit(1);
  }
};

seedEmployees();
