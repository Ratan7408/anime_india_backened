import { Router } from "express";
import { createOrder, getOrderStatus, initiateRefund, phonepeWebhook } from "../controllers/paymentController";

const router = Router();

router.post("/order", createOrder);
router.get("/order/:merchantOrderId/status", getOrderStatus);
router.post("/refund", initiateRefund);
router.post("/webhook", phonepeWebhook);

export default router;
