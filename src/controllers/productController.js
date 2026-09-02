import Product from '../models/Product.js';

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
