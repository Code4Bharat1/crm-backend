import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';

// Existing routes
import authRoutes from './routes/authRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import salesRoutes from './routes/salesRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js';

// New business document routes
import companyRoutes from './routes/companyRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import quotationRoutes from './routes/quotationRoutes.js';
import proformaRoutes from './routes/proformaRoutes.js';
import salesOrderRoutes from './routes/salesOrderRoutes.js';
import deliveryNoteRoutes from './routes/deliveryNoteRoutes.js';
import salesInvoiceRoutes from './routes/salesInvoiceRoutes.js';
import purchaseOrderRoutes from './routes/purchaseOrderRoutes.js';
import productRoutes from './routes/productRoutes.js';
import serialNumberRoutes from './routes/serialNumberRoutes.js';

dotenv.config();
connectDB();

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(cors());

// ─── Existing Routes ────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// ─── Products & Inventory Routes ────────────────────────────────────────────
app.use('/api/products', productRoutes);
app.use('/api/serial-numbers', serialNumberRoutes);

// ─── Business Document Routes ────────────────────────────────────────────────
app.use('/api/company', companyRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/proformas', proformaRoutes);
app.use('/api/sales-orders', salesOrderRoutes);
app.use('/api/delivery-notes', deliveryNoteRoutes);
app.use('/api/invoices', salesInvoiceRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
