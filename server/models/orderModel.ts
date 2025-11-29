import mongoose, { Schema, Document } from "mongoose";

export interface IOrder extends Document {
  orderId: string;
  userId?: string;
  products?: { productId: string; quantity: number }[];
  amount: number; // store in paise (e.g. ₹100 = 10000)
  phone: string; // customer phone number
  status: "PENDING" | "PAID" | "FAILED";
  merchantTransactionId: string; // unique transaction ID for PhonePe
  createdAt: Date;
}

const OrderSchema: Schema = new Schema<IOrder>(
  {
    orderId: { type: String, unique: true }, // ❌ required hata do
    userId: { type: String, required: false },
    products: [
      {
        productId: { type: String, required: true },
        quantity: { type: Number, required: true },
      },
    ],
    // Make products optional; default empty array for flows without products
    // Mongoose doesn't allow default on array with schema path directly above,
    // so ensure controller passes [] when not provided if needed.
    amount: { type: Number, required: true },
    phone: { type: String, required: true },
    status: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED"],
      default: "PENDING",
    },
    merchantTransactionId: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const Order = mongoose.model<IOrder>("Order", OrderSchema);

export default Order;
