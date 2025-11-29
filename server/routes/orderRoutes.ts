import { Router } from "express";
import orderController from "../controllers/orderController";

const router = Router();

/**
 * 🛒 Order Routes
 */
router.post("/", (req, res) => orderController.createOrder(req, res));
router.get("/", (req, res) => orderController.getAllOrders(req, res));
router.get("/:id", (req, res) => orderController.getOrderById(req, res));
router.delete("/:id", (req, res) => orderController.deleteOrder(req, res));

export default router;
