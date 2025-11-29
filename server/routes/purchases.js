import express from 'express';
import Purchase from '../models/Purchase.js';
import { protect } from '../middleware/auth.js';
import transporter from '../config/nodemailer.js';
import User from '../models/user.js';

const router = express.Router();

// Helper function to send user notification email
async function sendUserNotification(purchase, status) {
  try {
    // Check if email is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.warn('⚠️ Email not configured: SMTP_USER or SMTP_PASSWORD missing');
      return { success: false, error: 'Email not configured' };
    }

    // Verify transporter is ready
    try {
      await transporter.verify();
    } catch (verifyError) {
      console.error('❌ Email transporter verification failed:', verifyError);
      return { success: false, error: 'Email transporter not ready' };
    }

    // Get user details
    const user = await User.findById(purchase.userId);
    if (!user || !user.email) {
      console.log('⚠️ User not found or no email for purchase:', purchase._id);
      return { success: false, error: 'User not found or no email' };
    }

    const userEmail = user.email;
    const userName = user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}` 
      : user.email;

    let subject = '';
    let message = '';

    if (status === 'processing') {
      subject = `🛠️ We're preparing your order #${purchase._id}`;      message = `
        <h2>Your Order Is Being Prepared</h2>
        <p>Hello ${userName},</p>
        <p>Your order has moved into processing and our production team is getting it ready.</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Order ID:</strong> ${purchase._id}</p>
          <p><strong>Total Amount:</strong> ₹${purchase.totalAmount}</p>
        </div>
        <p>We'll notify you again as soon as it ships 🚚</p>
      `;
    } else if (status === 'shipped') {
      subject = `🚚 Your Order #${purchase._id} Has Been Shipped!`;
      message = `
        <h2>Great News! Your Order Has Been Shipped</h2>
        <p>Hello ${userName},</p>
        <p>We're excited to let you know that your order has been shipped and is on its way to you!</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Order ID:</strong> ${purchase._id}</p>
          <p><strong>Total Amount:</strong> ₹${purchase.totalAmount}</p>
          ${purchase.trackingNumber ? `<p><strong>Tracking Number:</strong> ${purchase.trackingNumber}</p>` : ''}
          ${purchase.estimatedDelivery ? `<p><strong>Estimated Delivery:</strong> ${new Date(purchase.estimatedDelivery).toLocaleDateString()}</p>` : ''}
        </div>
        <h3>Items in your order:</h3>
        <ul>
          ${(purchase.items || []).map(item => `
            <li>${item.productName} x${item.quantity}${item.size ? ` (Size: ${item.size})` : ''}</li>
          `).join('')}
        </ul>
        <p>You can track your order status anytime by visiting your account page.</p>
        <p>Thank you for shopping with us!</p>
      `;
    } else if (status === 'delivered') {
      subject = `✅ Your Order #${purchase._id} Has Been Delivered!`;
      message = `
        <h2>Your Order Has Been Delivered!</h2>
        <p>Hello ${userName},</p>
        <p>Great news! Your order has been successfully delivered.</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Order ID:</strong> ${purchase._id}</p>
          <p><strong>Total Amount:</strong> ₹${purchase.totalAmount}</p>
          <p><strong>Delivered On:</strong> ${purchase.deliveredAt ? new Date(purchase.deliveredAt).toLocaleDateString() : new Date().toLocaleDateString()}</p>
        </div>
        <h3>Items delivered:</h3>
        <ul>
          ${(purchase.items || []).map(item => `
            <li>${item.productName} x${item.quantity}${item.size ? ` (Size: ${item.size})` : ''}</li>
          `).join('')}
        </ul>
        <p>We hope you love your purchase! If you have any questions or concerns, please don't hesitate to contact us.</p>
        <p>Thank you for shopping with us!</p>
      `;
    } else if (status === 'completed') {
      subject = `🎉 Order #${purchase._id} Completed`;
      message = `
        <h2>Your Order Is Complete</h2>
        <p>Hello ${userName},</p>
        <p>We're happy to confirm that your order is now complete.</p>
        <p>If there's anything else we can help with, just reply to this email.</p>
        <p>Thank you for supporting us!</p>
      `;
    } else if (status === 'cancelled') {
      subject = `⚠️ Order #${purchase._id} Cancelled`;
      message = `
        <h2>Your Order Has Been Cancelled</h2>
        <p>Hello ${userName},</p>
        <p>This is to let you know that your order has been cancelled. ${
          purchase.refundStatus === 'initiated'
            ? 'A refund has been initiated and will reach you shortly.'
            : 'If you were charged, our team will reach out regarding your refund.'
        }</p>
        <p>If this was unexpected, please contact support right away.</p>
      `;
    } else if (status === 'refunded') {
      subject = `💸 Refund Initiated for Order #${purchase._id}`;
      message = `
        <h2>Your Refund Is On The Way</h2>
        <p>Hello ${userName},</p>
        <p>We've processed a refund for your order.</p>
        <ul>
          <li><strong>Refund Amount:</strong> ₹${purchase.refundAmount || purchase.totalAmount}</li>
          <li><strong>Status:</strong> ${purchase.refundStatus || 'initiated'}</li>
        </ul>
        <p>You should see the refund in your original payment method within a few business days.</p>
      `;
    }

    if (subject && message) {
      const fromEmail = process.env.SMTP_USER || "ratansrivastav179@gmail.com";

      // Send to customer
      const mailOptions = {
        from: fromEmail,
        to: userEmail,
        subject,
        html: message,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ User notification sent to ${userEmail} for order ${purchase._id} - Status: ${status}`);
      console.log(`📧 Email message ID: ${info.messageId}`);

      // Also notify admins, if configured
      const adminEmails = process.env.ADMIN_EMAILS
        ? process.env.ADMIN_EMAILS.split(',').map(email => email.trim()).filter(Boolean)
        : [];

      if (adminEmails.length) {
        const adminSubject = `📦 Order #${purchase._id} status updated to ${status.toUpperCase()}`;
        const adminMessage = `
          <h2>Order Status Update</h2>
          <p><strong>Order ID:</strong> ${purchase._id}</p>
          <p><strong>Customer:</strong> ${userName}</p>
          <p><strong>Status:</strong> ${status.toUpperCase()}</p>
          <p><strong>Total:</strong> ₹${purchase.totalAmount}</p>
          <p><strong>Updated At:</strong> ${new Date().toLocaleString()}</p>
          <h3>Items:</h3>
          <ul>
            ${(purchase.items || []).map(item => `
              <li>${item.productName} x${item.quantity}${item.size ? ` (Size: ${item.size})` : ''}</li>
            `).join('')}
          </ul>
        `;

        for (const adminEmail of adminEmails) {
          try {
            const adminInfo = await transporter.sendMail({
              from: fromEmail,
              to: adminEmail,
              subject: adminSubject,
              html: adminMessage,
            });
            console.log(`📧 Admin notification sent to ${adminEmail} (Message ID: ${adminInfo.messageId})`);
          } catch (adminError) {
            console.warn(`⚠️ Failed to send admin notification to ${adminEmail}:`, adminError.message);
          }
        }
      }

      return { success: true, messageId: info.messageId };
    }

    return { success: false, error: 'No subject or message generated' };
  } catch (error) {
    console.error('❌ Error sending user notification:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      response: error.response,
      responseCode: error.responseCode
    });
    return { success: false, error: error.message };
  }
}

// @desc    Create a new purchase
// @route   POST /api/purchases
// @access  Private
router.post('/', protect, async (req, res) => {

    try {
        const {
            items,
            totalAmount,
            paymentMethod,
            paymentId,
            shippingAddress,
            orderNotes,
            merchantOrderId
        } = req.body;

        console.log(items);
        

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Items are required'
            });
        }

        if (!totalAmount || totalAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid total amount is required'
            });
        }

        if (!paymentMethod) {
            return res.status(400).json({
                success: false,
                message: 'Payment method is required'
            });
        }

        // Create purchase object
        const purchaseData = {
            userId: req.user._id,
            items: items.map(item => ({
                productId: item.productId,
                productName: item.productName,
                price: item.price,
                quantity: item.quantity,
                size: item.size || null,
                color: item.color || null
            })),
            totalAmount,
            paymentMethod,
            paymentId: paymentId || null,
            paymentStatus: paymentMethod === 'cod' ? 'pending' : (paymentId ? 'success' : 'pending'),
            shippingAddress: shippingAddress || {},
            orderNotes: orderNotes || '',
            status: 'pending',
            merchantOrderId: merchantOrderId || null, // PhonePe merchant order ID
            phonepeTransactionId: merchantOrderId || null // Also store for lookup
        };

        const purchase = new Purchase(purchaseData);
        await purchase.save();
        
        console.log(`✅ Purchase created: ${purchase._id}, merchantOrderId: ${purchase.merchantOrderId}, phonepeTransactionId: ${purchase.phonepeTransactionId}`);

        // Populate user details for response
        await purchase.populate('userId', 'firstName lastName email');

        // Send email notification for COD orders immediately
        if (paymentMethod === 'cod') {
          console.log('📧 ==========================================');
          console.log('📧 COD order detected, checking email configuration...');
          console.log('📧 Payment Method:', paymentMethod);
          console.log('📧 SMTP_USER:', process.env.SMTP_USER ? `✅ Set (${process.env.SMTP_USER})` : '❌ Missing');
          console.log('📧 SMTP_PASSWORD:', process.env.SMTP_PASSWORD ? '✅ Set' : '❌ Missing');
          console.log('📧 FROM_CONTACT_EMAIL:', process.env.FROM_CONTACT_EMAIL || 'Not set (using default)');
          console.log('📧 ADMIN_EMAILS:', process.env.ADMIN_EMAILS || 'Not set (using default)');
          console.log('📧 ==========================================');
          
          if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
            console.warn('⚠️ Email not configured: SMTP_USER or SMTP_PASSWORD missing');
            console.warn('⚠️ Email will NOT be sent. Please configure SMTP credentials in .env file');
          } else {
            try {
              // Verify transporter first
              console.log('🔍 Verifying email transporter...');
              await transporter.verify();
              console.log('✅ Email transporter verified successfully');

              const user = await User.findById(purchase.userId);
              if (!user) {
                console.error('❌ User not found for purchase:', purchase.userId);
              } else if (!user.email) {
                console.error('❌ User has no email address:', purchase.userId);
              } else {
                // For Brevo, use a verified sender email as "from", not the SMTP login
                const fromEmail = process.env.FROM_CONTACT_EMAIL || "ratansrivastav179@gmail.com";
                const adminEmails = process.env.ADMIN_EMAILS
                  ? process.env.ADMIN_EMAILS.split(',').map(e => e.trim())
                  : ['ratansrivastav179@gmail.com'];

                const userName = user.firstName && user.lastName 
                  ? `${user.firstName} ${user.lastName}` 
                  : user.email;

                const orderDetails = `
                  <h2>Order Confirmation</h2>
                  <p>Thank you, ${userName}, for your purchase!</p>
                  <p><strong>Order ID:</strong> ${purchase._id}</p>
                  <p><strong>Total Amount:</strong> ₹${purchase.totalAmount}</p>
                  <p><strong>Payment Method:</strong> Cash on Delivery (COD)</p>
                  <h3>Items:</h3>
                  <ul>
                    ${(purchase.items || []).map(item => `
                      <li>
                        ${item.productName} (x${item.quantity})${item.size ? ` - Size: ${item.size}` : ''} - ₹${item.price}
                      </li>
                    `).join('')}
                  </ul>
                  <p><strong>Status:</strong> ${purchase.status}</p>
                  <p><strong>Order Date:</strong> ${new Date(purchase.createdAt).toLocaleString()}</p>
                  <p>You will pay cash when the order is delivered.</p>
                `;

                console.log(`📧 ==========================================`);
                console.log(`📧 Sending email to user: ${user.email}`);
                console.log(`📧 From email: ${fromEmail}`);
                // Send to user
                const userEmailResult = await transporter.sendMail({
                  from: fromEmail,
                  to: user.email,
                  subject: 'Your Order Confirmation - Cash on Delivery',
                  html: orderDetails,
                });
                console.log(`✅ User email sent successfully!`);
                console.log(`   Message ID: ${userEmailResult.messageId}`);
                console.log(`   Response: ${userEmailResult.response}`);

                console.log(`📧 Sending email to admin(s): ${adminEmails.join(', ')}`);
                console.log(`📧 Admin emails array:`, adminEmails);
                console.log(`📧 Admin emails count:`, adminEmails.length);
                
                // Send to admin(s) - send individually to catch any errors
                for (const adminEmail of adminEmails) {
                  try {
                    console.log(`📧 Attempting to send email to admin: ${adminEmail}`);
                    const adminEmailResult = await transporter.sendMail({
                      from: fromEmail,
                      to: adminEmail,
                      subject: `New COD Order Received: ${purchase._id}`,
                      html: `<h2>New COD Order from ${userName} (${user.email})</h2>` + orderDetails,
                    });
                    console.log(`✅ Admin email sent successfully to ${adminEmail}!`);
                    console.log(`   Message ID: ${adminEmailResult.messageId}`);
                    console.log(`   Response: ${adminEmailResult.response}`);
                  } catch (adminEmailError) {
                    console.error(`❌ Failed to send admin email to ${adminEmail}:`, adminEmailError);
                    console.error(`   Error message: ${adminEmailError.message}`);
                    console.error(`   Error code: ${adminEmailError.code}`);
                    // Continue with other admin emails even if one fails
                  }
                }
                
                console.log(`✅ All email notifications processed for COD order ${purchase._id}`);
                console.log(`📧 ==========================================`);
              }
            } catch (emailError) {
              console.error('❌ Error sending email notification for COD order:', emailError);
              console.error('Error details:', {
                message: emailError.message,
                code: emailError.code,
                response: emailError.response,
                responseCode: emailError.responseCode,
                command: emailError.command,
                stack: emailError.stack
              });
              // Don't fail the purchase creation if email fails
            }
          }
        }

        res.status(201).json({
            success: true,
            message: 'Purchase created successfully',
            data: purchase
        });

    } catch (error) {
        console.error('Purchase creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during purchase creation'
        });
    }
});

// @desc    Get all purchases for a user
// @route   GET /api/purchases
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const purchases = await Purchase.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .populate('userId', 'firstName lastName email');

        res.json({
            success: true,
            message: 'Purchases retrieved successfully',
            data: purchases,
            count: purchases.length
        });

    } catch (error) {
        console.error('Get purchases error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while retrieving purchases'
        });
    }
});

// @desc    Get a specific purchase
// @route   GET /api/purchases/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const purchase = await Purchase.findOne({
            _id: req.params.id,
            userId: req.user._id
        }).populate('userId', 'firstName lastName email');

        if (!purchase) {
            return res.status(404).json({
                success: false,
                message: 'Purchase not found'
            });
        }

        res.json({
            success: true,
            message: 'Purchase retrieved successfully',
            data: purchase
        });

    } catch (error) {
        console.error('Get purchase error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while retrieving purchase'
        });
    }
});

// @desc    Update purchase status (admin only)
// @route   PUT /api/purchases/:id/status
// @access  Private (Admin)
router.put('/:id/status', protect, async (req, res) => {
    try {
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        const purchase = await Purchase.findById(req.params.id);

        if (!purchase) {
            return res.status(404).json({
                success: false,
                message: 'Purchase not found'
            });
        }

        // Check if user is admin or the purchase owner
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            if (purchase.userId.toString() !== req.user._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to update this purchase'
                });
            }
        }

        const oldStatus = purchase.status;
        purchase.status = status;

        // Update delivery date if status is delivered
        if (status === 'delivered') {
            purchase.deliveredAt = new Date();
        }

        await purchase.save();

        // Send user notification if status changed and is one we notify about
        const notifiableStatuses = ['processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'];
        if (oldStatus !== status && notifiableStatuses.includes(status)) {
            // Send notification asynchronously (don't wait for it)
            sendUserNotification(purchase, status).then(result => {
                if (result.success) {
                    console.log(`✅ Email notification sent successfully for order ${purchase._id}`);
                } else {
                    console.warn(`⚠️ Email notification failed for order ${purchase._id}:`, result.error);
                }
            }).catch(err => {
                console.error('❌ Failed to send user notification:', err);
            });
        }

        res.json({
            success: true,
            message: 'Purchase status updated successfully',
            data: purchase
        });

    } catch (error) {
        console.error('Update purchase status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating purchase status'
        });
    }
});

// @desc    Test email notification
// @route   POST /api/purchases/test-email
// @access  Private (Admin)
router.post('/test-email', protect, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized - Admin only'
            });
        }

        const { email } = req.body;
        const testEmail = email || req.user.email;

        if (!testEmail) {
            return res.status(400).json({
                success: false,
                message: 'Email address is required'
            });
        }

        // Check if email is configured
        if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
            return res.status(500).json({
                success: false,
                message: 'Email not configured',
                error: 'SMTP_USER or SMTP_PASSWORD environment variables are missing'
            });
        }

        // Verify transporter
        try {
            await transporter.verify();
            console.log('✅ Email transporter verified successfully');
        } catch (verifyError) {
            return res.status(500).json({
                success: false,
                message: 'Email transporter verification failed',
                error: verifyError.message
            });
        }

        // Send test email
        const testMessage = {
            from: process.env.SMTP_USER,
            to: testEmail,
            subject: '🧪 Test Email - Order Notification System',
            html: `
                <h2>Email Notification Test</h2>
                <p>This is a test email to verify that the order notification system is working correctly.</p>
                <p><strong>Test Time:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>SMTP Server:</strong> smtp-relay.brevo.com</p>
                <p>If you received this email, your notification system is configured correctly! ✅</p>
            `
        };

        const info = await transporter.sendMail(testMessage);
        
        res.json({
            success: true,
            message: 'Test email sent successfully',
            data: {
                to: testEmail,
                messageId: info.messageId,
                response: info.response
            }
        });
    } catch (error) {
        console.error('Test email error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send test email',
            error: error.message,
            details: {
                code: error.code,
                response: error.response,
                responseCode: error.responseCode
            }
        });
    }
});

// @desc    Get all purchases (admin only)
// @route   GET /api/purchases/admin/all
// @access  Private (Admin)
router.get('/admin/all', protect, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view all purchases'
            });
        }

        const purchases = await Purchase.find()
            .sort({ createdAt: -1 })
            .populate('userId', 'firstName lastName email');

        res.json({
            success: true,
            message: 'All purchases retrieved successfully',
            data: purchases,
            count: purchases.length
        });

    } catch (error) {
        console.error('Get all purchases error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while retrieving all purchases'
        });
    }
});

// @desc    Test route to check authentication
// @route   GET /api/purchases/test
// @access  Private
router.get('/test', protect, async (req, res) => {
  res.json({
    success: true,
    message: 'Authentication working!',
    user: {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role
    }
  });
});

export default router; 