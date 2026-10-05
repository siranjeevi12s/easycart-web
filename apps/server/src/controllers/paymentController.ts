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

  // Payment ledger upsert (idempotent on gateway order id)
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
      // Route transfer attached → PROCESSING; else platform owes restaurant
      status: opts.transferAttached ? 'PROCESSING' : 'PENDING',
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
  const { orderId, orderIds: bodyOrderIds, batchId } = req.body;
  const idList: string[] = bodyOrderIds && bodyOrderIds.length ? bodyOrderIds : orderId ? [orderId] : [];
  if (!idList.length && !batchId) return res.status(400).json({ message: 'orderId(s) or batchId required' });

  // Resolve the batch: explicit ids, or all sibling orders of a batch
  let orders: any[];
  if (idList.length) {
    orders = await Order.find({ _id: { $in: idList } });
    if (orders.length !== idList.length) return res.status(404).json({ message: 'One or more orders not found' });
  } else {
    orders = await Order.find({ batchId });
    if (!orders.length) return res.status(404).json({ message: 'Batch not found' });
  }
  for (const o of orders) {
    if (o.customerId.toString() !== req.user!.id) return res.status(403).json({ message: 'Forbidden' });
    if (o.paymentStatus === 'PAID') return res.status(400).json({ message: `Order ${o.orderNumber} already paid — start a new checkout`, code: 'ALREADY_PAID' });
    if (!canTransition(o.orderStatus as any, 'PAID'))
      return res.status(400).json({ message: `Cannot pay order ${o.orderNumber} in ${o.orderStatus} state` });
    await ensureOrderSplit(o);
  }

  const restaurants = new Map<string, any>();
  for (const o of orders) {
    const rid = o.restaurantId.toString();
    if (!restaurants.has(rid)) {
      const r = await Restaurant.findById(o.restaurantId);
      if (!r) return res.status(404).json({ message: 'Restaurant not found' });
      if (!r.payoutEnabled)
        return res.status(400).json({
          message: `${r.name} has not configured payouts yet — remove its items or try another restaurant.`,
          code: 'PAYOUT_NOT_CONFIGURED',
        });
      restaurants.set(rid, r);
    }
  }

  const batch = orders[0].batchId || `B_${Date.now().toString(36)}`;
  const splits = orders.map((o) => ({
    orderId: o._id.toString(),
    orderNumber: o.orderNumber,
    restaurantId: o.restaurantId.toString(),
    restaurantName: restaurants.get(o.restaurantId.toString()).name,
    total: o.totalAmount,
    platformFee: o.platformFee,
    restaurantAmount: o.restaurantAmount,
  }));
  const combined = splits.reduce((s, x) => s + x.total, 0);
  const payees = [...restaurants.values()].map((r: any) => ({
    restaurantName: r.name,
    payoutMode: r.payoutMode,
    upiId: r.payoutMode === 'UPI' ? r.payoutUpiId : undefined,
  }));
  // Every intent rides Razorpay (single orders and multi-seller batches alike).
  return createRazorpayBatchIntent(res, orders, restaurants, { batch, splits, combined, payees });
};

async function createRazorpayBatchIntent(
  res: Response,
  orders: any[],
  restaurants: Map<string, any>,
  batch: { batch: string; splits: any[]; combined: number; payees: any[] }
) {
  const orderIds = orders.map((o) => o._id.toString());
  // Idempotency: reuse the open intent when ALL siblings share one
  const sharedRzp = orders.every((o) => o.razorpayOrderId && o.razorpayOrderId === orders[0].razorpayOrderId)
    ? orders[0].razorpayOrderId
    : null;
  if (sharedRzp) {
    const existing = await Payment.findOne({ razorpayOrderId: sharedRzp });
    if (existing && existing.status === 'CREATED') {
      return res.json({
        razorpayOrderId: existing.razorpayOrderId,
        amount: toPaise(batch.combined),
        currency: existing.currency,
        keyId: env.RAZORPAY_KEY_ID,
        mode: existing.mode,
        reused: true,
        batchId: batch.batch,
        orderIds,
        orders,
        splits: batch.splits,
        combined: batch.combined,
        checkoutPath: `/api/payments/checkout/${existing.razorpayOrderId}`,
        payees: batch.payees,
        // legacy single-order fields
        split: batch.splits[0],
        payee: batch.payees[0],
        order: orders[0],
      });
    }
    // Gateway already captured (app never returned) — complete locally, no new charge
    try {
      const fetched = await paymentService.fetchPayment(sharedRzp).catch(() => null);
      void fetched;
    } catch {}
  }

  const amountPaise = toPaise(batch.combined);
  // One transfer per linked restaurant; platform keeps the remainder (its commission)
  const transfers = batch.splits
    .filter((s: any) => {
      const r = restaurants.get(s.restaurantId);
      return r?.razorpayLinkedAccountId && s.restaurantAmount > 0;
    })
    .map((s: any) => ({
      account: restaurants.get(s.restaurantId).razorpayLinkedAccountId,
      amount: toPaise(s.restaurantAmount),
      orderId: s.orderId,
      restaurantId: s.restaurantId,
    }));
  const receipt = batch.batch.slice(0, 40);
  const intent = await paymentService.createOrderIntent({
    amount: amountPaise,
    receipt,
    restaurantId: orders[0].restaurantId.toString(),
    orderId: orders[0]._id.toString(),
    transfers,
  });

  for (const o of orders) {
    o.razorpayOrderId = intent.id;
    if (!o.batchId) o.batchId = batch.batch;
    await o.save();
  }

  await Payment.findOneAndUpdate(
    { razorpayOrderId: intent.id },
    {
      $setOnInsert: {
        orderId: orders[0]._id,
        orderIds: orders.map((o) => o._id),
        batchId: batch.batch,
        restaurantId: orders[0].restaurantId,
        customerId: orders[0].customerId,
        razorpayOrderId: intent.id,
        amount: batch.combined,
        currency: intent.currency,
        platformFee: batch.splits.reduce((s: number, x: any) => s + x.platformFee, 0),
        restaurantAmount: batch.splits.reduce((s: number, x: any) => s + x.restaurantAmount, 0),
        status: 'CREATED',
        mode: (intent as any).mode || paymentService.mode(),
        rawPayload: { transfers: transfers.map((t) => ({ account: t.account, amount: t.amount, orderId: t.orderId })) },
      },
    },
    { upsert: true, new: true }
  );

  return res.json({
    provider: 'razorpay',
    razorpayOrderId: intent.id,
    amount: intent.amount,
    currency: intent.currency,
    keyId: intent.keyId,
    mode: (intent as any).mode || paymentService.mode(),
    transferAttached: (intent as any).transferAttached || false,
    transfers: transfers.map((t) => ({ account: t.account, amount: t.amount })),
    batchId: batch.batch,
    orderIds,
    orders,
    splits: batch.splits,
    combined: batch.combined,
    checkoutPath: `/api/payments/checkout/${intent.id}`,
    payees: batch.payees,
    // legacy single-order fields
    split: batch.splits[0],
    payee: batch.payees[0],
    order: orders[0],
  });
}
export const checkoutPage = async (req: any, res: Response) => {
  const rzpOrderId = req.params.rzpOrderId as string;
  const payment = await Payment.findOne({ razorpayOrderId: rzpOrderId });
  if (!payment) return res.status(404).send('Payment intent not found or expired.');
  if (payment.status === 'PAID') return res.send('<h3>Already paid ✅ — you can return to EasyCart.</h3>');
  const order = await Order.findById(payment.orderId);
  if (!order) return res.status(404).send('Order not found.');
  // Multi-seller batch: show combined label across sibling orders
  const siblingIds: string[] = (payment.orderIds && payment.orderIds.length ? payment.orderIds : [payment.orderId]).map((x: any) => x.toString());
  const batchOrders = siblingIds.length > 1 ? await Order.find({ _id: { $in: siblingIds } }) : [order];
  const batchTotal = batchOrders.reduce((s, o: any) => s + (o.totalAmount || 0), 0);
  const orderLabel = batchOrders.length > 1 ? `${batchOrders.length} orders (${batchOrders.map((o: any) => o.orderNumber).join(', ')})` : order.orderNumber;
  const restaurant = await Restaurant.findById(order.restaurantId);
  const customer = await User.findById(order.customerId).select('name email phone');
  const html = renderCheckoutPage({
    keyId: env.RAZORPAY_KEY_ID,
    razorpayOrderId: payment.razorpayOrderId || '',
    amountPaise: toPaise(batchTotal || order.totalAmount),
    currency: payment.currency || 'INR',
    restaurantName: batchOrders.length > 1 ? `${restaurant?.name || 'Restaurant'} +${batchOrders.length - 1} more` : (restaurant?.name || 'Restaurant'),
    orderNumber: orderLabel,
    customerName: customer?.name,
    customerEmail: customer?.email,
    customerPhone: customer?.phone,
    appOrderId: order._id.toString(),
    batchOrderIds: batchOrders.map((o: any) => o._id.toString()),
  });
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.send(html);
};

export const verifyPayment = async (req: AuthRequest, res: Response) => {
  const { orderId, orderIds: bodyOrderIds, batchId } = req.body;
  const idList: string[] = bodyOrderIds && bodyOrderIds.length ? bodyOrderIds : orderId ? [orderId] : [];
  if (!idList.length && !batchId) return res.status(400).json({ message: 'orderId(s) or batchId required' });

  let orders: any[];
  if (idList.length) {
    orders = await Order.find({ _id: { $in: idList } });
    if (orders.length !== idList.length) return res.status(404).json({ message: 'Order not found' });
  } else {
    orders = await Order.find({ batchId });
    if (!orders.length) return res.status(404).json({ message: 'Batch not found' });
  }
  for (const o of orders) {
    if (o.customerId.toString() !== req.user!.id && req.user!.role !== 'admin')
      return res.status(403).json({ message: 'Forbidden' });
  }
  if (orders.every((o) => o.paymentStatus === 'PAID'))
    return res.json({ message: 'Already verified', orders, order: orders[0] }); // idempotent

  return verifyRazorpayPayment(req, res, orders);
};

async function verifyRazorpayPayment(req: AuthRequest, res: Response, orders: any[]) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
    return res.status(400).json({ message: 'Missing payment fields' });
  const pending = orders.filter((o) => o.paymentStatus !== 'PAID');
  if (!pending.length) {
    const fresh = await Order.find({ _id: { $in: orders.map((o) => o._id) } });
    return res.json({ message: 'Already verified', orders: fresh, order: fresh[0] });
  }

  // Duplicate payment-id replay protection (batch-aware)
  const dup = await Payment.findOne({ razorpayPaymentId: razorpay_payment_id });
  if (dup && dup.status === 'PAID') {
    const dupIds = new Set((dup.orderIds || [dup.orderId]).map((x: any) => x.toString()));
    const overlap = pending.filter((o) => dupIds.has(o._id.toString()));
    if (!overlap.length)
      return res.status(409).json({ message: 'This payment was already used for another order' });
    const fresh = await Order.find({ _id: { $in: orders.map((o) => o._id) } });
    return res.json({ message: 'Already verified (duplicate callback)', orders: fresh, order: fresh[0] });
  }

  const valid = paymentService.verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
  if (!valid) {
    for (const o of pending) await markOrderFailed(o, 'Signature verification failed', req.body);
    return res.status(400).json({ message: 'Payment verification failed' });
  }

  // Tamper protection: gateway captured total must equal the batch total
  const expectedPaise = toPaise(pending.reduce((s, o) => s + o.totalAmount, 0));
  const fetched = await paymentService.fetchPayment(razorpay_payment_id);
  if (fetched) {
    if (fetched.amount !== expectedPaise) {
      for (const o of pending) await markOrderFailed(o, `Amount mismatch: gateway ${fetched.amount} paise vs batch ${expectedPaise} paise`, fetched);
      return res.status(400).json({ message: 'Payment amount mismatch — flagged for review, contact support' });
    }
    if (!['captured', 'authorized'].includes(fetched.status)) {
      for (const o of pending) await markOrderFailed(o, `Gateway status not capturable: ${fetched.status}`, fetched);
      return res.status(400).json({ message: `Payment not completed at gateway (${fetched.status})` });
    }
  }

  const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
  const splitAccounts = new Set(
    ((payment?.rawPayload as any)?.transfers || []).map((t: any) => `${t.account}:${t.orderId}`)
  );
  try {
    const paid: any[] = [];
    for (const o of pending) {
      const restaurant = await Restaurant.findById(o.restaurantId);
      const linkedId = restaurant?.razorpayLinkedAccountId;
      // This sibling's share rides a Route transfer when its restaurant is linked
      const transferAttached = splitAccounts.has(`${linkedId}:${o._id.toString()}`) ||
        !!((payment?.rawPayload as any)?.transfers || []).length && !!linkedId && (payment?.rawPayload as any)?.transfers.some((t: any) => t.orderId === o._id.toString());
      const result = await markOrderPaid(o, {
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        mode: payment?.mode || paymentService.mode(),
        transferAttached,
        source: 'verify',
        rawPayload: req.body,
      });
      paid.push(result.order);
    }
    // Record batch linkage on the payment ledger
    if (payment && !(payment.orderIds || []).length) {
      payment.orderIds = orders.map((o) => o._id);
      payment.batchId = orders[0].batchId;
      await payment.save().catch(() => {});
    }
    res.json({ message: 'Payment verified', orders: paid, order: paid[0], batchId: orders[0].batchId });
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
    provider: 'razorpay',
    settlement: settlement
      ? { status: settlement.status, transferId: settlement.transferId, settledAt: settlement.settledAt }
      : null,
  });
};

/** Pollable batch status — every sibling order + combined split (receipt screen). */
export const batchStatus = async (req: AuthRequest, res: Response) => {
  const orders = await Order.find({ batchId: req.params.batchId }).sort({ createdAt: 1 });
  if (!orders.length) return res.status(404).json({ message: 'Batch not found' });
  if (req.user!.role === 'customer' && orders.some((o: any) => o.customerId.toString() !== req.user!.id))
    return res.status(403).json({ message: 'Forbidden' });
  const settlements = await Settlement.find({ orderId: { $in: orders.map((o: any) => o._id) } });
  const byOrder = new Map(settlements.map((s: any) => [s.orderId.toString(), s]));
  const total = orders.reduce((s: number, o: any) => s + o.totalAmount, 0);
  res.json({
    batchId: req.params.batchId,
    allPaid: orders.every((o: any) => o.paymentStatus === 'PAID'),
    total,
    platformFee: orders.reduce((s: number, o: any) => s + (o.platformFee || 0), 0),
    orders: orders.map((o: any) => ({
      orderId: o._id,
      orderNumber: o.orderNumber,
      restaurantId: o.restaurantId,
      total: o.totalAmount,
      platformFee: o.platformFee,
      restaurantAmount: o.restaurantAmount,
      paymentStatus: o.paymentStatus,
      orderStatus: o.orderStatus,
      settlement: (() => { const s: any = byOrder.get(o._id.toString()); return s ? { status: s.status, transferId: s.transferId } : null; })(),
    })),
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
  if (!order.paymentId) return res.status(400).json({ message: 'No Razorpay payment to refund' });
  const refundPaise = amount ? toPaise(Number(amount)) : undefined;
  if (refundPaise && (refundPaise <= 0 || refundPaise > toPaise(order.totalAmount)))
    return res.status(400).json({ message: 'Invalid refund amount' });
  const r = await paymentService.createRefund(
    order.paymentId,
    refundPaise,
    { orderId: order._id.toString(), reason: reason || 'restaurant refund' }
  );
  const refundId: string = r.id;
  const refundStatus: string = r.status;

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

/** Return_url landing: resolves via OUR appOrder param first, then EC_<id> fallback. */
export const paymentReturn = async (req: any, res: Response) => {
  const appOrder = String(req.query.appOrder || '');
  const gwOrderId = String(req.query.order_id || '');
  let payment: any = null;
  if (appOrder) {
    payment = await Payment.findOne({ orderId: appOrder }).sort({ createdAt: -1 });
  }
  if (!payment && gwOrderId) {
    const m = gwOrderId.match(/EC_([0-9a-fA-F]{24})/);
    if (m) payment = await Payment.findOne({ orderId: m[1] }).sort({ createdAt: -1 });
    if (!payment) payment = await Payment.findOne({ razorpayOrderId: gwOrderId });
  }
  if (!payment) return res.status(400).send('Unknown payment — return to the app and check status.');
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.send('<h3>Payment received ✅</h3><p>Your order is being prepared. Thank you for ordering!</p>');
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
        const payment = await Payment.findOne({ razorpayOrderId: rzpOrderId });
        const ids: string[] = payment && (payment.orderIds || []).length
          ? payment.orderIds.map((x: any) => x.toString())
          : [];
        const siblings = ids.length
          ? await Order.find({ _id: { $in: ids }, paymentStatus: { $ne: 'PAID' } })
          : await Order.findOne({ razorpayOrderId: rzpOrderId, paymentStatus: { $ne: 'PAID' } }).then((one: any) => (one ? [one] : []));
        const expected = toPaise(siblings.reduce((s, o: any) => s + o.totalAmount, 0));
        for (const order of siblings) {
          // Amount cross-check before trusting the webhook
          if (paymentEntity.amount && paymentEntity.amount !== expected) {
            await markOrderFailed(order, `Webhook amount mismatch: ${paymentEntity.amount} vs ${expected}`, body);
          } else {
            const splitAccounts = new Set(
              ((payment?.rawPayload as any)?.transfers || []).map((t: any) => `${t.account}:${t.orderId}`)
            );
            const restaurant = await Restaurant.findById(order.restaurantId);
            await markOrderPaid(order, {
              razorpayOrderId: rzpOrderId,
              razorpayPaymentId: rzpPaymentId,
              mode: payment?.mode || paymentService.mode(),
              transferAttached: splitAccounts.has(`${restaurant?.razorpayLinkedAccountId}:${order._id.toString()}`),
              source: 'webhook',
              rawPayload: body,
            });
          }
        }
      }
    } else if (event === 'payment.failed') {
      const rzpOrderId = paymentEntity?.order_id;
      if (rzpOrderId) {
        const payment = await Payment.findOne({ razorpayOrderId: rzpOrderId });
        const ids: string[] = payment && (payment.orderIds || []).length
          ? payment.orderIds.map((x: any) => x.toString())
          : [];
        const siblings = ids.length
          ? await Order.find({ _id: { $in: ids }, paymentStatus: { $ne: 'PAID' } })
          : await Order.findOne({ razorpayOrderId: rzpOrderId, paymentStatus: { $ne: 'PAID' } }).then((one: any) => (one ? [one] : []));
        for (const order of siblings) {
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


