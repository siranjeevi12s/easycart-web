import mongoose, { Schema, Document } from 'mongoose';

export type PromoCampaignStatus =
  | 'payment_pending'
  | 'awaiting_approval'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'expired'
  | 'cancelled'
  | 'rejected'
  | 'refunded';

export interface IPromoCampaign extends Document {
  restaurantId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  packageId: mongoose.Types.ObjectId;
  /** Price/priority snapshot — later package edits never rewrite history. */
  snapshot: { name: string; durationDays: number; price: number; priority: number };
  /** Owner-written offer line shown on the sponsored card (e.g. "Free delivery weekend"). */
  offerText?: string;
  status: PromoCampaignStatus;
  payment: {
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    amountPaise?: number;
    mode?: string;
  };
  approval: { status: 'pending' | 'approved' | 'rejected'; by?: mongoose.Types.ObjectId; at?: Date; note?: string };
  schedule: { startDate?: Date; endDate?: Date };
  metrics: { impressions: number; clicks: number };
  refund?: { refundId?: string; status?: string; at?: Date; reason?: string };
  createdAt: Date;
  updatedAt: Date;
}

const PromoCampaignSchema = new Schema<IPromoCampaign>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    packageId: { type: Schema.Types.ObjectId, ref: 'PromoPackage', required: true },
    snapshot: {
      name: { type: String, required: true },
      durationDays: { type: Number, required: true },
      price: { type: Number, required: true },
      priority: { type: Number, required: true },
    },
    offerText: { type: String, trim: true, maxlength: 120 },
    status: {
      type: String,
      enum: ['payment_pending', 'awaiting_approval', 'scheduled', 'active', 'paused', 'expired', 'cancelled', 'rejected', 'refunded'],
      default: 'payment_pending',
      index: true,
    },
    payment: {
      razorpayOrderId: { type: String },
      razorpayPaymentId: { type: String },
      razorpaySignature: { type: String },
      amountPaise: { type: Number },
      mode: { type: String },
    },
    approval: {
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      by: { type: Schema.Types.ObjectId, ref: 'User' },
      at: { type: Date },
      note: { type: String, maxlength: 500 },
    },
    schedule: { startDate: { type: Date }, endDate: { type: Date } },
    metrics: { impressions: { type: Number, default: 0 }, clicks: { type: Number, default: 0 } },
    refund: { refundId: { type: String }, status: { type: String }, at: { type: Date }, reason: { type: String, maxlength: 500 } },
  },
  { timestamps: true }
);

// Idempotency: the same gateway payment can never confirm two campaigns.
PromoCampaignSchema.index({ 'payment.razorpayPaymentId': 1 }, { unique: true, sparse: true });
PromoCampaignSchema.index({ restaurantId: 1, status: 1 });
PromoCampaignSchema.index({ status: 1, 'schedule.endDate': 1 });

export const PromoCampaign = mongoose.model<IPromoCampaign>('PromoCampaign', PromoCampaignSchema);
