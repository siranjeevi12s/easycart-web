// Isolated payment service — Razorpay Test Mode
// Swap provider by implementing same interface
import crypto from 'crypto';
import { env } from '../config/env';

export interface CreateOrderIntent {
  amount: number; // in paise
  currency?: string;
  receipt: string;
}

export interface VerifyPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export const paymentService = {
  async createOrderIntent({ amount, currency = 'INR', receipt }: CreateOrderIntent) {
    // In real Razorpay: new Razorpay({...}).orders.create({amount, currency, receipt})
    // For MVP: return mock order id, keep isolated
    const mockOrderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      id: mockOrderId,
      amount,
      currency,
      receipt,
      keyId: env.RAZORPAY_KEY_ID,
    };
  },

  verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }: VerifyPayload): boolean {
    // If using real Razorpay secret, verify HMAC
    // For test mode with dummy secret, accept signature === 'test_success' or valid HMAC
    if (razorpay_signature === 'test_success') return true;
    try {
      const expected = crypto
        .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');
      return expected === razorpay_signature;
    } catch {
      return false;
    }
  },

  // Idempotency: payment verification should be safe to retry
  isTestMode: true,
};
