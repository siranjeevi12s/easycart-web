import mongoose, { Schema, Document } from 'mongoose';

export interface IMenuItem extends Document {
  restaurantId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  price: number;
  image?: string;
  category?: string;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MenuItemSchema = new Schema<IMenuItem>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, default: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400' },
    category: { type: String, default: 'Main' },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const MenuItem = mongoose.model<IMenuItem>('MenuItem', MenuItemSchema);
