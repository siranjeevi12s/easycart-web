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
  rating?: number;
  createdAt: Date;
  updatedAt: Date;
}

const RestaurantSchema = new Schema<IRestaurant>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    address: { type: String, required: true },
    phone: { type: String },
    image: { type: String, default: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400' },
    isOpen: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    rating: { type: Number, default: 4.5 },
  },
  { timestamps: true }
);

RestaurantSchema.index({ name: 'text', address: 'text' });

export const Restaurant = mongoose.model<IRestaurant>('Restaurant', RestaurantSchema);
