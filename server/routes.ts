import { Router } from "express";
import { createOrder, getOrderStatus, initiateRefund, phonepeWebhook } from "./controllers/paymentController";
import orderController from "./controllers/orderController";
import { storage } from "./storage";

const router = Router();

// Orders
router.post("/orders", (req, res) => orderController.createOrder(req, res));
router.get("/orders", (req, res) => orderController.getAllOrders(req, res));
router.get("/orders/:id", (req, res) => orderController.getOrderById(req, res));
router.delete("/orders/:id", (req, res) => orderController.deleteOrder(req, res));

// Payments - New SDK endpoints
router.post("/payment/order", createOrder);
router.get("/payment/order/:merchantOrderId/status", getOrderStatus);
router.post("/payment/refund", initiateRefund);
router.post("/payment/webhook", phonepeWebhook);

// Backward compatibility aliases for existing frontend
router.post("/payment/initiate", createOrder); // 👈 alias for old frontend
router.post("/payments/order", createOrder);
router.get("/payments/order/:merchantOrderId/status", getOrderStatus);
router.post("/payments/refund", initiateRefund);
router.post("/payments/webhook", phonepeWebhook);

// Products
router.get("/products", async (req, res) => {
  try {
    const { category, featured, inStock } = req.query as Record<string, string | undefined>;
    const filters: { category?: string; featured?: boolean; inStock?: boolean } = {};
    if (category) filters.category = String(category);
    if (featured !== undefined) filters.featured = featured === "true" ? true : featured === "false" ? false : undefined;
    if (inStock !== undefined) filters.inStock = inStock === "true" ? true : inStock === "false" ? false : undefined;

    const products = await storage.getProducts(filters);
    return res.json({ success: true, data: products });
  } catch (err: any) {
    console.error("/api/products error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to fetch products" });
  }
});

router.get("/products/categories", async (_req, res) => {
  try {
    const categories = await storage.getCategories();
    return res.json({ success: true, data: categories });
  } catch (err: any) {
    console.error("/api/products/categories error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to fetch categories" });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const product = await storage.getProduct(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });
    return res.json({ success: true, data: product });
  } catch (err: any) {
    console.error("/api/products/:id error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to fetch product" });
  }
});

// ✅ NEW: POST /api/products - Create new product
router.post("/products", async (req, res) => {
  try {
    console.log('📦 Creating new product:', req.body);
    const product = await storage.createProduct(req.body);
    return res.status(201).json({ success: true, data: product });
  } catch (err: any) {
    console.error("/api/products POST error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to create product" });
  }
});

// ✅ NEW: PUT /api/products/:id - Update existing product
router.put("/products/:id", async (req, res) => {
  try {
    console.log('📦 Updating product:', req.params.id, req.body);
    const product = await storage.updateProduct(req.params.id, req.body);
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });
    return res.json({ success: true, data: product });
  } catch (err: any) {
    console.error("/api/products/:id PUT error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to update product" });
  }
});

// ✅ NEW: DELETE /api/products/:id - Delete product
router.delete("/products/:id", async (req, res) => {
  try {
    console.log('📦 Deleting product:', req.params.id);
    const success = await storage.deleteProduct(req.params.id);
    if (!success) return res.status(404).json({ success: false, error: "Product not found" });
    return res.json({ success: true, message: "Product deleted successfully" });
  } catch (err: any) {
    console.error("/api/products/:id DELETE error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to delete product" });
  }
});

// ✅ NEW: POST /api/products/bulk-out-of-stock - Bulk mark products as out of stock
console.log('🔗 Registering bulk out-of-stock endpoint...');
router.post("/products/bulk-out-of-stock", async (req, res) => {
  try {
    const { color, size, category, subcategory } = req.body;
    console.log('📦 Bulk out-of-stock request:', { color, size, category, subcategory });
    
    if (!color && !size) {
      return res.status(400).json({ 
        success: false, 
        error: "At least one of color or size must be specified" 
      });
    }

    const result = await storage.bulkUpdateProductStatus({
      color,
      size,
      category,
      subcategory,
      status: 'out-of-stock',
      inStock: false
    });

    return res.json({ 
      success: true, 
      message: `Successfully marked ${result.updatedCount} products as out of stock`,
      data: result
    });
  } catch (err: any) {
    console.error("/api/products/bulk-out-of-stock error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to update products" });
  }
});

// ✅ NEW: POST /api/products/bulk-restore - Bulk restore product sizes (mark as in-stock)
console.log('🔗 Registering bulk restore endpoint...');
router.post("/products/bulk-restore", async (req, res) => {
  try {
    const { color, size, category, subcategory } = req.body;
    console.log('📦 Bulk restore request:', { color, size, category, subcategory });
    
    if (!color && !size) {
      return res.status(400).json({ 
        success: false, 
        error: "At least one of color or size must be specified" 
      });
    }

    const result = await storage.bulkRestoreProductSizes({
      color,
      size,
      category,
      subcategory
    });

    return res.json({ 
      success: true, 
      message: `Successfully restored ${result.updatedCount} product sizes`,
      data: result
    });
  } catch (err: any) {
    console.error("/api/products/bulk-restore error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to restore products" });
  }
});

export default router;