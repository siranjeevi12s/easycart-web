import mongoose, { Schema, Document } from 'mongoose';

export type PromoEventType = 'impression' | 'click';

export interface IPromoEvent extends Document {
  campaignId: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  type: PromoEventType;
  createdAt: Date;
}

const PromoEventSchema = new Schema<IPromoEvent>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'PromoCampaign', required: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    type: { type: String, enum: ['impression', 'click'], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PromoEventSchema.index({ campaignId: 1, type: 1, createdAt: -1 });
PromoEventSchema.index({ restaurantId: 1, createdAt: -1 });

export const PromoEvent = mongoose.model<IPromoEvent>('PromoEvent', PromoEventSchema);
