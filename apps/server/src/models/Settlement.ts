import mongoose, { Schema, Document } from 'mongoose';

/**
 * Settlement ledger — tracks the restaurant's share of each PAID order.
 *
 * Lifecycle:
 *  - PENDING    — no Razorpay linked account on file; platform owes the restaurant
 *                 (settled later via Route transfer, payout, or manual NEFT).
 *  - PROCESSING — Razorpay Route transfer attached (auto-split on capture).
 *  - SETTLED    — transfer.processed webhook received (or manual confirmation).
 *  - FAILED     — transfer failed; needs retry / ops attention.
 *  - REVERSED   — order refunded; restaurant share clawed back / withheld.
 */
export type SettlementStatus = 'PENDING' | 'PROCESSING' | 'SETTLED' | 'FAILED' | 'REVERSED';

export interface ISettlement extends Document {
  orderId: mongoose.Types.ObjectId;
  paymentId?: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  // Money in RUPEES
  totalAmount: number;
  platformFee: number;
  restaurantAmount: number;
  // Razorpay Route transfer (when linked account exists)
  transferId?: string;
  linkedAccountId?: string;
  status: SettlementStatus;
  settledAt?: Date;
  settlementRef?: string;
  failureReason?: string;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const SettlementSchema = new Schema<ISettlement>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true, index: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    totalAmount: { type: Number, required: true, min: 0 },
    platformFee: { type: Number, required: true, min: 0 },
    restaurantAmount: { type: Number, required: true, min: 0 },
    transferId: { type: String },
    linkedAccountId: { type: String },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'SETTLED', 'FAILED', 'REVERSED'],
      default: 'PENDING',
      index: true,
    },
    settledAt: { type: Date },
    settlementRef: { type: String, maxlength: 200 },
    failureReason: { type: String, maxlength: 1000 },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

SettlementSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });

export const Settlement = mongoose.model<ISettlement>('Settlement', SettlementSchema);
