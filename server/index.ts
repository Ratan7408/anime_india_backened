import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from server folder
const envPath = join(__dirname, '.env');
console.log('🔍 Loading .env from:', envPath);
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('❌ Error loading .env:', result.error);
} else {
  console.log('✅ .env loaded successfully from:', envPath);
  console.log('📋 Variables loaded:', Object.keys(result.parsed || {}).length);
}

// Also load from root directory as fallback
dotenv.config();


console.log('🚀 Starting server...');

import express, { response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import { protect, authorize } from './middleware/auth.js';
import transporter from './config/nodemailer.js';
// removed duplicate dotenv import
// fileURLToPath and dirname already imported above
import fs from 'fs';
import passport from 'passport';

// Import routes
import authRoutes from './routes/auth.js';
import paymentRoutes from './routes/payment.js';
import phonepeCallback from './routes/phonepeCallback.js';
import purchaseRoutes from './routes/purchases.js';
import cartRoutes from './routes/cart.js';
import wishlistRoutes from './routes/wishlist.js';

// Import models to ensure they are registered with mongoose
import User from './models/user.js';
import './models/Purchase.js';
import './models/Product.js'; // Added Product model import
import './models/Cart.js'; // Added Cart model import
import './models/Wishlist.js'; // Added Wishlist model import
import { storage } from './storage'; // Added storage import
import apiRouter from './routes'; // ✅ root routes router

// __dirname already defined above

// Environment variables already loaded above

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ================================
// 🔧 WEBSOCKET CONNECTION HANDLING
// ================================

// Track connected admin users
io.on('connection', (socket) => {
  console.log('📱 Client connected:', socket.id);

  // Handle admin authentication via WebSocket
  socket.on('admin-login', (adminData: any) => {
    if (adminData && adminData.adminId && adminData.email) {
      socket.join('admin-room');
      console.log('👑 Admin connected:', adminData.email);
      
      // Send connection confirmation
      socket.emit('admin-authenticated', {
        message: 'Connected to order notifications',
        adminCount: io.sockets.adapter.rooms.get('admin-room')?.size || 0
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    if (socket.rooms.has('admin-room')) {
      console.log('👑 Admin disconnected:', socket.id);
    }
  });
});

const PORT = process.env.PORT || 5000;

// ================================
// 🔧 NOTIFICATION SERVICE CLASS
// ==============================

// ================================
// 🔒 SECURITY & MIDDLEWARE
// ================================

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || ['https://pod2.animeindia.org', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
}));

app.use(mongoSanitize());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(passport.initialize());

// ================================
// 📁 STATIC FILES SETUP
// ================================

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory:', uploadsDir);
}

app.use(express.static(path.join(__dirname, '../dist')));

// Serve HTML files directly
app.get('/phonepay-simulator.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../phonepay-simulator.html'));
});

app.get('/payment-success.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../payment-success.html'));
});

// Simple payment route as suggested
app.post('/pay', async (req, res) => {
  try {
    const payload = {
      merchantId: "PGTESTPAYUAT",
      merchantTransactionId: `TXN_${Date.now()}`,
      merchantUserId: "USER123",
      amount: 219800, // in paise (2198.00 INR)
      redirectUrl: "http://localhost:5000/payment-success.html",
      redirectMode: "REDIRECT",
      callbackUrl: "http://localhost:5000/payment-success.html",
      paymentInstrument: {
        type: "PAY_PAGE"
      }
    };

    // For testing, redirect to our simulator
    const redirectUrl = `http://localhost:5000/phonepay-simulator.html?merchantId=${payload.merchantId}&merchantTransactionId=${payload.merchantTransactionId}&amount=${payload.amount}`;
    res.json({ redirectUrl });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Payment initiation failed" });
  }
});
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(uploadsDir));

// Serve size chart image
app.use('/assets', express.static(path.join(__dirname)));

console.log('📁 Serving uploads from:', uploadsDir);

// ================================
// 🔐 AUTH ROUTES
// ================================

app.use('/api/auth', authRoutes);

// ================================
// 💳 PAYMENT ROUTES
// ================================
app.use('/api/payment', paymentRoutes);
app.use('/api/payment', phonepeCallback); // PhonePe redirect callback after payment

// ================================
// 📧 CONTACT FORM ROUTE
// ================================

app.post('/api/contact', async (req, res) => {
  const { name, email, orderNumber, inquiryType, message } = req.body;
  if (!name || !email || !inquiryType || !message) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields.'
    });
  }

  const supportEmail = process.env.SUPPORT_EMAIL || 'support@animeindiapod.com';
  const subject = `Contact Form: ${inquiryType} from ${name}`;
  const html = `
    <h2>New Contact Inquiry</h2>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email}</p>
    ${orderNumber ? `<p><strong>Order Number:</strong> ${orderNumber}</p>` : ''}
    <p><strong>Inquiry Type:</strong> ${inquiryType}</p>
    <p><strong>Message:</strong></p>
    <p>${message.replace(/\n/g, '<br/>')}</p>
  `;

  try {
    await transporter.sendMail({
      from: process.env.FROM_CONTACT_EMAIL,
      to: supportEmail,
      subject,
      html,
    });
    return res.json({ success: true, message: 'Message sent successfully.' });
  } catch (error: any) {
    console.error('Contact form email error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send message.', error: error.message });
  }
});

// ================================
// 🛒 PURCHASE ROUTES
// ================================

app.use('/api/purchases', purchaseRoutes);

// ================================
// 🛒 CART ROUTES
// ================================

app.use('/api/cart', cartRoutes);

// ================================
// ❤️ WISHLIST ROUTES
// ================================

app.use('/api/wishlist', wishlistRoutes);

// ================================
// 📦 API ROUTER (root routes.ts)
// ================================

// Note: apiRouter is mounted later in the file to avoid conflicts

// Ironspidy Code
app.post('/api/mail', async (req, res) => {
  try {
    console.log('📧 /api/mail endpoint called');
    try {
      console.log('Request body:', JSON.stringify(req.body, null, 2));
    } catch (stringifyError) {
      console.log('Request body (raw):', req.body);
    }
    
    const { purchase } = req.body;
    
    if (!purchase) {
      console.error('❌ Missing purchase object in request');
      return res.status(400).json({
        success: false,
        message: 'Missing purchase details.'
      });
    }

    // Validate required fields
    if (!purchase.userEmail) {
      console.error('❌ Missing userEmail in purchase');
      return res.status(400).json({
        success: false,
        message: 'Missing userEmail in purchase details.'
      });
    }

    if (!purchase.userName) {
      console.warn('⚠️ Missing userName, using userEmail as fallback');
    }

    if (!purchase.items || !Array.isArray(purchase.items) || purchase.items.length === 0) {
      console.error('❌ Missing or invalid items array');
      return res.status(400).json({
        success: false,
        message: 'Missing or invalid items in purchase details.'
      });
    }

    // Prepare admin emails
    const adminEmails = process.env.ADMIN_EMAILS
      ? process.env.ADMIN_EMAILS.split(',').map(e => e.trim())
      : ['ratansrivastav179@gmail.com']; // fallback to admin email

    const userEmail = purchase.userEmail;
    const userName = purchase.userName || purchase.userEmail || 'Customer';

    console.log(`📧 Preparing email for user: ${userEmail}, admin: ${adminEmails.join(', ')}`);

    // Email content
    const orderDetails = `
      <h2>Order Confirmation</h2>
      <p>Thank you, ${userName}, for your purchase!</p>
      <p><strong>Order ID:</strong> ${purchase.id || 'N/A'}</p>
      <p><strong>Total Amount:</strong> ₹${purchase.totalAmount || '0'}</p>
      <h3>Items:</h3>
      <ul>
        ${purchase.items.map((item: any) => `
          <li>
            ${item.productName || 'Product'} (x${item.quantity || 1}) - ₹${item.price || '0'}
          </li>
        `).join('')}
      </ul>
      <p>Status: ${purchase.status || 'pending'}</p>
      <p>Order Date: ${purchase.createdAt || new Date().toISOString()}</p>
    `;

    // Check if email is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.warn('⚠️ Email not configured: SMTP_USER or SMTP_PASSWORD missing');
      return res.status(500).json({
        success: false,
        message: 'Email not configured',
        error: 'SMTP_USER or SMTP_PASSWORD environment variables are missing'
      });
    }

    // Verify transporter first
    console.log('🔍 Verifying email transporter for /api/mail...');
    try {
      await transporter.verify();
      console.log('✅ Email transporter verified successfully');
    } catch (verifyError: any) {
      console.error('❌ Email transporter verification failed:', verifyError);
      return res.status(500).json({
        success: false,
        message: 'Email transporter verification failed',
        error: verifyError.message,
        details: {
          code: verifyError.code,
          response: verifyError.response
        }
      });
    }

    // For Brevo, use a verified sender email as "from", not the SMTP login
    const fromEmail = process.env.FROM_CONTACT_EMAIL || "ratansrivastav179@gmail.com";
    console.log(`📧 Using from email: ${fromEmail}`);
    
    // Send to user
    console.log(`📧 Sending email to user: ${userEmail}`);
    let userEmailResult;
    try {
      userEmailResult = await transporter.sendMail({
        from: fromEmail,
        to: userEmail,
        subject: 'Your Order Confirmation',
        html: orderDetails,
      });
      console.log(`✅ User email sent. Message ID: ${userEmailResult.messageId}`);
    } catch (userEmailError: any) {
      console.error('❌ Failed to send user email:', userEmailError);
      throw userEmailError;
    }

    // Send to admin(s)
    console.log(`📧 Sending email to admin(s): ${adminEmails.join(', ')}`);
    console.log(`📧 Admin emails array:`, adminEmails);
    console.log(`📧 Admin emails count:`, adminEmails.length);
    
    // Send to admin(s) - send individually to catch any errors
    let adminEmailResults = [];
    for (const adminEmail of adminEmails) {
      try {
        console.log(`📧 Attempting to send email to admin: ${adminEmail}`);
        const adminEmailResult = await transporter.sendMail({
          from: fromEmail,
          to: adminEmail,
          subject: `New Order Received: ${purchase.id || 'N/A'}`,
          html: `<h2>New Order from ${userName} (${userEmail})</h2>` + orderDetails,
        });
        console.log(`✅ Admin email sent successfully to ${adminEmail}!`);
        console.log(`   Message ID: ${adminEmailResult.messageId}`);
        console.log(`   Response: ${adminEmailResult.response}`);
        adminEmailResults.push(adminEmailResult);
      } catch (adminEmailError: any) {
        console.error(`❌ Failed to send admin email to ${adminEmail}:`, adminEmailError);
        console.error(`   Error message: ${adminEmailError.message}`);
        console.error(`   Error code: ${adminEmailError.code}`);
        console.error(`   Error response: ${adminEmailError.response}`);
        // Continue with other admin emails even if one fails
      }
    }

    return res.json({
      success: true,
      message: 'Order confirmation email sent to user and admin.',
      userMessageId: userEmailResult?.messageId,
      adminMessageIds: adminEmailResults.map(r => r.messageId),
      adminEmailsSent: adminEmails.length,
      adminEmailsSuccessful: adminEmailResults.length
    });
  } catch (error: any) {
    console.error('❌ /api/mail endpoint error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      response: error.response,
      responseCode: error.responseCode,
      command: error.command,
      name: error.name
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.message || 'Unknown error',
      details: {
        code: error.code,
        response: error.response,
        name: error.name
      }
    });
  }
});

// ================================
// 🧪 TEST EMAIL ENDPOINT (for debugging)
// ================================
app.post('/api/test-email', async (req, res) => {
  try {
    console.log('🧪 Test email endpoint called');
    const { email } = req.body;
    const testEmail = email || 'ratansrivastav179@gmail.com';

    console.log('📧 Testing email configuration...');
    console.log('SMTP_USER:', process.env.SMTP_USER ? `✅ Set (${process.env.SMTP_USER})` : '❌ Missing');
    console.log('SMTP_PASSWORD:', process.env.SMTP_PASSWORD ? '✅ Set' : '❌ Missing');

    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      return res.status(500).json({
        success: false,
        message: 'Email not configured',
        error: 'SMTP_USER or SMTP_PASSWORD environment variables are missing'
      });
    }

    // Verify transporter
    console.log('🔍 Verifying email transporter...');
    await transporter.verify();
    console.log('✅ Email transporter verified successfully');

    const fromEmail = process.env.FROM_CONTACT_EMAIL || "ratansrivastav179@gmail.com";
    console.log(`📧 Sending test email from ${fromEmail} to ${testEmail}`);

    const testResult = await transporter.sendMail({
      from: fromEmail,
      to: testEmail,
      subject: '🧪 Test Email - Email System Check',
      html: `
        <h2>Email System Test</h2>
        <p>If you received this email, your email system is working correctly! ✅</p>
        <p><strong>Test Time:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>SMTP Server:</strong> smtp-relay.brevo.com</p>
      `,
    });

    console.log(`✅ Test email sent successfully! Message ID: ${testResult.messageId}`);

    return res.json({
      success: true,
      message: 'Test email sent successfully',
      data: {
        to: testEmail,
        from: fromEmail,
        messageId: testResult.messageId,
        response: testResult.response
      }
    });
  } catch (error: any) {
    console.error('❌ Test email error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error.message,
      details: {
        code: error.code,
        response: error.response
      }
    });
  }
});

// ================================
// 🗃️ DATABASE CONNECTION
// ================================

const connectDB = async (): Promise<void> => {
  try {
    if (process.env.MONGODB_URI) {
      const conn = await mongoose.connect(process.env.MONGODB_URI);
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

      // Create default admin user if it doesn't exist
      const User = mongoose.model('User');
      const adminUser = await User.findOne({ email: 'admin@tshirtapp.com' });

      if (!adminUser) {
        const newAdmin = new User({
          email: 'admin@tshirtapp.com',
          firstName: 'Admin',
          lastName: 'User',
          password: 'admin123', // Let the pre-save hook hash it
          role: 'admin',
          isEmailVerified: true,
          isActive: true,
        });

        await newAdmin.save();
        console.log('✅ Default admin user created');
      }

      // Create default superadmin user if it doesn't exist
      const superAdminUser = await User.findOne({ email: 'superadmin@tshirtapp.com' });

      if (!superAdminUser) {
        const newSuperAdmin = new User({
          email: 'superadmin@tshirtapp.com',
          firstName: 'Super',
          lastName: 'Admin',
          password: 'super123', // Let the pre-save hook hash it
          role: 'superadmin',
          isEmailVerified: true,
          isActive: true,
        });

        await newSuperAdmin.save();
        console.log('✅ Default superadmin user created');
      }

      // Create default test user if it doesn't exist
      const testUser = await User.findOne({ email: 'user@test.com' });

      if (!testUser) {
        const newTestUser = new User({
          email: 'user@test.com',
          firstName: 'Test',
          lastName: 'User',
          password: 'user123', // Let the pre-save hook hash it
          role: 'user',
          isEmailVerified: true,
          isActive: true,
        });

        await newTestUser.save();
        console.log('✅ Default test user created');
      }

    } else {
      console.log('⚠️ No MongoDB URI provided - running with in-memory data');
    }
  } catch (error) {
    console.log('⚠️ Database connection failed - continuing with in-memory data');
    console.error('Database error:', error);
  }
};

// Connect to database
connectDB();

// Listen for mongoose connection event to display database statistics
let statsDisplayed = false;
mongoose.connection.on('connected', async () => {
  if (statsDisplayed) return; // Prevent duplicate display
  statsDisplayed = true;
  
  // Wait a moment for models to be ready
  setTimeout(async () => {
    const stats = await getDatabaseStats(3, 500);
    
    if (!stats.error) {
      console.log(`
📊 Database Statistics:
   🛍️ Products: ${stats.products}
   ⭐ Featured: ${stats.featured}
   📦 Categories: ${stats.categories}
   🛒 Orders: ${stats.orders}
      `);
    }
  }, 1000);
});

// ================================
// 🗄️ SAMPLE DATA
// ================================

// Store orders in memory
let orders: any[] = [];
let nextOrderId = 1;

// ================================
// 🛣️ API ROUTES
// ================================

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running perfectly!',
    timestamp: new Date().toISOString(),
    connectedAdmins: io.sockets.adapter.rooms.get('admin-room')?.size || 0,
    environment: process.env.NODE_ENV || 'development',
    emailConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASSWORD)
  });
});

// ================================
// 📋 PRODUCTS ENDPOINTS
// ================================

// Register MongoDB-backed API routes
// Mount root API router
console.log('🔗 Mounting API router with bulk out-of-stock endpoint...');
app.use('/api', apiRouter);

// ---------------- Superadmin: User management (minimal) ----------------
// List users (superadmin only)
app.get('/api/admin/users', protect, authorize('superadmin'), async (req, res) => {
  try {
    const User = mongoose.model('User');
    const users = await User.find({}, '-password -refreshTokens').sort({ createdAt: -1 }).limit(500);
    res.json({ success: true, data: users });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to fetch users' });
  }
});

// Update user role (superadmin only)
app.put('/api/admin/users/:id/role', protect, authorize('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body as { role?: string };
    if (!role || !['user', 'admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }
    const user = await User.findByIdAndUpdate(id, { role }, { new: true, select: '-password -refreshTokens' });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e?.message || 'Failed to update role' });
  }
});

// Authenticated user profile update
app.put('/api/users/profile', protect, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { firstName, lastName, email, phone, address = {} } = req.body || {};
    const updates: any = {
      firstName,
      lastName,
      email,
      phone,
      address: {
        street: address.street || '',
        city: address.city || '',
        state: address.state || '',
        zipCode: address.zipCode || '',
        country: address.country || '',
      },
      updatedAt: new Date(),
    };

    const user = await User.findByIdAndUpdate((req.user as any)._id, updates, {
      new: true,
      select: '-password -refreshTokens',
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error: any) {
    console.error('❌ Profile update failed:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update profile' });
  }
});

// Update /api/products/categories to use storage abstraction
app.get('/api/products/categories', async (req, res) => {
  try {
    const categories = await storage.getCategories();
    res.status(200).json({
      success: true,
      message: 'Categories retrieved successfully',
      data: categories,
      count: categories.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
});

// ================================
// 📸 IMAGE UPLOAD ENDPOINT
// ================================

app.post('/api/upload', (req, res) => {
  try {
    const { image, filename } = req.body;

    if (!image || !filename) {
      return res.status(400).json({
        success: false,
        error: 'Image data and filename are required'
      });
    }

    if (!image.startsWith('data:image/')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid image format. Must be base64 encoded image.'
      });
    }

    const base64Match = image.match(/^data:image\/([a-zA-Z]*);base64,(.+)$/);
    if (!base64Match) {
      return res.status(400).json({
        success: false,
        error: 'Invalid base64 image format'
      });
    }

    const imageType = base64Match[1];
    const base64Data = base64Match[2];

    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 10000);
    const fileExtension = filename.includes('.') ?
      filename.split('.').pop() :
      imageType || 'jpg';
    const uniqueFilename = `product_${timestamp}_${randomNum}.${fileExtension}`;

    const filePath = path.join(uploadsDir, uniqueFilename);

    fs.writeFileSync(filePath, base64Data, 'base64');

    const imageUrl = `/uploads/${uniqueFilename}`;

    res.status(200).json({
      success: true,
      imageUrl: imageUrl,
      filename: uniqueFilename,
      originalFilename: filename,
      fileSize: fs.statSync(filePath).size
    });

  } catch (error: any) {
    console.error('❌ Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// ================================
// 📊 ADMIN ANALYTICS ENDPOINTS
// ================================

app.get('/api/admin/stats', async (req, res) => {
  try {
    // Import models
    const Purchase = (await import('./models/Purchase.js')).default;
    const Product = (await import('./models/Product.js')).default;

    // Fetch all purchases from database
    const allPurchases = await Purchase.find({});
    const totalOrders = allPurchases.length;
    const deliveredStatuses = ['delivered', 'completed'];
    const revenueEligibleOrders = allPurchases.filter(o => deliveredStatuses.includes((o.status || '').toLowerCase()));
    const totalRevenue = revenueEligibleOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const completedOrders = revenueEligibleOrders.length;
    const averageOrderValue = revenueEligibleOrders.length > 0 ? totalRevenue / revenueEligibleOrders.length : 0;

    // Get recent orders (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const recentOrders = allPurchases.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= weekAgo;
    });

    const recentRevenue = recentOrders
      .filter(order => deliveredStatuses.includes((order.status || '').toLowerCase()))
      .reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    // Fetch product counts from database
    const totalProducts = await Product.countDocuments({});
    const featuredProducts = await Product.countDocuments({ featured: true });
    const inStockProducts = await Product.countDocuments({ inStock: true, status: 'in-stock' });

    const stats = {
      totalOrders,
      totalRevenue,
      completedOrders,
      averageOrderValue,
      recentOrders: recentOrders.length,
      recentRevenue,
      connectedAdmins: 0,
      totalProducts,
      featuredProducts,
      inStockProducts
    };

    res.status(200).json({
      success: true,
      message: 'Admin statistics retrieved successfully',
      data: stats
    });
  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin statistics',
      error: error.message
    });
  }
});

// ================================
// 🧪 UPLOAD TEST ENDPOINTS
// ================================

app.get('/api/upload/health', (req, res) => {
  const uploadsExists = fs.existsSync(uploadsDir);

  res.json({
    success: true,
    status: 'Upload endpoint is working!',
    uploadsDirectory: uploadsDir,
    exists: uploadsExists,
    writable: uploadsExists ? 'yes' : 'directory will be created on first upload',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/upload/list', (req, res) => {
  try {
    if (!fs.existsSync(uploadsDir)) {
      return res.json({
        success: true,
        message: 'No uploads directory found',
        files: []
      });
    }

    const files = fs.readdirSync(uploadsDir).map(filename => {
      const filePath = path.join(uploadsDir, filename);
      const stats = fs.statSync(filePath);
      return {
        filename,
        url: `/uploads/${filename}`,
        size: stats.size,
        created: stats.birthtime,
        accessible: `http://localhost:${PORT}/uploads/${filename}`
      };
    });

    res.json({
      success: true,
      message: 'Uploaded files retrieved',
      files,
      count: files.length,
      uploadsDir
    });

  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ================================
// 🎭 FRONTEND ROUTES
// ================================

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Anime Store API with Real-time Notifications!',
    version: '2.0.0',
    features: [
      'Real-time admin notifications via WebSocket',
      'Email alerts for new orders (if configured)',
      'Complete order management system',
      'Product CRUD operations',
      'Image upload support',
      'Admin analytics dashboard'
    ],
    endpoints: {
      health: '/api/health',
      products: '/api/products',
      categories: '/api/products/categories',
      orders: '/api/orders',
      adminStats: '/api/admin/stats',
      upload: '/api/upload'
    },
    stats: {
      totalProducts: 0, // No longer fetching from sampleProducts
      totalOrders: orders.length,
      featuredProducts: 0, // No longer fetching from sampleProducts
      categories: 0, // No longer fetching from sampleProducts
      connectedAdmins: io.sockets.adapter.rooms.get('admin-room')?.size || 0
    },
    notifications: {
      emailConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASSWORD),
      adminEmails: process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').length : 0,
      webSocketActive: true
    }
  });
});

app.get('*', (req, res) => {
  // Only serve React app for non-API routes
  if (!req.path.startsWith('/api/')) {
    const indexPath = path.join(__dirname, '../dist/index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.json({
        success: true,
        message: 'Anime Store API - Frontend not built yet',
        note: 'Run `npm run build` to generate frontend files',
        currentPath: req.path,
        availableEndpoints: [
          'GET /api/health',
          'GET /api/products',
          'GET /api/products/categories',
          'GET /api/products/:id',
          'POST /api/products',
          'PUT /api/products/:id',
          'DELETE /api/products/:id',
          'POST /api/upload',
          'GET /api/upload/health',
          'GET /api/upload/list',
          'POST /api/orders',
          'GET /api/orders',
          'GET /api/orders/:id',
          'GET /api/admin/stats',
          'POST /api/mail',
        ]
      });
    }
  } else {
    res.status(404).json({
      success: false,
      message: 'API route not found',
      path: req.originalUrl
    });
  }
});

// ================================
// 🚫 ERROR HANDLING
// ================================

app.use('/api/*', (req, res) => {
  console.log('❌ API route not found:', req.originalUrl);
  res.status(404).json({
    success: false,
    message: 'API route not found',
    path: req.originalUrl,
    method: req.method
  });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('🚨 Global Error Handler:', err.message);

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack
    })
  });
});

// ================================
// 🚀 SERVER STARTUP
// ================================

// Function to fetch database statistics with retry
async function getDatabaseStats(maxRetries = 5, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check if database is connected
      if (mongoose.connection.readyState !== 1) {
        if (attempt < maxRetries) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        return {
          products: 0,
          featured: 0,
          categories: 0,
          orders: 0,
          error: 'Database not connected'
        };
      }

      // Import models
      const Purchase = (await import('./models/Purchase.js')).default;
      const Product = (await import('./models/Product.js')).default;

      // Fetch counts from database
      const totalProducts = await Product.countDocuments({});
      const featuredProducts = await Product.countDocuments({ featured: true });
      const categories = await Product.distinct('category');
      const totalOrders = await Purchase.countDocuments({});

      return {
        products: totalProducts,
        featured: featuredProducts,
        categories: categories.length,
        orders: totalOrders,
        error: null
      };
    } catch (error: any) {
      if (attempt < maxRetries) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      console.error('❌ Error fetching database stats:', error.message);
      return {
        products: 0,
        featured: 0,
        categories: 0,
        orders: 0,
        error: error.message
      };
    }
  }
  
  return {
    products: 0,
    featured: 0,
    categories: 0,
    orders: 0,
    error: 'Failed to fetch stats after retries'
  };
}

const serverInstance = server.listen(PORT, async () => {
  console.log(`
🎉 ===============================================
🎌 ANIME STORE SERVER SUCCESSFULLY STARTED!
🎉 ===============================================

🚀 Server Details:
   Port: ${PORT}
   Environment: ${process.env.NODE_ENV || 'development'}
   Process ID: ${process.pid}
   Node Version: ${process.version}

🌐 Access URLs:
   📱 Local: http://localhost:${PORT}
   📋 Health: http://localhost:${PORT}/api/health
   🛍️ Products: http://localhost:${PORT}/api/products
   📂 Categories: http://localhost:${PORT}/api/products/categories
   📸 Upload: http://localhost:${PORT}/api/upload/health
   📊 Admin Stats: http://localhost:${PORT}/api/admin/stats

🔔 Notification System:
   📧 Email: ${process.env.SMTP_USER && process.env.SMTP_PASSWORD ? '✅ Configured' : '❌ Not configured (WebSocket only)'}
   📱 Admin Emails: ${process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').length : 0}
   🔗 WebSocket: ✅ Active
   👑 Connected Admins: ${io.sockets.adapter.rooms.get('admin-room')?.size || 0}

📁 File System:
   📂 Uploads: ${uploadsDir}
   📄 Static Files: ${path.join(__dirname, '../dist')}

🛠️ Available API Endpoints:
   GET    /api/health
   GET    /api/products
   GET    /api/products/categories
   GET    /api/products/:id
   POST   /api/products
   PUT    /api/products/:id
   DELETE /api/products/:id
   POST   /api/upload
   GET    /api/upload/health
   GET    /api/upload/list
   POST   /api/orders (🔔 triggers notifications)
   GET    /api/orders
   GET    /api/orders/:id
   GET    /api/admin/stats

🎯 Test the Complete Flow:
   1. 👩‍💼 Admin: http://localhost:${PORT}/admin
   2. 🛍️ Customer: http://localhost:${PORT}/products
   3. 📦 Buy Product → 🔔 Admin gets notification!

✅ Your anime store is ready for business!
===============================================
  `);
  
  // Note: Database statistics will appear once the database connection is established
});

// // ================================
// // 🔄 GRACEFUL SHUTDOWN
// // ================================

// const gracefulShutdown = (signal: string) => {
//   console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

//   serverInstance.close(() => {
//     console.log('🔌 HTTP server closed');

//     io.close(() => {
//       console.log('🔌 WebSocket server closed');

//       mongoose.connection.close(() => {
//         console.log('🔌 Database connection closed');
//         console.log('✅ Graceful shutdown completed');
//         process.exit(0);
//       });
//     });
//   });

//   setTimeout(() => {
//     console.error('⚠️ Could not close connections in time, forcefully shutting down');
//     process.exit(1);
//   }, 10000);
// };

// process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
// process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// process.on('uncaughtException', (error) => {
//   console.error('🚨 Uncaught Exception:', error);
//   gracefulShutdown('uncaughtException');
// });

// process.on('unhandledRejection', (reason, promise) => {
//   console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
//   gracefulShutdown('unhandledRejection');
// });

export default app;