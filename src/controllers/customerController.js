import mongoose from 'mongoose';
import Customer from '../models/Customer.js';
import Employee from '../models/Employee.js';
import Notification from '../models/Notification.js';

const notifySalespersonAssigned = async (customer) => {
  if (!customer.salesPerson || !customer.salesPerson.trim()) return;
  try {
    const emp = await Employee.findOne({
      $or: [
        { fullName: { $regex: `^${customer.salesPerson.trim()}$`, $options: 'i' } },
        { firstName: { $regex: `^${customer.salesPerson.trim()}$`, $options: 'i' } }
      ]
    });

    await Notification.create({
      recipient: customer.salesPerson,
      recipientEmail: emp?.email || '',
      recipientRole: emp?.role || 'salesperson',
      title: `Customer Assigned: ${customer.name}`,
      detail: `You have been assigned as Salesperson for "${customer.name}" (${customer.industry || customer.type || 'Customer'}, Code: ${customer.id}).`,
      type: 'Customer',
      severity: 'info',
      link: `/customers/${customer.id || customer._id}`,
      customerName: customer.name,
      read: false,
      at: new Date()
    });
    console.log(`🔔 [Notification] Customer assignment notification generated for: ${customer.salesPerson}`);
  } catch (notifErr) {
    console.error('⚠️ [Notification] Failed to create customer assignment notification:', notifErr);
  }
};

const getCustomers = async (req, res) => {
  try {
    const { status, type, area, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (area) filter.area = new RegExp(area, 'i');
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { id: new RegExp(search, 'i') },
        { 'contactPerson.name': new RegExp(search, 'i') },
        { gstNumber: new RegExp(search, 'i') },
      ];
    }
    const customers = await Customer.find(filter).sort({ createdAt: -1 });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Server Error: ' + error.message });
  }
};

const createCustomer = async (req, res) => {
  try {
    const customer = new Customer(req.body);
    const createdCustomer = await customer.save();
    await notifySalespersonAssigned(createdCustomer);
    res.status(201).json(createdCustomer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    let customer = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      customer = await Customer.findById(id);
    }
    if (!customer) {
      customer = await Customer.findOne({ id });
    }
    if (customer) {
      res.json(customer);
    } else {
      res.status(404).json({ message: 'Customer not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error: ' + error.message });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    let customer = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      customer = await Customer.findById(id);
    }
    if (!customer) {
      customer = await Customer.findOne({ id });
    }
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const prevSalesPerson = customer.salesPerson;
    Object.assign(customer, req.body);
    await customer.save();

    if (customer.salesPerson && customer.salesPerson.trim() && customer.salesPerson !== prevSalesPerson) {
      await notifySalespersonAssigned(customer);
    }

    res.json(customer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    let customer = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      customer = await Customer.findByIdAndDelete(id);
    }
    if (!customer) {
      customer = await Customer.findOneAndDelete({ id });
    }
    if (customer) {
      res.json({ message: 'Customer deleted successfully' });
    } else {
      res.status(404).json({ message: 'Customer not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error: ' + error.message });
  }
};

export { getCustomers, createCustomer, getCustomerById, updateCustomer, deleteCustomer };
