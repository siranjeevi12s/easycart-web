import mongoose, { Schema, Document } from 'mongoose';
import { UserRole } from '../types';

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String },
    avatarUrl: { type: String, default: '' },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['customer', 'restaurant', 'admin'], required: true, default: 'customer' },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
