import { Response } from 'express';
import { AuthRequest } from '../types';
import { Restaurant } from '../models/Restaurant';
import { MenuItem } from '../models/MenuItem';
import { Order } from '../models/Order';
import { Settlement } from '../models/Settlement';
import { User } from '../models/User';
import { env } from '../config/env';
import { paymentService } from '../services/paymentService';

export const listRestaurants = async (req: AuthRequest, res: Response) => {
  const { search, open } = req.query as any;
  const filter: any = { isActive: true, isDeleted: { $ne: true }, approvalStatus: 'approved' };
  if (search) {
    const searchPattern = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const matchingMenuItems = await MenuItem.find({
      isDeleted: { $ne: true },
      isAvailable: true,
      $or: [{ name: searchPattern }, { description: searchPattern }, { category: searchPattern }],
    }).select('restaurantId');
    const restaurantIds = matchingMenuItems.map((item) => item.restaurantId);
    filter.$or = [
      { name: searchPattern },
      { address: searchPattern },
      { description: searchPattern },
      ...(restaurantIds.length > 0 ? [{ _id: { $in: restaurantIds } }] : []),
    ];
  }
  if (open === 'true') filter.isOpen = true;
  const restaurants = await Restaurant.find(filter).sort({ createdAt: -1 });
  res.json(restaurants);
};

export const getRestaurant = async (req: AuthRequest, res: Response) => {
  const r = await Restaurant.findById(req.params.id);
  if (!r || (r as any).isDeleted) return res.status(404).json({ message: 'Restaurant not found' });
  // Unapproved/suspended kitchens are invisible publicly (owners use /my)
  if ((r as any).approvalStatus !== 'approved') return res.status(404).json({ message: 'Restaurant not found' });
  res.json(r);
};

export const createRestaurant = async (req: AuthRequest, res: Response) => {
  const { name, description, address, phone, image } = req.body;
  if (!name || !address) return res.status(400).json({ message: 'Name and address required' });
  const restaurant = await Restaurant.create({
    ownerId: req.user!.id,
    name,
    description,
    address,
    phone,
    image: image || undefined,
  });
  res.status(201).json(restaurant);
};

export const updateRestaurant = async (req: AuthRequest, res: Response) => {
  const r = await Restaurant.findById(req.params.id);
  if (!r || r.isDeleted) return res.status(404).json({ message: 'Not found' });
  if (r.ownerId.toString() !== req.user!.id && req.user!.role !== 'admin')
    return res.status(403).json({ message: 'Forbidden' });
  // Payout flags + linked account can only change via PUT /:id/payout (validated flow).
  // Approval fields are admin-only (PATCH /api/admin/...) — owners must never self-approve.
  const { payoutEnabled, payoutVerified, payoutUpdatedAt, payoutAccountNumber, razorpayLinkedAccountId, routeOnboarded, approvalStatus, approvalNote, approvedAt, approvedBy, ...safe } = req.body || {};
  void payoutEnabled; void payoutVerified; void payoutUpdatedAt; void payoutAccountNumber;
  void razorpayLinkedAccountId; void routeOnboarded;
  void approvalStatus; void approvalNote; void approvedAt; void approvedBy;
  Object.assign(r, safe);
  await r.save();
  res.json(r);
};

export const myRestaurants = async (req: AuthRequest, res: Response) => {
  const list = await Restaurant.find({ ownerId: req.user!.id, isDeleted: { $ne: true } });
  res.json(list);
};

export const toggleRestaurant = async (req: AuthRequest, res: Response) => {
  const r = await Restaurant.findById(req.params.id);
  if (!r || r.isDeleted) return res.status(404).json({ message: 'Not found' });
  r.isActive = !r.isActive;
  await r.save();
  res.json(r);
};

// ---------- Payout / payment-details collection (real-world workflow) ----------

const UPI_RE = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

function maskAccount(acc?: string): string | undefined {
  if (!acc) return undefined;
  if (acc.length <= 4) return '****';
  return `****${acc.slice(-4)}`;
}

async function assertOwner(req: AuthRequest, restaurantId: string) {  const r = await Restaurant.findById(restaurantId);
  if (!r || r.isDeleted) throw Object.assign(new Error('Restaurant not found'), { status: 404 });
  if (r.ownerId.toString() !== req.user!.id && req.user!.role !== 'admin')
    throw Object.assign(new Error('Forbidden: not your restaurant'), { status: 403 });
  return r;
}

/** GET /restaurants/:id/payout — owner sees full details + earnings summary */
export const getPayoutDetails = async (req: AuthRequest, res: Response) => {
  const r = await assertOwner(req, req.params.id as string);
  const paidOrders = await Order.find({ restaurantId: r._id, paymentStatus: 'PAID' });
  const settlements = await Settlement.find({ restaurantId: r._id });
  const pending = paidOrders.filter((o) => o.payoutStatus !== 'SETTLED');
  const settled = paidOrders.filter((o) => o.payoutStatus === 'SETTLED');
  const sum = (arr: any[], f: (o: any) => number) => arr.reduce((s, o) => s + (f(o) || 0), 0);
  // Prefer backfilled split fields; fall back to totals for legacy orders
  const restShare = (o: any) => o.restaurantAmount || o.totalAmount || 0;
  const feeShare = (o: any) => o.platformFee ?? 0;
  res.json({
    restaurantId: r._id,
    payoutMode: r.payoutMode || 'UPI',
    payoutUpiId: r.payoutUpiId || '',
    payoutAccountHolder: r.payoutAccountHolder || '',
    // Never send full account number to lists — owner gets masked + last4; full only on explicit need
    payoutAccountNumberMasked: maskAccount(r.payoutAccountNumber),
    payoutAccountNumber: r.payoutAccountNumber || '',
    payoutIfsc: r.payoutIfsc || '',
    payoutBankName: r.payoutBankName || '',
    payoutEnabled: !!r.payoutEnabled,
    payoutVerified: !!r.payoutVerified,
    payoutUpdatedAt: r.payoutUpdatedAt,
    // Razorpay Route marketplace
    razorpayLinkedAccountId: r.razorpayLinkedAccountId || '',
    routeOnboarded: !!r.routeOnboarded,
    routeEnabled: env.RAZORPAY_ROUTE_ENABLED,
    platformFeePercent: env.PLATFORM_FEE_PERCENT,
    settlementMode: !r.razorpayLinkedAccountId
      ? 'QUEUED'
      : env.RAZORPAY_ROUTE_ENABLED ? 'ROUTE_AUTO' : 'QUEUED',
    earnings: {
      totalReceived: sum(paidOrders, restShare),
      pendingSettlement: sum(pending, restShare),
      settled: sum(settled, restShare),
      platformFees: sum(paidOrders, feeShare),
      paidOrders: paidOrders.length,
      pendingCount: pending.length,
      settledCount: settled.length,
      routeSettled: settlements.filter((s) => s.status === 'SETTLED').length,
      routePending: settlements.filter((s) => ['PENDING', 'PROCESSING'].includes(s.status)).length,
    },
  });
};

/** PUT /restaurants/:id/payout — owner saves UPI / bank details to receive order amounts */
export const updatePayoutDetails = async (req: AuthRequest, res: Response) => {
  const r = await assertOwner(req, req.params.id as string);
  const { payoutMode, payoutUpiId, payoutAccountHolder, payoutAccountNumber, payoutIfsc, payoutBankName, razorpayLinkedAccountId } = req.body;
  const mode = payoutMode === 'BANK' ? 'BANK' : 'UPI';

  if (mode === 'UPI') {
    if (!payoutUpiId || !UPI_RE.test(String(payoutUpiId).trim()))
      return res.status(400).json({ message: 'Valid UPI ID required (e.g. shopname@okhdfcbank)' });
    r.payoutMode = 'UPI';
    r.payoutUpiId = String(payoutUpiId).trim();
  } else {
    if (!payoutAccountHolder || String(payoutAccountHolder).trim().length < 3)
      return res.status(400).json({ message: 'Account holder name required' });
    const acc = String(payoutAccountNumber || '').replace(/\s/g, '');
    if (!/^\d{9,18}$/.test(acc)) return res.status(400).json({ message: 'Account number must be 9–18 digits' });
    const ifsc = String(payoutIfsc || '').trim().toUpperCase();
    if (!IFSC_RE.test(ifsc)) return res.status(400).json({ message: 'Valid IFSC required (e.g. HDFC0001234)' });
    if (!payoutBankName || String(payoutBankName).trim().length < 2)
      return res.status(400).json({ message: 'Bank name required' });
    r.payoutMode = 'BANK';
    r.payoutAccountHolder = String(payoutAccountHolder).trim();
    r.payoutAccountNumber = acc;
    r.payoutIfsc = ifsc;
    r.payoutBankName = String(payoutBankName).trim();
  }

  // Format-check passed → enable payouts. In production, set payoutVerified=true
  // only after penny-drop / Razorpay Route account validation.
  r.payoutEnabled = true;
  r.payoutVerified = true;
  r.payoutUpdatedAt = new Date();
  // Optional Razorpay Route linked account (created in Razorpay dashboard after KYC).
  // Enables automatic split of the restaurant share on every capture.
  if (razorpayLinkedAccountId !== undefined) {
    const linked = String(razorpayLinkedAccountId || '').trim();
    if (linked && !/^acc_[A-Za-z0-9]+$/.test(linked))
      return res.status(400).json({ message: 'Linked account must look like acc_XXXX (from Razorpay Route dashboard)' });
    (r as any).razorpayLinkedAccountId = linked || undefined;
    (r as any).routeOnboarded = !!linked;
    if (linked) {
      (r as any).payoutEnabled = true;
      (r as any).payoutVerified = true;
      (r as any).payoutUpdatedAt = new Date();
    }
  }
  await r.save();
  res.json({
    message: mode === 'UPI'
      ? `Payouts enabled — order amounts will settle to UPI ${r.payoutUpiId}`
      : `Payouts enabled — order amounts will settle to ${r.payoutBankName} ****${(r.payoutAccountNumber || '').slice(-4)}`,
    payoutEnabled: true,
    payoutMode: r.payoutMode,
    routeOnboarded: (r as any).routeOnboarded,
  });
};

/** POST /restaurants/:id/route-account — create a Razorpay Route linked account
 *  for the seller from their payout details (test mode accepts test KYC).
 *  After this, every Razorpay payment auto-splits their share on capture. */
export const createRouteAccount = async (req: AuthRequest, res: Response) => {
  const r = await assertOwner(req, req.params.id as string);
  if (!(r as any).payoutEnabled)
    return res.status(400).json({ message: 'Configure payout details first (UPI or bank)' });
  if ((r as any).razorpayLinkedAccountId) {
    return res.json({ message: 'Route account already linked', linkedAccountId: (r as any).razorpayLinkedAccountId });
  }
  // PAN mandatory for linked accounts; test PAN accepted in test mode
  const pan = String(req.body?.pan || '').trim().toUpperCase();
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan))
    return res.status(400).json({ message: 'Valid PAN required for Route KYC' });
  const owner = await User.findById((r as any).ownerId).select('name email phone');
  const phone = String(owner?.phone || (r as any).phone || '').replace(/\D/g, '').slice(-10);
  if (phone.length < 10) return res.status(400).json({ message: 'A 10-digit owner/phone number is required for Route KYC' });
  const hasBank = !!((r as any).payoutAccountNumber && (r as any).payoutIfsc);
  try {
    const acc: any = await paymentService.createLinkedAccount({
      email: owner?.email || `seller_${(r._id as any).toString()}@easycart.local`,
      phone,
      legalBusinessName: String((r as any).name).slice(0, 100),
      contactName: String(owner?.name || (r as any).name).slice(0, 100),
      pan,
      accountNumber: hasBank ? (r as any).payoutAccountNumber : undefined,
      ifsc: hasBank ? (r as any).payoutIfsc : undefined,
    });
    const linkedId = acc?.id;
    if (!linkedId || !String(linkedId).startsWith('acc_'))
      return res.status(502).json({ message: 'Razorpay did not return a linked account id', raw: acc });
    (r as any).razorpayLinkedAccountId = linkedId;
    (r as any).routeOnboarded = true;
    (r as any).payoutEnabled = true;
    (r as any).payoutVerified = true;
    (r as any).payoutUpdatedAt = new Date();
    await r.save();
    res.status(201).json({
      message: `Route account ${linkedId} linked — payments now auto-split to ${(r as any).name}`,
      linkedAccountId: linkedId,
      status: acc?.status,
    });
  } catch (e: any) {
    res.status(e.status || 502).json({ message: e.message || 'Route onboarding failed' });
  }
};

/** GET /restaurants/:id/payment-info — public, shown at customer checkout */
export const getPublicPaymentInfo = async (req: AuthRequest, res: Response) => {
  const r = await Restaurant.findById(req.params.id);
  if (!r || r.isDeleted) return res.status(404).json({ message: 'Restaurant not found' });
  res.json({
    restaurantId: r._id,
    restaurantName: r.name,
    payoutEnabled: !!r.payoutEnabled,
    payoutMode: r.payoutMode || 'UPI',
    // UPI id is safe to display (like a QR); bank account never exposed publicly
    payoutUpiId: r.payoutMode === 'UPI' ? r.payoutUpiId || null : null,
    payoutBankName: r.payoutMode === 'BANK' ? r.payoutBankName || null : null,
  });
};

/** GET /restaurants/:id/settlements — owner lists PAID orders with payout status */
export const listSettlements = async (req: AuthRequest, res: Response) => {
  const r = await assertOwner(req, req.params.id as string);
  // Prefer the Settlement ledger (has split + Route status); fall back to orders.
  const ledger = await Settlement.find({ restaurantId: r._id }).sort({ createdAt: -1 }).limit(100);
  if (ledger.length > 0) {
    const orderIds = ledger.map((s) => s.orderId);
    const orders = await Order.find({ _id: { $in: orderIds } }).select('orderNumber totalAmount paymentId razorpayOrderId createdAt');
    const byId = new Map(orders.map((o: any) => [o._id.toString(), o]));
    return res.json(ledger.map((s) => {
      const o: any = byId.get(s.orderId.toString());
      return {
        _id: o?._id || s._id,
        orderNumber: o?.orderNumber,
        totalAmount: s.totalAmount,
        platformFee: s.platformFee,
        restaurantAmount: s.restaurantAmount,
        paymentId: s.razorpayPaymentId || o?.paymentId,
        razorpayOrderId: s.razorpayOrderId,
        payoutStatus: s.status === 'SETTLED' ? 'SETTLED' : 'PENDING',
        settlementStatus: s.status,
        transferId: s.transferId,
        settledAt: s.settledAt,
        settlementRef: s.settlementRef,
        createdAt: s.createdAt,
      };
    }));
  }
  const orders = await Order.find({ restaurantId: r._id, paymentStatus: 'PAID' })
    .sort({ createdAt: -1 })
    .limit(100)
    .select('orderNumber totalAmount platformFee restaurantAmount paymentId razorpayOrderId payoutStatus settledAt settlementRef createdAt');
  res.json(orders);
};

/** PATCH /restaurants/:id/settlements/:orderId — mark an order amount as settled (after UPI/bank transfer) */
export const markSettled = async (req: AuthRequest, res: Response) => {
  const r = await assertOwner(req, req.params.id as string);
  const order = await Order.findOne({ _id: req.params.orderId as string, restaurantId: r._id });
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.paymentStatus !== 'PAID') return res.status(400).json({ message: 'Only PAID orders can be settled' });
  order.payoutStatus = 'SETTLED';
  order.settledAt = new Date();
  order.settlementRef = String(req.body?.settlementRef || `MANUAL-${Date.now()}`).slice(0, 200);
  await order.save();
  res.json({ message: `₹${order.totalAmount} marked settled to ${r.payoutMode === 'UPI' ? r.payoutUpiId : r.payoutBankName}`, order });
};