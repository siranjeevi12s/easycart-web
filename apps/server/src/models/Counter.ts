import mongoose, { Schema, Document } from 'mongoose';

interface ICounterDoc {
  _id: string;
  seq: number;
  createdAt: Date;
  updatedAt: Date;
}

const CounterSchema = new Schema<ICounterDoc>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 1000, min: 1000 },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: true }, strict: true }
);

export const Counter = mongoose.model<ICounterDoc>('Counter', CounterSchema);