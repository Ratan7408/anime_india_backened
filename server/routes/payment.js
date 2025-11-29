import express from 'express';
import { phonepeClient } from '../config/phonepe.js';
import { CreateSdkOrderRequest } from 'pg-sdk-node';

const router = express.Router();

// POST /api/payment/initiate - Legacy endpoint for backward compatibility
router.post('/initiate', async (req, res) => {
  try {
    const { amount, merchantTransactionId, userId } = req.body;

    // Strict validation
    if (amount === undefined || amount === null || isNaN(Number(amount))) {
      return res.status(400).json({ success: false, message: 'Invalid or missing amount' });
    }
    if (!merchantTransactionId || typeof merchantTransactionId !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid or missing merchantTransactionId' });
    }

    // Set up redirect URL - PhonePe will redirect here after payment
    const backendUrl = process.env.BACKEND_URL || process.env.API_BASE_URL || 'http://localhost:5000';
    const redirectUrl = `${backendUrl}/api/payment/callback?merchantTransactionId=${encodeURIComponent(merchantTransactionId)}`;
    
    console.log('🔗 Setting redirectUrl for PhonePe (where to redirect after payment):', redirectUrl);

    // Use createSdkOrder which returns a token that we can use to construct the payment page URL
    // This is more reliable than pay() method which might not return payment page URL correctly
    const orderRequest = CreateSdkOrderRequest.StandardCheckoutBuilder()
      .merchantOrderId(merchantTransactionId)
      .amount(Math.round(Number(amount) * 100)) // Amount in paise
      .redirectUrl(redirectUrl) // PhonePe will redirect here AFTER payment completes
      .build();

    const response = await phonepeClient.createSdkOrder(orderRequest);
    
    console.log('📦 PhonePe SDK createSdkOrder() response:', JSON.stringify(response, null, 2));

    // createSdkOrder returns a token that we use to construct the payment page URL
    if (!response.token) {
      console.error('❌ PhonePe did not return a token in response');
      console.error('📋 Full response:', JSON.stringify(response, null, 2));
      return res.status(500).json({
        success: false,
        message: 'PhonePe did not return a payment token. Please try again.',
        error: 'Missing token in response'
      });
    }

    // Construct PhonePe payment page URL from token
    const env = process.env.PHONEPE_ENVIRONMENT === 'PROD' ? 'mercury' : 'mercury-uat';
    const version = process.env.PHONEPE_ENVIRONMENT === 'PROD' ? 'v3' : 'uat_v3';
    const paymentPageUrl = `https://${env}.phonepe.com/transact/${version}?token=${encodeURIComponent(response.token)}`;
    
    console.log('✅ Constructed PhonePe payment page URL:', paymentPageUrl);

    // Return the payment page URL (this is what user should be redirected TO)
    return res.json({
      success: true,
      orderId: response.orderId,
      state: response.state,
      expireAt: response.expireAt,
      token: response.token, // Also return token for debugging
      redirectUrl: paymentPageUrl, // PhonePe payment page URL (where user should go first)
    });
  } catch (err) {
    console.error('❌ PhonePe initiate error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Payment initiation failed',
      error: err.message,
    });
  }
});

// GET /api/payment/status/:txnId - Legacy endpoint for backward compatibility
router.get('/status/:txnId', async (req, res) => {
  try {
    const { txnId } = req.params;
    const response = await phonepeClient.getOrderStatus(txnId);
    return res.json(response);
  } catch (err) {
    console.error('❌ PhonePe status error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Status check failed',
      error: err.message,
    });
  }
});

// POST /api/payment/webhook - Legacy endpoint for backward compatibility
router.post('/webhook', async (req, res) => {
  try {
    console.log('📬 PhonePe Webhook:', req.body);
    res.status(200).send('OK');
  } catch (err) {
    console.error('❌ Webhook error:', err.message);
    res.status(500).send('ERROR');
  }
});

export default router;
