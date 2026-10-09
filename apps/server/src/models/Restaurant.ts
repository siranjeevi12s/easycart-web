import mongoose, { Schema, Document } from 'mongoose';

export interface IRestaurant extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  address: string;
  phone?: string;
  image?: string;
  isOpen: boolean;
  isActive: boolean;
  isDeleted: boolean;
  rating?: number;
  ratingCount?: number;
  // ---- Payout / settlement details (real-world workflow) ----
  // Money from Razorpay goes to platform account, then settled to these details.
  // payoutMode UPI = instant settlement via UPI, BANK = NEFT/IMPS to bank account.
  payoutMode?: 'UPI' | 'BANK';
  payoutUpiId?: string;
  payoutAccountHolder?: string;
  payoutAccountNumber?: string;
  payoutIfsc?: string;
  payoutBankName?: string;
  payoutEnabled: boolean;
  payoutVerified: boolean;
  payoutUpdatedAt?: Date;
  // ---- Razorpay Route marketplace ----
  // Linked account (e.g. acc_xxxxx) created via Razorpay Route after KYC.
  // When present + RAZORPAY_ROUTE_ENABLED=true, Razorpay auto-splits the
  // restaurant share on capture. When absent, settlements queue as PENDING.
  razorpayLinkedAccountId?: string;
  routeOnboarded: boolean;
  // ---- Admin approval workflow ----
  // New restaurants start 'pending' and are invisible publicly until approved.
  // Suspended/rejected restaurants stop operating (enforced in list + orders).
  approvalStatus: 'pending' | 'under_review' | 'approved' | 'rejected' | 'suspended';
  approvalNote?: string;
  approvedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RestaurantSchema = new Schema<IRestaurant>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    address: { type: String, required: true, trim: true, maxlength: 500 },
    phone: { type: String, match: /^\+?[0-9\s\-()]{7,20}$/ },
    image: { type: String, default: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400' },
    isOpen: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    rating: { type: Number, default: 4.5, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    // Payout details — required before restaurant can receive order amounts
    payoutMode: { type: String, enum: ['UPI', 'BANK'], default: 'UPI' },
    payoutUpiId: { type: String, trim: true, maxlength: 100 },
    payoutAccountHolder: { type: String, trim: true, maxlength: 200 },
    payoutAccountNumber: { type: String, trim: true, maxlength: 30 },
    payoutIfsc: { type: String, trim: true, uppercase: true, maxlength: 11 },
    payoutBankName: { type: String, trim: true, maxlength: 200 },
    payoutEnabled: { type: Boolean, default: false },
    payoutVerified: { type: Boolean, default: false },
    payoutUpdatedAt: { type: Date },
    razorpayLinkedAccountId: { type: String, trim: true, maxlength: 50 },
    routeOnboarded: { type: Boolean, default: false },
    approvalStatus: { type: String, enum: ['pending', 'under_review', 'approved', 'rejected', 'suspended'], default: 'pending', index: true },
    approvalNote: { type: String, maxlength: 500 },
    approvedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

RestaurantSchema.index({ name: 'text', address: 'text' });
RestaurantSchema.index({ ownerId: 1, isDeleted: 1 });
RestaurantSchema.index({ isActive: 1, isOpen: 1 });
RestaurantSchema.index({ createdAt: -1 });

export const Restaurant = mongoose.model<IRestaurant>('Restaurant', RestaurantSchema);