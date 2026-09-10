import Product from '../models/Product.js';
import Category from '../models/Category.js';

const DEFAULT_CATEGORIES = [
  'Automation',
  'Switchgear',
  'Motors',
  'Sensors',
  'Cables',
  'Drives',
  'Pneumatics',
  'General',
];

export const getProducts = async (req, res) => {
  try {
    const { category, brand, lowStock, search } = req.query;
    const query = {};

    if (category) query.category = category;
    if (brand) query.brand = brand;
    if (lowStock === 'true') {
      query.$expr = { $lte: ['$stock', '$minStock'] };
    }
    if (search) {
      query.$or = [
        { itemCode: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { hsnCode: { $regex: search, $options: 'i' } },
        { 'supplier.name': { $regex: search, $options: 'i' } },
      ];
    }

    const products = await Product.find(query).sort({ name: 1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
};

export const getProductById = async (req, res) => {
  try {
    const doc = await Product.findOne({ itemCode: req.params.id })
      || await Product.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Product not found' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const createProduct = async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: 'Error creating product', error: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const doc = await Product.findOne({ itemCode: req.params.id })
      || await Product.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Product not found' });
    Object.assign(doc, req.body);
    await doc.save();
    res.json(doc);
  } catch (error) {
    res.status(400).json({ message: 'Error updating product', error: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const doc = await Product.findOneAndDelete({ itemCode: req.params.id })
      || await Product.findByIdAndDelete(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting product', error: error.message });
  }
};

// POST /api/products/:id/adjust-stock
export const adjustStock = async (req, res) => {
  try {
    const { delta, newStock, reason } = req.body;
    const doc = await Product.findOne({ itemCode: req.params.id })
      || await Product.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Product not found' });

    if (newStock !== undefined) {
      doc.stock = Math.max(0, Number(newStock));
    } else if (delta !== undefined) {
      doc.stock = Math.max(0, doc.stock + Number(delta));
    }

    if (doc.stock === 0) {
      doc.status = 'Out of Stock';
    } else if (doc.status === 'Out of Stock') {
      doc.status = 'Active';
    }

    await doc.save();
    res.json({ product: doc, message: `Stock updated to ${doc.stock}`, reason });
  } catch (error) {
    res.status(400).json({ message: 'Error adjusting stock', error: error.message });
  }
};

// GET /api/products/categories
export const getCategories = async (req, res) => {
  try {
    const dbCategories = await Category.find().sort({ name: 1 });
    const productCategories = await Product.distinct('category');

    const categoryMap = new Map();

    // 1. Add default categories
    DEFAULT_CATEGORIES.forEach((name) => {
      categoryMap.set(name.toLowerCase(), { name, isDefault: true, description: '' });
    });

    // 2. Add DB categories
    dbCategories.forEach((cat) => {
      categoryMap.set(cat.name.toLowerCase(), {
        _id: cat._id,
        name: cat.name,
        description: cat.description || '',
        isDefault: cat.isDefault || false,
      });
    });

    // 3. Add any distinct categories currently on products
    productCategories.filter(Boolean).forEach((name) => {
      if (!categoryMap.has(name.toLowerCase())) {
        categoryMap.set(name.toLowerCase(), { name, isDefault: false, description: '' });
      }
    });

    res.json(Array.from(categoryMap.values()));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
};

// POST /api/products/categories
export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const trimmedName = name.trim();

    // Check if it already exists in DB
    const existing = await Category.findOne({ name: { $regex: new RegExp(`^${trimmedName}$`, 'i') } });
    if (existing) {
      return res.status(400).json({ message: `Category "${trimmedName}" already exists` });
    }

    const isDefault = DEFAULT_CATEGORIES.some(c => c.toLowerCase() === trimmedName.toLowerCase());
    if (isDefault) {
      return res.status(400).json({ message: `Category "${trimmedName}" is already a standard category` });
    }

    const newCat = new Category({
      name: trimmedName,
      description: description?.trim() || '',
      isDefault: false,
    });
    await newCat.save();

    res.status(201).json(newCat);
  } catch (error) {
    res.status(400).json({ message: 'Error creating category', error: error.message });
  }
};

// DELETE /api/products/categories/:id
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const cat = await Category.findById(id).catch(() => null)
      || await Category.findOne({ name: { $regex: new RegExp(`^${id}$`, 'i') } });

    if (!cat) {
      return res.status(404).json({ message: 'Category not found' });
    }

    await Category.findByIdAndDelete(cat._id);
    res.json({ message: `Category "${cat.name}" deleted successfully` });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting category', error: error.message });
  }
};
