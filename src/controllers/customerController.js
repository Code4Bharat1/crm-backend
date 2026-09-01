import Customer from '../models/Customer.js';

const getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({});
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const createCustomer = async (req, res) => {
  try {
    const { id, name, type, status, area, industry, salesPerson, contactPerson, address, gstNumber } = req.body;
    const customer = new Customer({
      id, name, type, status, area, industry, salesPerson, contactPerson, address, gstNumber
    });
    const createdCustomer = await customer.save();
    res.status(201).json(createdCustomer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findOne({ id: req.params.id });
    if (customer) {
      res.json(customer);
    } else {
      res.status(404).json({ message: 'Customer not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

export { getCustomers, createCustomer, getCustomerById };
