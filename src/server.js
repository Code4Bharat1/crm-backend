import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import connectDB from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Existing routes
import authRoutes from './routes/authRoutes.js';
import auditLogRoutes from './routes/auditLogRoutes.js';
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
import employeeRoutes from './routes/employeeRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import expenseClaimRoutes from './routes/expenseClaimRoutes.js';

// Projects & Service routes
import projectRoutes from './routes/projectRoutes.js';
import serviceRequestRoutes from './routes/serviceRequestRoutes.js';
import warrantyRoutes from './routes/warrantyRoutes.js';
import roleRoutes from './routes/roleRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import bankRoutes from './routes/bankRoutes.js';
import followUpRoutes from './routes/followUpRoutes.js';
import reportRoutes from './routes/reportRoutes.js';

dotenv.config();
connectDB();
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
// ─── CORS Configuration ──────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://crm.nexcorealliance.com',
  'https://api-crm.nexcorealliance.com',
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(s => s.trim()) : [])
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow non-browser requests (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.includes(origin) ||
      /^https?:\/\/([a-z0-9-]+\.)*nexcorealliance\.com(:\d+)?$/i.test(origin) ||
      /^http:\/\/localhost(:\d+)?$/i.test(origin) ||
      /^http:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin);

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[CORS Blocked] Origin not allowed: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-role', 'X-Requested-With', 'Accept', 'Origin']
}));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Existing Routes ────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/audit-logs', auditLogRoutes);
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
app.use('/api/employees', employeeRoutes );
app.use('/api/attendance', attendanceRoutes);
app.use('/api/expense-claims', expenseClaimRoutes);

// ─── Projects & Service Routes ──────────────────────────────────────────────
app.use('/api/projects', projectRoutes);
app.use('/api/service-requests', serviceRequestRoutes);
app.use('/api/warranties', warrantyRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/bank', bankRoutes);
app.use('/api/follow-ups', followUpRoutes);
app.use('/api/reports', reportRoutes);

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

// Prevent server crash from unhandled external socket drops or promise rejections
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ [Process] Unhandled Promise Rejection:', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ [Process] Uncaught Exception:', err?.message || err);
});

