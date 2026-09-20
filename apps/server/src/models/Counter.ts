import mongoose, { Schema, Document } from 'mongoose';

export interface ICounter extends Document {
  _id: any; // e.g. "orderNumber"
  seq: number;
  updatedAt: Date;
}

const CounterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 1000 },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

export const Counter = mongoose.model<ICounter>('Counter', CounterSchema);
