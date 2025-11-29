import express from "express";
import Purchase from "../models/Purchase.js";
import { phonepeClient } from "../config/phonepe.js";

const router = express.Router();

/**
 * PhonePe redirects here after payment
 * GET /api/payment/callback
 */
router.get("/callback", async (req, res) => {
  try {
    const { transactionId, merchantTransactionId } = req.query;
    console.log("📬 PhonePe Callback received:", { transactionId, merchantTransactionId });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (!merchantTransactionId) {
      console.error("❌ No merchantTransactionId in callback");
      return res.redirect(`${frontendUrl}/user-orders?error=invalid_transaction`);
    }

    // 1. Verify Payment Status
    let statusResponse;
    try {
      statusResponse = await phonepeClient.getOrderStatus(merchantTransactionId);
      console.log("📌 Payment Status Response:", JSON.stringify(statusResponse, null, 2));
    } catch (statusError) {
      console.error("❌ Error getting payment status:", statusError);
      return res.redirect(`${frontendUrl}/user-orders?error=status_check_failed&txnId=${encodeURIComponent(merchantTransactionId)}`);
    }

    // Handle different response formats from PhonePe SDK
    const responseData = statusResponse?.data || statusResponse || {};
    const paymentDetails = responseData.paymentDetails || [];
    const paymentDetailState = paymentDetails[0]?.state || '';
    const state = paymentDetailState || responseData.state || responseData.orderStatus || responseData.status || 'PENDING';
    console.log("📊 Payment Status:", state);

    // If payment is still PENDING and this callback is hit immediately (within a few seconds),
    // it might be a premature redirect. Check if payment was actually attempted.
    const paymentTimestamp = paymentDetails[0]?.timestamp || responseData.timestamp;
    const now = Date.now();
    const timeSinceInit = paymentTimestamp ? now - paymentTimestamp : 0;
    
    // If PENDING and callback hit within 5 seconds, likely premature redirect - redirect back to PhonePe payment page
    if (state === 'PENDING' && timeSinceInit < 5000) {
      console.log("⏳ Payment still pending, callback hit too early. This might be a premature redirect.");
      // Don't redirect back to PhonePe - instead redirect to payment result page which will poll for status
      return res.redirect(`${frontendUrl}/payment-result?txnId=${encodeURIComponent(merchantTransactionId)}&status=pending`);
    }

    // 2. Find the purchase linked with merchantTransactionId
    console.log(`🔍 Searching for purchase with merchantTransactionId: ${merchantTransactionId}`);
    
    let purchase = await Purchase.findOne({
      $or: [
        { merchantOrderId: merchantTransactionId },
        { phonepeTransactionId: merchantTransactionId },
        { paymentId: merchantTransactionId }
      ]
    });

    // If not found, try without $or (sometimes MongoDB query needs exact match)
    if (!purchase) {
      console.log(`🔍 Trying alternative search methods...`);
      purchase = await Purchase.findOne({ merchantOrderId: merchantTransactionId });
    }
    
    if (!purchase) {
      purchase = await Purchase.findOne({ phonepeTransactionId: merchantTransactionId });
    }
    
    // Debug: List recent purchases to see what's in the DB
    if (!purchase) {
      const recentPurchases = await Purchase.find({}).sort({ createdAt: -1 }).limit(5).select('merchantOrderId phonepeTransactionId paymentId createdAt');
      console.log(`📋 Recent purchases in DB:`, JSON.stringify(recentPurchases, null, 2));
    }

    if (!purchase) {
      console.warn(`⚠️ Purchase not found for merchantTransactionId: ${merchantTransactionId}`);
      // Still redirect to frontend with transaction ID so user can see status
      const isSuccess = state === "COMPLETED" || state === "PAYMENT_SUCCESS" || state === "SUCCESS";
      return res.redirect(`${frontendUrl}/payment-result?txnId=${encodeURIComponent(merchantTransactionId)}&success=${isSuccess}`);
    }
    
    console.log(`✅ Purchase found: ${purchase._id}`);

    // 3. Update order based on status
    if (state === "COMPLETED" || state === "PAYMENT_SUCCESS" || state === "SUCCESS" || state === "PAID") {
      purchase.paymentStatus = "success";
      purchase.status = "processing";
      purchase.paidAt = new Date();
      purchase.paymentMethod = "phonepe";
      if (transactionId) {
        purchase.phonepeTransactionId = transactionId;
        purchase.paymentId = transactionId;
      }
      console.log("✅ Payment successful - updating purchase:", purchase._id);
    } else if (state === "FAILED" || state === "PAYMENT_ERROR" || state === "CANCELLED" || state === "CANCELLED_BY_USER") {
      purchase.paymentStatus = "failed";
      purchase.status = "failed";
      purchase.paymentFailureReason = state;
      console.log("❌ Payment failed - updating purchase:", purchase._id);
    } else {
      // PENDING or other status
      purchase.paymentStatus = "pending";
      purchase.status = "pending";
      console.log("⏳ Payment pending - updating purchase:", purchase._id);
    }

    await purchase.save();
    console.log("💾 Purchase updated:", purchase._id, "Status:", purchase.paymentStatus);

    // 4. Redirect user to frontend payment result page
    const isSuccess = state === "COMPLETED" || state === "PAYMENT_SUCCESS" || state === "SUCCESS" || state === "PAID";
    
    // Redirect to payment result page which will show success message and redirect to orders
    return res.redirect(`${frontendUrl}/payment-result?txnId=${encodeURIComponent(merchantTransactionId)}&success=${isSuccess}&purchaseId=${purchase._id}`);
    
  } catch (err) {
    console.error("❌ PhonePe Callback Error:", err);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/user-orders?success=false&error=callback_failed`);
  }
});

export default router;

