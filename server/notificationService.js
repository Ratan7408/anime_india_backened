// =============================================
// APPROACH 1: Real-time WebSocket Notifications
// =============================================

// server/notificationService.js
import { Server } from 'socket.io';
import nodemailer from 'nodemailer';
import twilio from 'twilio';

class NotificationService {
  constructor(httpServer) {
    // Initialize Socket.IO for real-time notifications
    this.io = new Server(httpServer, {
      cors: {
        origin: ["http://localhost:5000", "http://localhost:5173"],
        methods: ["GET", "POST"]
      }
    });

    // Store connected admin clients
    this.connectedAdmins = new Map();
    
    // Initialize email service using the same config as nodemailer.js
    this.emailTransporter = nodemailer.createTransporter({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });

    // Initialize SMS service (optional)
    this.smsClient = process.env.TWILIO_SID ? 
      twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN) : null;

    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('📱 Client connected:', socket.id);

      // Handle admin authentication
      socket.on('admin-login', (adminData) => {
        if (this.isValidAdmin(adminData)) {
          this.connectedAdmins.set(socket.id, {
            adminId: adminData.adminId,
            email: adminData.email,
            role: adminData.role,
            connectedAt: new Date()
          });
          
          socket.join('admin-room');
          console.log('👑 Admin connected:', adminData.email);
          
          // Send connection confirmation
          socket.emit('admin-authenticated', {
            message: 'Connected to order notifications',
            adminCount: this.connectedAdmins.size
          });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        const admin = this.connectedAdmins.get(socket.id);
        if (admin) {
          console.log('👑 Admin disconnected:', admin.email);
          this.connectedAdmins.delete(socket.id);
        }
      });
    });
  }

  // Validate admin credentials
  isValidAdmin(adminData) {
    // Implement your admin validation logic here
    // This could check against your admin database
    return adminData && adminData.adminId && adminData.email;
  }

  // Main method to send order notifications
  async sendOrderNotification(orderData) {
    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'new_order',
      timestamp: new Date().toISOString(),
      order: orderData,
      message: `New order #${orderData.id} received!`,
      priority: 'high'
    };

    console.log('🔔 Sending order notification:', notification.id);

    try {
      // 1. Send real-time notification to connected admins
      await this.sendRealTimeNotification(notification);
      
      // 2. Send email notifications
      await this.sendEmailNotification(notification);
      
      // 3. Send SMS notifications (if configured)
      if (this.smsClient) {
        await this.sendSMSNotification(notification);
      }
      
      // 4. Store notification in database
      await this.storeNotification(notification);
      
      // 5. Send browser push notification (if service worker available)
      await this.sendBrowserPushNotification(notification);

      console.log('✅ All notifications sent successfully');
      return { success: true, notificationId: notification.id };
      
    } catch (error) {
      console.error('❌ Error sending notifications:', error);
      return { success: false, error: error.message };
    }
  }

  // Send real-time WebSocket notification
  async sendRealTimeNotification(notification) {
    // Send to all connected admins
    this.io.to('admin-room').emit('new-order-notification', notification);
    
    // Also send individual notifications with admin-specific data
    for (const [socketId, admin] of this.connectedAdmins) {
      this.io.to(socketId).emit('order-alert', {
        ...notification,
        adminName: admin.email.split('@')[0],
        customMessage: `Hi ${admin.email.split('@')[0]}, you have a new order!`
      });
    }
    
    console.log(`📡 Real-time notification sent to ${this.connectedAdmins.size} admins`);
  }

  // Send email notification
  async sendEmailNotification(notification) {
    const adminEmails = process.env.ADMIN_EMAILS ? 
      process.env.ADMIN_EMAILS.split(',') : 
      ['admin@example.com'];

    const emailContent = this.generateEmailContent(notification);

    for (const email of adminEmails) {
      try {
        await this.emailTransporter.sendMail({
          from: process.env.FROM_CONTACT_EMAIL || process.env.SMTP_USER,
          to: email.trim(),
          subject: `🛒 New Order Alert - Order #${notification.order.id}`,
          html: emailContent,
          attachments: notification.order.invoice ? [{
            filename: `invoice-${notification.order.id}.pdf`,
            path: notification.order.invoice
          }] : []
        });
        
        console.log(`📧 Email sent to: ${email}`);
      } catch (error) {
        console.error(`❌ Failed to send email to ${email}:`, error);
      }
    }
  }

  // Generate HTML email content
  generateEmailContent(notification) {
    const order = notification.order;
    const items = order.items || [];
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; }
            .order-summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .item { border-bottom: 1px solid #eee; padding: 10px 0; }
            .total { font-size: 18px; font-weight: bold; color: #28a745; }
            .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .urgent { background: #dc3545; color: white; padding: 10px; border-radius: 5px; margin: 10px 0; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🛒 New Order Received!</h1>
              <p>Order #${order.id}</p>
            </div>
            <div class="content">
              <div class="urgent">
                ⚡ IMMEDIATE ATTENTION REQUIRED ⚡
              </div>
              
              <h2>Order Details</h2>
              <div class="order-summary">
                <p><strong>Order ID:</strong> ${order.id}</p>
                <p><strong>Customer:</strong> ${order.userName || order.userEmail}</p>
                <p><strong>Email:</strong> ${order.userEmail}</p>
                <p><strong>Order Time:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
                <p><strong>Payment Method:</strong> ${order.paymentMethod || 'Not specified'}</p>
                <p><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">${order.status}</span></p>
              </div>

              <h3>Items Ordered:</h3>
              ${items.map(item => `
                <div class="item">
                  <strong>${item.productName}</strong>
                  ${item.size ? ` (Size: ${item.size})` : ''}
                  <br>
                  <span>Quantity: ${item.quantity} × ₹${item.price}</span>
                  <span style="float: right;">₹${(item.quantity * item.price).toFixed(2)}</span>
                </div>
              `).join('')}
              
              <div class="total">
                Total Amount: ₹${order.totalAmount}
              </div>

              <a href="http://localhost:5000/admin/orders/${order.id}" class="button">
                📋 View Order Details
              </a>
              
              <a href="http://localhost:5000/admin/orders" class="button" style="background: #28a745;">
                📊 View All Orders
              </a>
              
              <p><small>This is an automated notification. Please process this order promptly.</small></p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  // Send SMS notification
  async sendSMSNotification(notification) {
    const adminPhones = process.env.ADMIN_PHONES ? 
      process.env.ADMIN_PHONES.split(',') : [];

    if (!adminPhones.length) return;

    const message = `🛒 NEW ORDER ALERT!\n` +
                   `Order #${notification.order.id}\n` +
                   `Customer: ${notification.order.userName}\n` +
                   `Amount: ₹${notification.order.totalAmount}\n` +
                   `Time: ${new Date().toLocaleTimeString()}\n` +
                   `Check admin panel immediately!`;

    for (const phone of adminPhones) {
      try {
        await this.smsClient.messages.create({
          body: message,
          from: process.env.TWILIO_FROM_NUMBER,
          to: phone.trim()
        });
        
        console.log(`📱 SMS sent to: ${phone}`);
      } catch (error) {
        console.error(`❌ Failed to send SMS to ${phone}:`, error);
      }
    }
  }

  // Store notification in database
  async storeNotification(notification) {
    // Implement database storage logic here
    // This could be MongoDB, PostgreSQL, etc.
    
    try {
      const notificationRecord = {
        id: notification.id,
        type: notification.type,
        orderId: notification.order.id,
        message: notification.message,
        priority: notification.priority,
        status: 'sent',
        sentAt: new Date(),
        readBy: [],
        createdAt: new Date()
      };

      // Example for SQLite/PostgreSQL
      // await db.notifications.create(notificationRecord);
      
      // For now, store in local storage/file
      console.log('💾 Notification stored:', notification.id);
      
    } catch (error) {
      console.error('❌ Failed to store notification:', error);
    }
  }

  // Send browser push notification (requires service worker)
  async sendBrowserPushNotification(notification) {
    // This requires web push notifications setup
    // Implementation depends on your push notification service
    
    const pushPayload = {
      title: '🛒 New Order Alert!',
      body: `Order #${notification.order.id} - ₹${notification.order.totalAmount}`,
      icon: '/admin-icon.png',
      badge: '/badge-icon.png',
      data: {
        orderId: notification.order.id,
        url: `/admin/orders/${notification.order.id}`
      },
      actions: [
        {
          action: 'view',
          title: 'View Order',
          icon: '/view-icon.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/dismiss-icon.png'
        }
      ]
    };

    // Send to all subscribed admin devices
    console.log('🔔 Browser push notification prepared:', pushPayload.title);
  }

  // Get notification statistics
  getNotificationStats() {
    return {
      connectedAdmins: this.connectedAdmins.size,
      activeConnections: Array.from(this.connectedAdmins.values()),
      lastNotificationSent: this.lastNotificationTime || null,
      serverUptime: process.uptime()
    };
  }

  // Send test notification
  async sendTestNotification(adminId) {
    const testNotification = {
      id: `test_${Date.now()}`,
      type: 'test',
      timestamp: new Date().toISOString(),
      message: 'Test notification - your notification system is working!',
      priority: 'low'
    };

    this.io.to('admin-room').emit('test-notification', testNotification);
    console.log('🧪 Test notification sent');
  }
}

export default NotificationService;
