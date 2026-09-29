import mongoose, { Schema, Document } from 'mongoose';
import { OrderStatus, PaymentStatus } from '../types';

export interface IOrderItem {
  menuItemId: mongoose.Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface IOrder extends Document {
  orderNumber: string;
  customerId: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  items: IOrderItem[];
  subtotal: number;
  tax: number;
  totalAmount: number;
  // Marketplace split (₹) — computed on backend at order creation
  platformFee: number;
  restaurantAmount: number;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  paymentMethod: string;
  paymentId?: string;
  razorpayOrderId?: string;
  // Failure / refund audit
  failureReason?: string;
  refundId?: string;
  refundStatus?: string;
  refundedAt?: Date;
  // Settlement to restaurant (real-world payout workflow)
  payoutStatus: 'PENDING' | 'SETTLED';
  settledAt?: Date;
  settlementRef?: string;
  cancellationReason?: string;
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt?: Date;
  preparingAt?: Date;
  readyAt?: Date;
  pickedUpAt?: Date;
  cancelledAt?: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    menuItemId: { type: Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    name: { type: String, required: true, maxlength: 200 },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, max: 99 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    items: { type: [OrderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    // Marketplace split — defaults keep old documents valid
    platformFee: { type: Number, default: 0, min: 0 },
    restaurantAmount: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'], default: 'PENDING', index: true },
    orderStatus: {
      type: String,
      enum: ['PENDING_PAYMENT', 'PAID', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'CANCELLED'],
      default: 'PENDING_PAYMENT',
      index: true,
    },
    paymentMethod: { type: String, default: 'RAZORPAY', enum: ['RAZORPAY', 'COD', 'WALLET'] },
    paymentId: { type: String },
    razorpayOrderId: { type: String },
    failureReason: { type: String, maxlength: 1000 },
    refundId: { type: String },
    refundStatus: { type: String },
    refundedAt: { type: Date },
    // Payout tracking: every PAID order starts PENDING, restaurant/admin marks SETTLED after bank/UPI transfer
    payoutStatus: { type: String, enum: ['PENDING', 'SETTLED'], default: 'PENDING', index: true },
    settledAt: { type: Date },
    settlementRef: { type: String, maxlength: 200 },
    cancellationReason: { type: String, maxlength: 500 },
    notes: { type: String, maxlength: 1000 },
  },
  { timestamps: true }
);

OrderSchema.index({ customerId: 1, createdAt: -1 });
OrderSchema.index({ restaurantId: 1, createdAt: -1 });
OrderSchema.index({ orderStatus: 1, createdAt: -1 });
OrderSchema.index({ paymentStatus: 1, orderStatus: 1 });
OrderSchema.index({ customerId: 1, orderStatus: 1 });

export const Order = mongoose.model<IOrder>('Order', OrderSchema);