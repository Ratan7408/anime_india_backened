// server/orderController.js - Enhanced with notifications
const NotificationService = require('./notificationService');

class OrderController {
  constructor(notificationService) {
    this.notificationService = notificationService;
  }

  async createOrder(orderData) {
    try {
      // 1. Process the order
      const order = await this.processOrder(orderData);
      
      // 2. Send immediate notification to admins
      await this.notificationService.sendOrderNotification({
        id: order.id,
        userId: order.userId,
        userEmail: order.userEmail,
        userName: order.userName,
        items: order.items,
        totalAmount: order.totalAmount,
        status: 'completed',
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        shippingAddress: order.shippingAddress
      });

      // 3. Set up follow-up notifications
      this.scheduleFollowUpNotifications(order);

      return { success: true, order };
      
    } catch (error) {
      console.error('❌ Order creation failed:', error);
      
      // Send error notification to admins
      await this.notificationService.sendOrderNotification({
        id: `error_${Date.now()}`,
        type: 'order_error',
        message: `Order processing failed: ${error.message}`,
        error: error.message,
        originalData: orderData,
        priority: 'critical'
      });
      
      throw error;
    }
  }

  async processOrder(orderData) {
    // Your existing order processing logic
    const order = {
      id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...orderData,
      createdAt: new Date().toISOString(),
      status: 'completed'
    };

    // Save to database
    // await db.orders.create(order);
    
    return order;
  }

  scheduleFollowUpNotifications(order) {
    // Send reminders if order isn't processed within certain time
    setTimeout(async () => {
      await this.notificationService.sendOrderNotification({
        ...order,
        type: 'order_reminder',
        message: `⏰ Reminder: Order #${order.id} needs processing!`,
        priority: 'medium'
      });
    }, 30 * 60 * 1000); // 30 minutes

    // Send urgent reminder after 2 hours
    setTimeout(async () => {
      await this.notificationService.sendOrderNotification({
        ...order,
        type: 'order_urgent',
        message: `🚨 URGENT: Order #${order.id} still pending!`,
        priority: 'critical'
      });
    }, 2 * 60 * 60 * 1000); // 2 hours
  }
}