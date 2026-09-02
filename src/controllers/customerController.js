import mongoose from 'mongoose';
import Customer from '../models/Customer.js';

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
      customer = await Customer.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    }
    if (!customer) {
      customer = await Customer.findOneAndUpdate({ id }, req.body, { new: true, runValidators: true });
    }
    if (customer) {
      res.json(customer);
    } else {
      res.status(404).json({ message: 'Customer not found' });
    }
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
