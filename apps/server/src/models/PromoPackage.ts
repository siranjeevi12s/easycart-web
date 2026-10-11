import mongoose, { Schema, Document } from 'mongoose';

export interface IPromoPackage extends Document {
  name: string;
  description?: string;
  /** Campaign length in days once approved. */
  durationDays: number;
  /** Price in rupees (charged via Razorpay, converted to paise). */
  price: number;
  /** Ranking weight for the sponsored carousel (higher shows first). */
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PromoPackageSchema = new Schema<IPromoPackage>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, maxlength: 500 },
    durationDays: { type: Number, required: true, min: 1, max: 365 },
    price: { type: Number, required: true, min: 0, max: 1000000 },
    priority: { type: Number, default: 1, min: 0, max: 1000 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

PromoPackageSchema.index({ isActive: 1 });

export const PromoPackage = mongoose.model<IPromoPackage>('PromoPackage', PromoPackageSchema);
