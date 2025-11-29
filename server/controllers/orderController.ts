import { Request, Response } from "express";
import Order from "../models/orderModel"; // Using Order model

class OrderController {
  /**
   * Create a new order
   */
  async createOrder(req: Request, res: Response) {
    try {
      const { userId, products, amount, phone } = req.body;

      if (!amount || !phone) {
        return res.status(400).json({ error: "Missing required fields: amount, phone" });
      }

      // Generate business-level orderId and unique merchantTransactionId
      const orderId = `ORDER_${Date.now()}`;
      const merchantTransactionId = `TXN_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      const newOrder = new Order({
        orderId,                      // 👈 business identifier
        userId,
        products: products || [],
        amount,
        phone,
        status: "PENDING",
        merchantTransactionId,        // 👈 for PhonePe
        createdAt: new Date(),
      });

      await newOrder.save();

      console.log(`✅ Order created with ID: ${newOrder._id}, Transaction ID: ${merchantTransactionId}`);

      return res.status(201).json(newOrder);
    } catch (error: any) {
      console.error("Error creating order:", error.message);
      return res.status(500).json({ error: "Failed to create order" });
    }
  }

  /**
   * Get all orders (admin use case)
   */
  async getAllOrders(req: Request, res: Response) {
    try {
      const orders = await Order.find();
      return res.status(200).json(orders);
    } catch (error: any) {
      console.error("Error fetching orders:", error.message);
      return res.status(500).json({ error: "Failed to fetch orders" });
    }
  }

  /**
   * Get a single order by ID
   */
  async getOrderById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const order = await Order.findById(id);

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      return res.status(200).json(order);
    } catch (error: any) {
      console.error("Error fetching order:", error.message);
      return res.status(500).json({ error: "Failed to fetch order" });
    }
  }

  /**
   * Update order status (used by paymentController)
   */
  async updateOrderStatus(orderId: string, status: string) {
    try {
      const order = await Order.findOneAndUpdate(
        { _id: orderId },
        { status },
        { new: true }
      );

      if (!order) {
        console.warn(`⚠️ Order not found for ID: ${orderId}`);
      } else {
        console.log(`✅ Order ${orderId} status updated to ${status}`);
      }

      return order;
    } catch (error: any) {
      console.error("Error updating order status:", error.message);
      throw new Error("Order status update failed");
    }
  }

  /**
   * Delete order (optional, admin use)
   */
  async deleteOrder(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const deletedOrder = await Order.findByIdAndDelete(id);

      if (!deletedOrder) {
        return res.status(404).json({ error: "Order not found" });
      }

      return res.status(200).json({ message: "Order deleted" });
    } catch (error: any) {
      console.error("Error deleting order:", error.message);
      return res.status(500).json({ error: "Failed to delete order" });
    }
  }
}

export default new OrderController();
