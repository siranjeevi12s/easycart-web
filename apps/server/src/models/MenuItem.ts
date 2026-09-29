import mongoose, { Schema, Document } from 'mongoose';

export interface IMenuItem extends Document {
  restaurantId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  price: number;
  image?: string;
  category: string;
  isAvailable: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MenuItemSchema = new Schema<IMenuItem>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    price: { type: Number, required: true, min: 0, max: 100000 },
    image: { type: String, default: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400' },
    category: { type: String, default: 'Main', index: true, maxlength: 50 },
    isAvailable: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

MenuItemSchema.index({ restaurantId: 1, category: 1 });
MenuItemSchema.index({ restaurantId: 1, isAvailable: 1 });
MenuItemSchema.index({ restaurantId: 1, isDeleted: 1 });
MenuItemSchema.index({ name: 1, restaurantId: 1 });

export const MenuItem = mongoose.model<IMenuItem>('MenuItem', MenuItemSchema);