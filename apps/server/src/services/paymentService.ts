// Razorpay marketplace payment service (Route-based split + mock fallback).
//
// Money flow (₹500 example @ 5% fee):
//   customer pays ₹500 -> Razorpay -> restaurant ₹475 (Route transfer to linked
//   account) + platform keeps ₹25. Secret key NEVER leaves this service.
//
// When RAZORPAY_ROUTE_ENABLED=true and the restaurant has a
// razorpayLinkedAccountId, the Razorpay order is created with transfers[]
// so Razorpay auto-splits on capture. Otherwise a plain order is created
// and the settlement stays PENDING (platform settles later).
import crypto from 'crypto';
import { env } from '../config/env';
import { toPaise } from '../utils/commission';

// Lazy require so app still boots without razorpay configured
let Razorpay: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Razorpay = require('razorpay');
} catch {
  Razorpay = null;
}

export interface RouteTransfer {
  account: string;
  amount: number; // paise
  orderId?: string;
  restaurantId?: string;
}

export interface CreateOrderIntent {
  amount: number; // in paise
  currency?: string;
  receipt: string;
  restaurantId?: string;
  orderId?: string;
  // Marketplace split in paise
  restaurantAmountPaise?: number;
  linkedAccountId?: string;
  // Multi-seller: explicit per-restaurant transfers (Route). Remainder stays with platform.
  transfers?: RouteTransfer[];
}

export interface VerifyPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export function hasRealKeys(): boolean {
  const id = env.RAZORPAY_KEY_ID || '';
  const secret = env.RAZORPAY_KEY_SECRET || '';
  if (!id || !secret) return false;
  if (id.includes('dummy')) return false;
  // Real Razorpay keys always start with rzp_test_ or rzp_live_
  return id.startsWith('rzp_test_') || id.startsWith('rzp_live_');
}

function getClient() {
  if (!hasRealKeys() || !Razorpay) return null;
  return new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
}

export const paymentService = {
  isTestMode: !hasRealKeys(),

  mode(): 'live' | 'test' | 'mock' {
    if (!hasRealKeys()) return 'mock';
    return env.RAZORPAY_KEY_ID.startsWith('rzp_live_') ? 'live' : 'test';
  },

  routeEnabled(): boolean {
    return env.RAZORPAY_ROUTE_ENABLED && hasRealKeys();
  },

  /**
   * Create a Razorpay order. Attaches a Route transfer when possible.
   * Never throws for connectivity issues — falls back to mock so local dev works.
   * Returns `transferAttached` so callers know the settlement path.
   */
  async createOrderIntent({
    amount,
    currency = 'INR',
    receipt,
    restaurantId,
    orderId,
    restaurantAmountPaise,
    linkedAccountId,
    transfers: explicitTransfers,
  }: CreateOrderIntent) {
    const client = getClient();
    // Multi-seller transfers win when present; else single-restaurant transfer.
    const transfers = (explicitTransfers || [])
      .filter((t) => t.account && t.amount > 0)
      .map((t) => ({
        account: t.account,
        amount: t.amount,
        currency,
        notes: { orderId: t.orderId || orderId || '', restaurantId: t.restaurantId || restaurantId || '' },
      }));
    const single = !transfers.length && linkedAccountId && restaurantAmountPaise && restaurantAmountPaise > 0 && restaurantAmountPaise < amount
      ? [{
          account: linkedAccountId,
          amount: restaurantAmountPaise,
          currency,
          notes: { orderId: orderId || '', restaurantId: restaurantId || '' },
        }]
      : [];
    const all = [...transfers, ...single];
    const routedTotal = all.reduce((s, t) => s + t.amount, 0);
    // Route rejects transfers >= order amount (platform must retain >= 0; keep 0 allowed? require remainder);
    // drop the split if invalid rather than killing checkout.
    const canRoute = !!client && this.routeEnabled() && all.length > 0 && routedTotal < amount;

    if (client) {
      const payload: any = {
        amount,
        currency,
        receipt: String(receipt).slice(0, 40),
        payment_capture: true,
        notes: {
          restaurantId: restaurantId || '',
          orderId: orderId || '',
          platform: 'easycart',
        },
      };
      if (canRoute) {
        payload.transfers = all;
      }
      try {
        const order = await client.orders.create(payload);
        return {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          receipt: order.receipt,
          keyId: env.RAZORPAY_KEY_ID,
          mode: this.mode(),
          transferAttached: canRoute,
        };
      } catch (err: any) {
        // Route transfer validation (bad linked account) must not kill checkout:
        // retry once as a plain order so the customer can still pay.
        if (canRoute) {
          try {
            delete payload.transfers;
            const order = await client.orders.create(payload);
            console.error(
              '[paymentService] Route transfer rejected, created plain order:',
              err?.message || err
            );
            return {
              id: order.id,
              amount: order.amount,
              currency: order.currency,
              receipt: order.receipt,
              keyId: env.RAZORPAY_KEY_ID,
              mode: this.mode(),
              transferAttached: false,
              routeError: err?.message || 'transfer rejected',
            };
          } catch (err2: any) {
            console.error('[paymentService] Razorpay orders.create failed, using mock:', err2?.message || err2);
          }
        } else {
          console.error('[paymentService] Razorpay orders.create failed, using mock:', err?.message || err);
        }
      }
    }
    const mockOrderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      id: mockOrderId,
      amount,
      currency,
      receipt,
      keyId: env.RAZORPAY_KEY_ID,
      mode: 'mock' as const,
      transferAttached: false,
    };
  },

  /** HMAC-SHA256 checkout signature check (order_id|payment_id). */
  verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }: VerifyPayload): boolean {
    // Dev shortcut for mock mode only
    if (razorpay_signature === 'test_success' && !hasRealKeys()) return true;
    try {
      const expected = crypto
        .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');
      const a = Buffer.from(expected);
      const b = Buffer.from(razorpay_signature || '');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  },

  /** Verify Razorpay webhook signature against the RAW request body. */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const secret = env.RAZORPAY_WEBHOOK_SECRET || env.RAZORPAY_KEY_SECRET;
    if (!signature || !secret || secret.includes('dummy')) return false;
    try {
      const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      const a = Buffer.from(expected);
      const b = Buffer.from(signature || '');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  },

  /** Fetch a payment from Razorpay to confirm amount/status (tamper protection).
   *  Returns null when unreachable or in mock mode — callers skip the check then. */
  async fetchPayment(paymentId: string): Promise<any | null> {
    const client = getClient();
    if (!client || !paymentId) return null;
    try {
      return await client.payments.fetch(paymentId);
    } catch {
      // Mock ids (pay_<timestamp>) or network issues -> no authoritative record
      return null;
    }
  },

  /** Create a full/partial refund. Mock mode returns a fake refund id. */
  async createRefund(paymentId: string, amountPaise?: number, notes?: any): Promise<{ id: string; status: string }> {
    const client = getClient();
    if (client && paymentId && !paymentId.startsWith('pay_mock')) {
      try {
        const refund = await client.payments.refund(paymentId, {
          ...(amountPaise ? { amount: amountPaise } : {}),
          notes: { platform: 'easycart', ...(notes || {}) },
        });
        return { id: refund.id, status: refund.status || 'processed' };
      } catch (err: any) {
        console.error('[paymentService] refund failed:', err?.message || err);
        throw Object.assign(new Error(err?.message || 'Refund failed at gateway'), { status: 502 });
      }
    }
    // Mock refund for dev
    return { id: `rfnd_mock_${Date.now()}`, status: 'processed' };
  },

  /**
   * Direct Route transfer (used to settle a queued order once a linked
   * account is added, or to retry a failed transfer).
   * Razorpay Route: transfers.create({ account, amount, currency }).
   */
  async createTransfer(linkedAccountId: string, amountPaise: number, notes?: any): Promise<{ id: string }> {
    const client = getClient();
    if (!client) throw Object.assign(new Error('Razorpay not configured'), { status: 503 });
    try {
      const t = await client.transfers.create({
        account: linkedAccountId,
        amount: amountPaise,
        currency: 'INR',
        notes: { platform: 'easycart', ...(notes || {}) },
      });
      return { id: t.id };
    } catch (err: any) {
      console.error('[paymentService] transfer failed:', err?.message || err);
      throw Object.assign(new Error(err?.message || 'Transfer failed at gateway'), { status: 502 });
    }
  },

  /**
   * Create a Razorpay Route linked account (test mode accepts test KYC).
   * Returns the acc_xxx id to store on the restaurant.
   */
  async createLinkedAccount(details: {
    email: string;
    phone: string;
    legalBusinessName: string;
    customerFacingName?: string;
    businessType?: string;
    contactName?: string;
    pan?: string;
    accountNumber?: string;
    ifsc?: string;
  }): Promise<any> {
    if (!hasRealKeys()) throw Object.assign(new Error('Razorpay not configured'), { status: 503 });
    const body: any = {
      email: details.email,
      phone: details.phone,
      type: 'route',
      legal_business_name: details.legalBusinessName,
      customer_facing_business_name: details.customerFacingName || details.legalBusinessName,
      business_type: details.businessType || 'individual',
      contact_name: details.contactName || details.legalBusinessName,
      profile: {
        category: 'food',
        subcategory: 'restaurant',
        addresses: {
          registered: {
            street1: 'Test Street',
            street2: 'Pune',
            city: 'Pune',
            state: 'Maharashtra',
            postal_code: '411001',
            country: 'IN',
          },
        },
      },
      legal_info: { ...(details.pan ? { pan: details.pan } : {}) },
      tnc_accepted: true,
    };
    if (details.accountNumber && details.ifsc) {
      body.account_detail = { account_number: details.accountNumber, ifsc: details.ifsc };
    }
    try {
      // Prefer raw REST for full error visibility (SDK swallows details)
      const res = await fetch('https://api.razorpay.com/v1/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64'),
        },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (json as any)?.error?.description || (json as any)?.message || `Razorpay ${res.status}`;
        throw Object.assign(new Error(`Razorpay linked account: ${msg}`), { status: 502 });
      }
      return json;
    } catch (e: any) {
      if (e.status) throw e;
      throw Object.assign(new Error(`Razorpay linked account failed: ${e.message}`), { status: 502 });
    }
  },
};

export { toPaise };
