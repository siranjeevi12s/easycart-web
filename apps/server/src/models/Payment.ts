import mongoose, { Schema, Document } from 'mongoose';

/**
 * Payment ledger — one document per Razorpay order intent + status history.
 * Guarantees:
 *  - Duplicate protection: unique razorpayOrderId; unique sparse razorpayPaymentId.
 *  - Full audit: every attempt (created/failed/cancelled/refunded) is recorded.
 *  - Money fields stored in RUPEES to match Order; paise only at Razorpay boundary.
 */
export type PaymentRecordStatus =
  | 'CREATED'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface IPayment extends Document {
  orderId: mongoose.Types.ObjectId;
  // Multi-seller batch: every sibling order covered by this one gateway payment
  orderIds: mongoose.Types.ObjectId[];
  batchId?: string;
  restaurantId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  amount: number; // ₹ total charged
  currency: string;
  platformFee: number; // ₹ EasyCart commission
  restaurantAmount: number; // ₹ restaurant share
  status: PaymentRecordStatus;
  mode: 'mock' | 'test' | 'live';
  failureReason?: string;
  refundId?: string;
  refundStatus?: string;
  rawPayload?: any;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderIds: { type: [Schema.Types.ObjectId], ref: 'Order', default: [] },
    batchId: { type: String, index: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    razorpayOrderId: { type: String, sparse: true, unique: true, index: true },
    razorpayPaymentId: { type: String, sparse: true, unique: true },
    razorpaySignature: { type: String },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    platformFee: { type: Number, required: true, min: 0 },
    restaurantAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['CREATED', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'],
      default: 'CREATED',
      index: true,
    },
    mode: { type: String, enum: ['mock', 'test', 'live'], default: 'mock' },
    failureReason: { type: String, maxlength: 1000 },
    refundId: { type: String },
    refundStatus: { type: String },
    rawPayload: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

PaymentSchema.index({ orderId: 1, status: 1 });

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
