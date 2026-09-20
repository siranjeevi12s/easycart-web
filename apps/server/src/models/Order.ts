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
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  paymentId?: string;
  razorpayOrderId?: string;
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
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    items: { type: [OrderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'], default: 'PENDING' },
    orderStatus: {
      type: String,
      enum: ['PENDING_PAYMENT', 'PAID', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'CANCELLED'],
      default: 'PENDING_PAYMENT',
    },
    paymentId: { type: String },
    razorpayOrderId: { type: String },
    acceptedAt: { type: Date },
    preparingAt: { type: Date },
    readyAt: { type: Date },
    pickedUpAt: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

OrderSchema.index({ customerId: 1, createdAt: -1 });
OrderSchema.index({ restaurantId: 1, createdAt: -1 });

export const Order = mongoose.model<IOrder>('Order', OrderSchema);
