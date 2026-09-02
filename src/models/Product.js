import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  itemCode: { type: String, unique: true, sparse: true, index: true }, // SKU / Item Code
  name: { type: String, required: true, trim: true, index: true },
  description: { type: String, trim: true },
  category: { type: String, default: 'General', index: true },
  brand: { type: String, default: 'Generic' },
  hsnCode: { type: String, default: '8537' },
  unit: { type: String, default: 'Nos' }, // Nos, Mtrs, Set, Kg, Pcs, etc.
  price: { type: Number, required: true, default: 0 }, // Selling unit price
  costPrice: { type: Number, default: 0 }, // Purchase / landed cost
  gstRate: { type: Number, default: 18 }, // 0, 5, 12, 18, 28
  stock: { type: Number, default: 0 }, // Current available stock quantity
  minStock: { type: Number, default: 5 }, // Low stock reorder threshold
  location: { type: String, default: 'Main Warehouse - Bay 1' },
  supplier: {
    id: { type: String },
    name: { type: String },
  },
  warrantyMonths: { type: Number, default: 12 },
  serialTracked: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['Active', 'Discontinued', 'Out of Stock'],
    default: 'Active',
  },
}, { timestamps: true });

// Auto-generate itemCode if not provided (e.g. PRD-001)
productSchema.pre('validate', async function () {
  if (!this.itemCode) {
    const count = await mongoose.model('Product').countDocuments();
    this.itemCode = `PRD-${String(count + 1).padStart(3, '0')}`;
  }
});

export default mongoose.model('Product', productSchema);
