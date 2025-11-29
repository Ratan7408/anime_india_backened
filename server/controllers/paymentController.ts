import { randomUUID } from "crypto";
import { CreateSdkOrderRequest, RefundRequest } from "pg-sdk-node";
import phonepeClient from "../services/phonepeService";

export const createOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({ error: "Amount is required" });
    }

    const merchantOrderId = randomUUID(); // tumhara internal orderId bhi save karo DB me

    const request = CreateSdkOrderRequest.StandardCheckoutBuilder()
      .merchantOrderId(merchantOrderId)
      .amount(amount) // paise me bhejna hai
      .redirectUrl(undefined)
      .build();

    const response = await phonepeClient.createSdkOrder(request);

    // ✅ response me token milega jo frontend ko dena hai
    res.json({
      success: true,
      merchantOrderId,
      phonepeOrderId: response.orderId,
      token: response.token,
      state: response.state,
      expireAt: response.expireAt,
    });
  } catch (err: any) {
    console.error("❌ Error creating SDK order:", err.message);
    res.status(500).json({ error: "Failed to create order" });
  }
};

export const getOrderStatus = async (req, res) => {
  try {
    const { merchantOrderId } = req.params;
    if (!merchantOrderId) {
      return res.status(400).json({ error: "merchantOrderId is required" });
    }

    const response = await phonepeClient.getOrderStatus(merchantOrderId);

    res.json(response);
  } catch (err: any) {
    console.error("❌ Error checking order status:", err.message);
    res.status(500).json({ error: "Failed to fetch order status" });
  }
};

export const initiateRefund = async (req, res) => {
  try {
    const { merchantOrderId, amount } = req.body;
    const refundId = randomUUID();

    const request = RefundRequest.builder()
      .amount(amount)
      .merchantRefundId(refundId)
      .originalMerchantOrderId(merchantOrderId)
      .build();

    const response = await phonepeClient.refund(request);

    res.json(response);
  } catch (err: any) {
    console.error("❌ Error initiating refund:", err.message);
    res.status(500).json({ error: "Refund initiation failed" });
  }
};

export const phonepeWebhook = async (req, res) => {
  try {
    const authHeader = req.headers["authorization"] as string;
    const bodyString = JSON.stringify(req.body);

    const callbackResponse = phonepeClient.validateCallback(
      process.env.PHONEPE_WEBHOOK_USERNAME!,
      process.env.PHONEPE_WEBHOOK_PASSWORD!,
      authHeader,
      bodyString
    );

    console.log("✅ Webhook received:", callbackResponse);

    // payload.state = COMPLETED | FAILED | PENDING
    // payload.orderId = phonepeOrderId
    // payload.originalMerchantOrderId = tumhara merchantOrderId

    res.status(200).send("OK");
  } catch (err: any) {
    console.error("❌ Invalid webhook:", err.message);
    res.status(400).send("Invalid webhook");
  }
};
