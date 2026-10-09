import mongoose, { Schema, Document } from 'mongoose';
import { UserRole } from '../types';

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  passwordHash: string;
  role: UserRole;
  isVerified: boolean;
  isDeleted: boolean;
  // Admin suspension — distinct from deletion. Suspended users fail
  // authentication AND token verification (enforced in middleware).
  isSuspended: boolean;
  suspendedAt?: Date;
  suspendReason?: string;
  lastLoginAt?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    phone: { type: String, match: /^\+?[0-9\s\-()]{7,20}$/ },
    avatarUrl: { type: String, default: '' },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['customer', 'restaurant', 'admin'], required: true, default: 'customer' },
    isVerified: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    isSuspended: { type: Boolean, default: false, index: true },
    suspendedAt: { type: Date },
    suspendReason: { type: String, maxlength: 500 },
    lastLoginAt: { type: Date },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
    refreshToken: { type: String },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1, isDeleted: 1 });
UserSchema.index({ role: 1, isDeleted: 1 });
UserSchema.index({ createdAt: -1 });

export const User = mongoose.model<IUser>('User', UserSchema);