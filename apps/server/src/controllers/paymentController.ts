import { Response } from 'express';
import { AuthRequest } from '../types';
import { env } from '../config/env';
import { paymentService } from '../services/paymentService';
import { Order } from '../models/Order';
import { Payment } from '../models/Payment';
import { Settlement } from '../models/Settlement';
import { Restaurant } from '../models/Restaurant';
import { User } from '../models/User';
import { getIO } from '../sockets';
import { canTransition } from '../types';
import { computeSplit, toPaise } from '../utils/commission';
import { renderCheckoutPage } from '../utils/checkoutPage';

// ---------- helpers ----------

/** Backfill split on pre-commission orders so old documents stay valid. */
async function ensureOrderSplit(order: any) {
  if (!order.platformFee && !order.restaurantAmount && order.totalAmount) {
    const s = computeSplit(order.totalAmount);
    order.platformFee = s.platformFee;
    order.restaurantAmount = s.restaurantAmount;
    await order.save();
  }
  return order;
}

function emitPaid(order: any) {
  try {
    const io = getIO();
    io.to(`restaurant:${order.restaurantId.toString()}`).emit('order:new', order);
    io.to(`customer:${order.customerId.toString()}`).emit('order:paid', order);
  } catch {}
}

/**
 * Shared PAID transition — first-write-wins, never downgrades.
 * Creates/updates the Payment ledger + Settlement row exactly once.
 */
async function markOrderPaid(order: any, opts: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string;
  mode: string;
  transferAttached: boolean;
  source: 'verify' | 'webhook';
  rawPayload?: any;
}) {
  if (order.paymentStatus === 'PAID') {
    return { order, duplicate: true };
  }
  await ensureOrderSplit(order);
  if (!canTransition(order.orderStatus as any, 'PAID')) {
    throw Object.assign(new Error(`Invalid order state for payment (${order.orderStatus})`), { status: 400 });
  }

  order.paymentStatus = 'PAID';
  order.orderStatus = 'PAID';
  order.paymentId = opts.razorpayPaymentId;
  order.razorpayOrderId = opts.razorpayOrderId;
  order.failureReason = undefined;
  order.payoutStatus = 'PENDING'; // legacy mirror of Settlement.status
  await order.save();

  // Payment ledger upsert (idempotent on razorpay order id)
  let payment = await Payment.findOne({ razorpayOrderId: opts.razorpayOrderId });
  if (!payment) {
    payment = new Payment({
      orderId: order._id,
      restaurantId: order.restaurantId,
      customerId: order.customerId,
      razorpayOrderId: opts.razorpayOrderId,
      amount: order.totalAmount,
      platformFee: order.platformFee,
      restaurantAmount: order.restaurantAmount,
    });
  }
  // Duplicate payment-id protection: unique index raises 11000 on races
  try {
    payment.razorpayPaymentId = opts.razorpayPaymentId;
    payment.razorpaySignature = opts.razorpaySignature;
    payment.status = 'PAID';
    payment.mode = (opts.mode as any) || payment.mode;
    payment.rawPayload = opts.rawPayload || payment.rawPayload;
    await payment.save();
  } catch (e: any) {
    if (e.code === 11000) {
      // Same payment already recorded (verify + webhook race) — safe to ignore
      payment = await Payment.findOne({ razorpayPaymentId: opts.razorpayPaymentId });
    } else throw e;
  }

  // Settlement row — exactly one per order
  const restaurant = await Restaurant.findById(order.restaurantId);
  const linkedId = restaurant?.razorpayLinkedAccountId;
  let settlement = await Settlement.findOne({ orderId: order._id });
  if (!settlement) {
    settlement = await Settlement.create({
      orderId: order._id,
      paymentId: payment?._id,
      restaurantId: order.restaurantId,
      razorpayOrderId: opts.razorpayOrderId,
      razorpayPaymentId: opts.razorpayPaymentId,
      totalAmount: order.totalAmount,
      platformFee: order.platformFee,
      restaurantAmount: order.restaurantAmount,
      linkedAccountId: linkedId || undefined,
      // Route auto-splits on capture when transfer was attached; else platform owes restaurant
      status: opts.transferAttached && linkedId ? 'PROCESSING' : 'PENDING',
      transferId: undefined,
    });
  }

  emitPaid(order);
  return { order, payment, settlement, duplicate: false };
}

async function markOrderFailed(order: any, reason: string, rawPayload?: any) {
  // Never overwrite a PAID order (webhook/verify race safety)
  if (order.paymentStatus === 'PAID') return { order, duplicate: true };
  order.paymentStatus = 'FAILED';
  order.failureReason = String(reason).slice(0, 1000);
  await order.save();
  if (order.razorpayOrderId) {
    await Payment.findOneAndUpdate(
      { razorpayOrderId: order.razorpayOrderId },
      { $set: { status: 'FAILED', failureReason: order.failureReason, rawPayload } }
    );
  }
  try {
    const io = getIO();
    io.to(`customer:${order.customerId.toString()}`).emit('order:payment_failed', order);
  } catch {}
  return { order, duplicate: false };
}

// ---------- endpoints ----------

export const createPaymentIntent = async (req: AuthRequest, res: Response) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ message: 'orderId required' });
  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.customerId.toString() !== req.user!.id) return res.status(403).json({ message: 'Forbidden' });
  if (order.paymentStatus === 'PAID') return res.json({ message: 'Already paid', order });
  if (!canTransition(order.orderStatus as any, 'PAID'))
    return res.status(400).json({ message: `Cannot pay order in ${order.orderStatus} state` });

  await ensureOrderSplit(order);

  const restaurant = await Restaurant.findById(order.restaurantId);
  if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
  if (!restaurant.payoutEnabled)
    return res.status(400).json({
      message: 'This restaurant has not configured payouts yet — payment temporarily unavailable. Please try another restaurant.',
      code: 'PAYOUT_NOT_CONFIGURED',
    });

  // Idempotency: reuse the open intent instead of minting a new Razorpay order per tap
  if (order.razorpayOrderId) {
    const existing = await Payment.findOne({ razorpayOrderId: order.razorpayOrderId });
    if (existing && existing.status === 'CREATED') {
      return res.json({
        razorpayOrderId: existing.razorpayOrderId,
        amount: toPaise(order.totalAmount),
        currency: existing.currency,
        keyId: env.RAZORPAY_KEY_ID,
        mode: existing.mode,
        reused: true,
        split: { total: order.totalAmount, platformFee: order.platformFee, restaurantAmount: order.restaurantAmount },
        checkoutPath: `/api/payments/checkout/${existing.razorpayOrderId}`,
        payee: {
          restaurantName: restaurant.name,
          payoutMode: restaurant.payoutMode,
          upiId: restaurant.payoutMode === 'UPI' ? restaurant.payoutUpiId : undefined,
        },
        order,
      });
    }
  }

  const amountPaise = toPaise(order.totalAmount);
  const intent = await paymentService.createOrderIntent({
    amount: amountPaise,
    receipt: order.orderNumber,
    restaurantId: order.restaurantId.toString(),
    orderId: order._id.toString(),
    restaurantAmountPaise: toPaise(order.restaurantAmount),
    linkedAccountId: restaurant.razorpayLinkedAccountId || undefined,
  });

  order.razorpayOrderId = intent.id;
  await order.save();

  await Payment.findOneAndUpdate(
    { razorpayOrderId: intent.id },
    {
      $setOnInsert: {
        orderId: order._id,
        restaurantId: order.restaurantId,
        customerId: order.customerId,
        razorpayOrderId: intent.id,
        amount: order.totalAmount,
        currency: intent.currency,
        platformFee: order.platformFee,
        restaurantAmount: order.restaurantAmount,
        status: 'CREATED',
        mode: (intent as any).mode || paymentService.mode(),
      },
    },
    { upsert: true, new: true }
  );

  res.json({
    razorpayOrderId: intent.id,
    amount: intent.amount,
    currency: intent.currency,
    keyId: intent.keyId,
    mode: (intent as any).mode || paymentService.mode(),
    transferAttached: (intent as any).transferAttached || false,
    split: { total: order.totalAmount, platformFee: order.platformFee, restaurantAmount: order.restaurantAmount },
    checkoutPath: `/api/payments/checkout/${intent.id}`,
    payee: {
      restaurantName: restaurant.name,
      payoutMode: restaurant.payoutMode,
      upiId: restaurant.payoutMode === 'UPI' ? restaurant.payoutUpiId : undefined,
    },
    order,
  });
};

/** Public hosted-checkout page (only the PUBLIC key_id is embedded — never the secret). */
export const checkoutPage = async (req: any, res: Response) => {
  const rzpOrderId = req.params.rzpOrderId as string;
  const payment = await Payment.findOne({ razorpayOrderId: rzpOrderId });
  if (!payment) return res.status(404).send('Payment intent not found or expired.');
  if (payment.status === 'PAID') return res.send('<h3>Already paid ✅ — you can return to EasyCart.</h3>');
  const order = await Order.findById(payment.orderId);
  if (!order) return res.status(404).send('Order not found.');
  const restaurant = await Restaurant.findById(order.restaurantId);
  const customer = await User.findById(order.customerId).select('name email phone');
  const html = renderCheckoutPage({
    keyId: env.RAZORPAY_KEY_ID,
    razorpayOrderId: payment.razorpayOrderId,
    amountPaise: toPaise(order.totalAmount),
    currency: payment.currency || 'INR',
    restaurantName: restaurant?.name || 'Restaurant',
    orderNumber: order.orderNumber,
    customerName: customer?.name,
    customerEmail: customer?.email,
    customerPhone: customer?.phone,
    appOrderId: order._id.toString(),
  });
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
};

export const verifyPayment = async (req: AuthRequest, res: Response) => {
  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
    return res.status(400).json({ message: 'Missing payment fields' });

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.customerId.toString() !== req.user!.id && req.user!.role !== 'admin')
    return res.status(403).json({ message: 'Forbidden' });
  if (order.paymentStatus === 'PAID') return res.json({ message: 'Already verified', order }); // idempotent

  // Duplicate payment-id replay protection
  const dup = await Payment.findOne({ razorpayPaymentId: razorpay_payment_id });
  if (dup && dup.status === 'PAID') {
    if (dup.orderId.toString() !== order._id.toString())
      return res.status(409).json({ message: 'This payment was already used for another order' });
    return res.json({ message: 'Already verified (duplicate callback)', order: await Order.findById(orderId) });
  }

  const valid = paymentService.verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
  if (!valid) {
    await markOrderFailed(order, 'Signature verification failed', req.body);
    return res.status(400).json({ message: 'Payment verification failed' });
  }

  // Tamper protection: confirm with Razorpay that this payment captured the right amount
  const fetched = await paymentService.fetchPayment(razorpay_payment_id);
  if (fetched) {
    const expectedPaise = toPaise(order.totalAmount);
    if (fetched.amount !== expectedPaise) {
      await markOrderFailed(order, `Amount mismatch: gateway ${fetched.amount} paise vs order ${expectedPaise} paise`, fetched);
      return res.status(400).json({ message: 'Payment amount mismatch — flagged for review, contact support' });
    }
    if (!['captured', 'authorized'].includes(fetched.status)) {
      await markOrderFailed(order, `Gateway status not capturable: ${fetched.status}`, fetched);
      return res.status(400).json({ message: `Payment not completed at gateway (${fetched.status})` });
    }
  }

  const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
  let transferAttached = false;
  if (payment) {
    const st = await Settlement.findOne({ orderId: order._id });
    transferAttached = st?.status === 'PROCESSING' || !!payment.rawPayload?.transferAttached;
  } else {
    const restaurant = await Restaurant.findById(order.restaurantId);
    transferAttached = !!(restaurant?.razorpayLinkedAccountId && paymentService.routeEnabled());
  }

  try {
    const result = await markOrderPaid(order, {
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      mode: payment?.mode || paymentService.mode(),
      transferAttached,
      source: 'verify',
      rawPayload: req.body,
    });
    if (payment) {
      payment.rawPayload = { ...(payment.rawPayload || {}), transferAttached };
      await payment.save().catch(() => {});
    }
    res.json({ message: result.duplicate ? 'Already verified' : 'Payment verified', order: result.order });
  } catch (e: any) {
    res.status(e.status || 400).json({ message: e.message || 'Verification failed' });
  }
};

/** Customer reports checkout failure/dismissal — records FAILED without touching PAID. */
export const reportFailure = async (req: AuthRequest, res: Response) => {
  const { orderId, reason } = req.body;
  if (!orderId) return res.status(400).json({ message: 'orderId required' });
  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.customerId.toString() !== req.user!.id) return res.status(403).json({ message: 'Forbidden' });
  const result = await markOrderFailed(order, reason || 'Customer-reported checkout failure', req.body);
  res.json({ message: result.duplicate ? 'Order already paid' : 'Failure recorded', order: result.order });
};

/** Cancel an unpaid order — releases it with CANCELLED (no refund needed, nothing captured). */
export const cancelUnpaid = async (req: AuthRequest, res: Response) => {
  const { orderId, reason } = req.body;
  if (!orderId) return res.status(400).json({ message: 'orderId required' });
  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.customerId.toString() !== req.user!.id && req.user!.role !== 'admin')
    return res.status(403).json({ message: 'Forbidden' });
  if (order.paymentStatus === 'PAID')
    return res.status(400).json({ message: 'Order already paid — request a refund instead', code: 'ALREADY_PAID' });
  if (!canTransition(order.orderStatus as any, 'CANCELLED'))
    return res.status(400).json({ message: `Cannot cancel order in ${order.orderStatus} state` });
  order.paymentStatus = 'CANCELLED';
  order.orderStatus = 'CANCELLED';
  order.cancellationReason = String(reason || 'Cancelled before payment').slice(0, 500);
  order.cancelledAt = new Date();
  await order.save();
  if (order.razorpayOrderId) {
    await Payment.findOneAndUpdate(
      { razorpayOrderId: order.razorpayOrderId },
      { $set: { status: 'CANCELLED' } }
    );
  }
  res.json({ message: 'Order cancelled', order });
};

/** Pollable status — amount split + settlement included for the app receipt screen. */
export const paymentStatus = async (req: AuthRequest, res: Response) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.customerId.toString() !== req.user!.id && req.user!.role === 'customer')
    return res.status(403).json({ message: 'Forbidden' });
  if (req.user!.role === 'restaurant') {
    const rest = await Restaurant.findById(order.restaurantId);
    if (!rest || rest.ownerId.toString() !== req.user!.id) return res.status(403).json({ message: 'Forbidden' });
  }
  const settlement = await Settlement.findOne({ orderId: order._id });
  res.json({
    orderId: order._id,
    orderNumber: order.orderNumber,
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    total: order.totalAmount,
    platformFee: order.platformFee,
    restaurantAmount: order.restaurantAmount,
    razorpayOrderId: order.razorpayOrderId,
    paymentId: order.paymentId,
    refundId: order.refundId,
    refundStatus: order.refundStatus,
    settlement: settlement
      ? { status: settlement.status, transferId: settlement.transferId, settledAt: settlement.settledAt }
      : null,
  });
};

/** Refund a PAID order — restaurant owner (own orders) or admin. */
export const refundPayment = async (req: AuthRequest, res: Response) => {
  const { orderId, amount, reason } = req.body;
  if (!orderId) return res.status(400).json({ message: 'orderId required' });
  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.paymentStatus !== 'PAID') return res.status(400).json({ message: `Only PAID orders can be refunded (now ${order.paymentStatus})` });
  if (req.user!.role === 'restaurant') {
    const rest = await Restaurant.findById(order.restaurantId);
    if (!rest || rest.ownerId.toString() !== req.user!.id) return res.status(403).json({ message: 'Forbidden: not your order' });
  } else if (req.user!.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (!order.paymentId) return res.status(400).json({ message: 'No gateway payment to refund' });

  const refundPaise = amount ? toPaise(Number(amount)) : undefined;
  if (refundPaise && (refundPaise <= 0 || refundPaise > toPaise(order.totalAmount)))
    return res.status(400).json({ message: 'Invalid refund amount' });

  const { id: refundId, status: refundStatus } = await paymentService.createRefund(
    order.paymentId,
    refundPaise,
    { orderId: order._id.toString(), reason: reason || 'restaurant refund' }
  );

  order.paymentStatus = 'REFUNDED';
  order.refundId = refundId;
  order.refundStatus = refundStatus;
  order.refundedAt = new Date();
  // Move order out of the kitchen queue when the state machine allows it
  if (canTransition(order.orderStatus as any, 'CANCELLED')) {
    order.orderStatus = 'CANCELLED';
    order.cancelledAt = new Date();
    order.cancellationReason = String(reason || 'Refunded').slice(0, 500);
  }
  await order.save();

  await Payment.findOneAndUpdate(
    { razorpayOrderId: order.razorpayOrderId },
    { $set: { status: 'REFUNDED', refundId, refundStatus } }
  );
  await Settlement.findOneAndUpdate(
    { orderId: order._id },
    { $set: { status: 'REVERSED', settlementRef: refundId } }
  );

  try {
    const io = getIO();
    io.to(`customer:${order.customerId.toString()}`).emit('order:refunded', order);
    io.to(`restaurant:${order.restaurantId.toString()}`).emit('order:refunded', order);
  } catch {}

  res.json({ message: 'Refund initiated', refundId, refundStatus, order });
};

export const webhook = async (req: any, res: Response) => {
  // Razorpay signs the RAW body. app.ts mounts express.raw() for this route,
  // so req.body is a Buffer here; fall back to JSON for safety.
  const raw: string = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
  let body: any;
  try {
    body = Buffer.isBuffer(req.body) ? JSON.parse(raw) : req.body;
  } catch {
    return res.status(400).json({ message: 'Invalid JSON' });
  }

  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'] as string;
  const isDummy = !secret || secret.includes('dummy');
  if (!isDummy) {
    if (!signature || !paymentService.verifyWebhookSignature(raw, signature)) {
      console.warn('[webhook] invalid signature — rejected');
      return res.status(400).json({ message: 'Invalid webhook signature' });
    }
  } else {
    console.warn('[webhook] no RAZORPAY_WEBHOOK_SECRET configured — accepting unverified (dev only)');
  }

  try {
    const event: string = body?.event;
    const paymentEntity = body?.payload?.payment?.entity;
    const refundEntity = body?.payload?.refund?.entity;
    const transferEntity = body?.payload?.transfer?.entity;

    if (event === 'payment.captured' || event === 'order.paid') {
      const rzpOrderId = paymentEntity?.order_id;
      const rzpPaymentId = paymentEntity?.id;
      if (rzpOrderId && rzpPaymentId) {
        const order = await Order.findOne({ razorpayOrderId: rzpOrderId });
        if (order && order.paymentStatus !== 'PAID') {
          // Amount cross-check before trusting the webhook
          const expected = toPaise(order.totalAmount);
          if (paymentEntity.amount && paymentEntity.amount !== expected) {
            await markOrderFailed(order, `Webhook amount mismatch: ${paymentEntity.amount} vs ${expected}`, body);
          } else {
            await markOrderPaid(order, {
              razorpayOrderId: rzpOrderId,
              razorpayPaymentId: rzpPaymentId,
              mode: paymentService.mode(),
              transferAttached: Array.isArray((paymentEntity as any)?.transfers) && (paymentEntity as any).transfers.length > 0,
              source: 'webhook',
              rawPayload: body,
            });
          }
        }
      }
    } else if (event === 'payment.failed') {
      const rzpOrderId = paymentEntity?.order_id;
      if (rzpOrderId) {
        const order = await Order.findOne({ razorpayOrderId: rzpOrderId });
        if (order) {
          await markOrderFailed(
            order,
            paymentEntity?.error_description || paymentEntity?.error_reason || 'Gateway reported failure',
            body
          );
        }
      }
    } else if (event === 'refund.processed' || event === 'refund.created') {
      const rzpPaymentId = refundEntity?.payment_id;
      if (rzpPaymentId) {
        const order = await Order.findOne({ paymentId: rzpPaymentId });
        if (order && order.paymentStatus === 'PAID') {
          order.paymentStatus = 'REFUNDED';
          order.refundId = refundEntity?.id || order.refundId;
          order.refundStatus = refundEntity?.status || event;
          order.refundedAt = new Date();
          await order.save();
          await Payment.findOneAndUpdate(
            { razorpayPaymentId: rzpPaymentId },
            { $set: { status: 'REFUNDED', refundId: order.refundId, refundStatus: order.refundStatus } }
          );
          await Settlement.findOneAndUpdate(
            { orderId: order._id },
            { $set: { status: 'REVERSED', settlementRef: order.refundId } }
          );
        }
      }
    } else if (event === 'transfer.processed') {
      // Route transfer to the restaurant's linked account completed
      const transferId = transferEntity?.id;
      const recipient = transferEntity?.recipient || transferEntity?.account;
      const paymentId = body?.payload?.transfer?.entity?.source || transferEntity?.source;
      const query: any = {};
      if (transferId) query.transferId = transferId;
      let settlement = transferId ? await Settlement.findOne({ transferId }) : null;
      if (!settlement && paymentId) {
        const ord = await Order.findOne({ paymentId });
        if (ord) settlement = await Settlement.findOne({ orderId: ord._id });
      }
      if (!settlement && recipient) settlement = await Settlement.findOne({ linkedAccountId: recipient, status: 'PROCESSING' }).sort({ createdAt: -1 });
      if (settlement) {
        settlement.status = 'SETTLED';
        settlement.settledAt = new Date();
        if (transferId) settlement.transferId = transferId;
        settlement.settlementRef = transferId || settlement.settlementRef;
        await settlement.save();
        await Order.findByIdAndUpdate(settlement.orderId, {
          $set: { payoutStatus: 'SETTLED', settledAt: new Date(), settlementRef: transferId },
        });
      }
    } else if (event === 'transfer.failed') {
      const transferId = transferEntity?.id;
      if (transferId) {
        await Settlement.findOneAndUpdate(
          { transferId },
          { $set: { status: 'FAILED', failureReason: transferEntity?.error?.description || 'Route transfer failed' }, $inc: { attempts: 1 } }
        );
      }
    }
  } catch (e) {
    console.error('[webhook] handler error:', e);
  }
  // Always 200 for well-formed posts so Razorpay stops retrying duplicates
  res.json({ received: true });
};
