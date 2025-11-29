import mongoose from 'mongoose';

const purchaseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  items: [{
    productId: {
      type: String,
      required: true,
    },
    productName: String,
    price: Number,
    quantity: Number,
    size: String,
    color: String,
  }],
  totalAmount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'completed', 'failed'],
    default: 'pending',
  },
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'stripe', 'paypal', 'cod', 'phonepe'],
    required: true,
  },
  paymentId: String, // Transaction ID from payment gateway
  paymentStatus: {
    type: String,
    enum: ['pending', 'success', 'failed', 'cancelled'],
    default: 'pending',
  },
  phonepeTransactionId: String, // PhonePe specific transaction ID
  merchantOrderId: String, // Merchant order ID for PhonePe
  paymentFailureReason: String,
  paidAt: Date,
  refundStatus: {
    type: String,
    enum: ['none', 'initiated', 'completed', 'failed'],
    default: 'none',
  },
  refundAmount: Number,
  refundReason: String,
  refundedAt: Date,
  shippingAddress: {
    name: String,
    email: String,
    phone: String,
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
    landmark: String,
  },
  orderNotes: String,
  trackingNumber: String,
  estimatedDelivery: Date,
  deliveredAt: Date,
}, {
  timestamps: true,
});

// Add indexes for better query performance
purchaseSchema.index({ userId: 1, createdAt: -1 });
purchaseSchema.index({ status: 1 });
purchaseSchema.index({ paymentId: 1 });

export default mongoose.model('Purchase', purchaseSchema);
