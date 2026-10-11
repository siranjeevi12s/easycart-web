import { Response } from 'express';
import { AuthRequest } from '../types';
import { PromoPackage } from '../models/PromoPackage';
import { PromoCampaign } from '../models/PromoCampaign';
import { PromoEvent } from '../models/PromoEvent';
import { Restaurant } from '../models/Restaurant';
import { Order } from '../models/Order';
import { paymentService } from '../services/paymentService';
import { toPaise } from '../utils/commission';
import { renderCheckoutPage } from '../utils/checkoutPage';
import { env } from '../config/env';

async function ownedRestaurant(restaurantId: string, ownerId: string) {
  const r = await Restaurant.findById(restaurantId);
  if (!r || (r as any).isDeleted) throw Object.assign(new Error('Restaurant not found'), { status: 404 });
  if ((r as any).ownerId.toString() !== ownerId)
    throw Object.assign(new Error('Forbidden: not your restaurant'), { status: 403 });
  return r;
}

/** Pure ranking: priority first, then fair rotation (least-shown wins ties). Exported for tests. */
export function rankSponsored<T extends { snapshot: { priority: number }; metrics: { impressions: number } }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const pd = (b.snapshot?.priority || 0) - (a.snapshot?.priority || 0);
    if (pd !== 0) return pd;
    return (a.metrics?.impressions || 0) - (b.metrics?.impressions || 0);
  });
}

function liveFilter(now: Date) {
  return {
    status: 'active' as const,
    'approval.status': 'approved' as const,
    'schedule.startDate': { $lte: now },
    'schedule.endDate': { $gte: now },
  };
}

function campaignCard(c: any) {
  const r = c.restaurantId || {};
  return {
    campaignId: c._id,
    restaurantId: r._id || c.restaurantId,
    name: r.name,
    description: r.description,
    address: r.address,
    image: r.image,
    rating: r.rating ?? 4.5,
    ratingCount: r.ratingCount ?? 0,
    isOpen: r.isOpen,
    offerText: c.offerText || '',
    packageName: c.snapshot?.name || '',
    priority: c.snapshot?.priority || 0,
  };
}

// ---------- owner: packages ----------

/** Active packages a restaurant owner can buy. */
export const listPackages = async (_req: AuthRequest, res: Response) => {
  const pkgs = await PromoPackage.find({ isActive: true }).sort({ price: 1 });
  res.json(pkgs);
};

// ---------- owner: checkout ----------

/** Start a promo purchase: creates the campaign (payment_pending) + Razorpay intent. */
export const createPromoCheckout = async (req: AuthRequest, res: Response) => {
  const { packageId, restaurantId, offerText } = req.body || {};
  if (!packageId || !restaurantId) return res.status(400).json({ message: 'packageId and restaurantId required' });
  const pkg = await PromoPackage.findById(packageId);
  if (!pkg || !(pkg as any).isActive) return res.status(404).json({ message: 'Package not available' });
  const restaurant = await ownedRestaurant(restaurantId, req.user!.id);
  if ((restaurant as any).approvalStatus !== 'approved')
    return res.status(400).json({ message: 'Restaurant must be admin-approved before it can be promoted' });

  const campaign = await PromoCampaign.create({
    restaurantId: (restaurant as any)._id,
    ownerId: req.user!.id,
    packageId: (pkg as any)._id,
    snapshot: {
      name: (pkg as any).name,
      durationDays: (pkg as any).durationDays,
      price: (pkg as any).price,
      priority: (pkg as any).priority,
    },
    offerText: String(offerText || '').slice(0, 120) || undefined,
    status: 'payment_pending',
    approval: { status: 'pending' },
  });

  const amountPaise = toPaise((pkg as any).price);
  const intent = await paymentService.createOrderIntent({
    amount: amountPaise,
    receipt: `promo_${(campaign as any)._id.toString()}`.slice(0, 40),
  });
  (campaign as any).payment = {
    razorpayOrderId: intent.id,
    amountPaise,
    mode: (intent as any).mode || paymentService.mode(),
  };
  await (campaign as any).save();

  res.status(201).json({
    campaignId: (campaign as any)._id,
    campaign,
    razorpayOrderId: intent.id,
    amount: intent.amount,
    currency: intent.currency,
    keyId: intent.keyId,
    mode: (campaign as any).payment.mode,
    checkoutPath: `/api/promos/checkout/${intent.id}`,
  });
};

/** Hosted Razorpay page for a promo purchase (reuses the order checkout template). */
export const promoCheckoutPage = async (req: any, res: Response) => {
  const campaign: any = await PromoCampaign.findOne({ 'payment.razorpayOrderId': req.params.rzpOrderId });
  if (!campaign) return res.status(404).send('Promo payment intent not found or expired.');
  if (!['payment_pending'].includes(campaign.status))
    return res.send('<h3>Already processed — return to EasyCart to check campaign status.</h3>');
  const restaurant = await Restaurant.findById(campaign.restaurantId);
  const html = renderCheckoutPage({
    keyId: env.RAZORPAY_KEY_ID,
    razorpayOrderId: campaign.payment.razorpayOrderId || '',
    amountPaise: campaign.payment.amountPaise || 0,
    currency: 'INR',
    restaurantName: 'EasyCart Promotions',
    orderNumber: `Promo: ${campaign.snapshot?.name} — ${restaurant?.name || ''}`,
    appOrderId: campaign._id.toString(),
    batchOrderIds: [campaign._id.toString()],
  });
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.send(html);
};

/** Shared paid transition — idempotent, first-write-wins. */
async function markCampaignPaid(campaign: any, opts: { razorpayPaymentId: string; razorpaySignature?: string; mode: string; source: string }) {
  if (!['payment_pending'].includes(campaign.status)) return { campaign, duplicate: true };
  campaign.status = 'awaiting_approval';
  campaign.payment.razorpayPaymentId = opts.razorpayPaymentId;
  campaign.payment.razorpaySignature = opts.razorpaySignature;
  campaign.payment.mode = opts.mode;
  try {
    await campaign.save();
  } catch (e: any) {
    if (e.code === 11000) {
      // Same gateway payment already recorded (verify + webhook race)
      const fresh = await PromoCampaign.findById(campaign._id);
      return { campaign: fresh, duplicate: true };
    }
    throw e;
  }
  return { campaign, duplicate: false };
}

/** Owner confirms payment after hosted checkout (signature-verified). */
export const verifyPromoPayment = async (req: AuthRequest, res: Response) => {
  const { campaignId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!campaignId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
    return res.status(400).json({ message: 'campaignId + Razorpay fields required' });
  const campaign: any = await PromoCampaign.findById(campaignId);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
  if (campaign.ownerId.toString() !== req.user!.id && req.user!.role !== 'admin')
    return res.status(403).json({ message: 'Forbidden' });
  if (campaign.payment?.razorpayOrderId !== razorpay_order_id)
    return res.status(400).json({ message: 'Order id does not belong to this campaign' });
  if (campaign.status !== 'payment_pending') {
    const fresh = await PromoCampaign.findById(campaignId);
    return res.json({ message: 'Already verified', campaign: fresh });
  }
  // Replay protection: one gateway payment funds exactly one campaign
  const dup = await PromoCampaign.findOne({ 'payment.razorpayPaymentId': razorpay_payment_id });
  if (dup && dup._id.toString() !== campaign._id.toString())
    return res.status(409).json({ message: 'This payment was already used for another campaign' });

  const valid = paymentService.verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
  if (!valid) return res.status(400).json({ message: 'Payment verification failed' });

  // Tamper protection: gateway captured total must equal the package price
  const fetched = await paymentService.fetchPayment(razorpay_payment_id);
  if (fetched) {
    if (fetched.amount !== campaign.payment.amountPaise)
      return res.status(400).json({ message: 'Payment amount mismatch — flagged for review, contact support' });
    if (!['captured', 'authorized'].includes(fetched.status))
      return res.status(400).json({ message: `Payment not completed at gateway (${fetched.status})` });
  }

  const { campaign: updated } = await markCampaignPaid(campaign, {
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
    mode: campaign.payment.mode || paymentService.mode(),
    source: 'verify',
  });
  res.json({ message: 'Payment verified — campaign sent for admin approval', campaign: updated });
};

/** Webhook path: same transition, driven by payment.captured (signature already checked). */
export async function confirmPromoFromWebhook(rzpOrderId: string, rzpPaymentId: string, authoritativeAmount?: number) {
  const campaign: any = await PromoCampaign.findOne({ 'payment.razorpayOrderId': rzpOrderId });
  if (!campaign || campaign.status !== 'payment_pending') return null;
  if (authoritativeAmount && authoritativeAmount !== campaign.payment.amountPaise) return null;
  const dup = await PromoCampaign.findOne({ 'payment.razorpayPaymentId': rzpPaymentId });
  if (dup) return null;
  const { campaign: updated } = await markCampaignPaid(campaign, {
    razorpayPaymentId: rzpPaymentId,
    mode: campaign.payment.mode || paymentService.mode(),
    source: 'webhook',
  });
  return updated;
}

// ---------- owner: manage ----------

export const myCampaigns = async (req: AuthRequest, res: Response) => {
  const list = await PromoCampaign.find({ ownerId: req.user!.id })
    .sort({ createdAt: -1 })
    .populate({ path: 'restaurantId', select: 'name image' })
    .populate({ path: 'packageId', select: 'name' });
  res.json(list);
};

async function campaignAnalytics(campaign: any) {
  const [impressions, clicks] = await Promise.all([
    PromoEvent.countDocuments({ campaignId: campaign._id, type: 'impression' }),
    PromoEvent.countDocuments({ campaignId: campaign._id, type: 'click' }),
  ]);
  const start = campaign.schedule?.startDate || campaign.createdAt;
  const end = campaign.schedule?.endDate || new Date();
  const orders = await Order.find({
    restaurantId: campaign.restaurantId,
    paymentStatus: 'PAID',
    createdAt: { $gte: start, $lte: end },
  }).select('orderNumber totalAmount createdAt');
  const revenue = orders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);
  return {
    impressions,
    clicks,
    ctr: impressions ? Number((clicks / impressions).toFixed(4)) : 0,
    attributedOrders: orders.length,
    attributedRevenue: revenue,
    window: { start, end },
    orders: orders.slice(0, 50),
  };
}

export const campaignDetail = async (req: AuthRequest, res: Response) => {
  const campaign: any = await PromoCampaign.findById(req.params.id)
    .populate({ path: 'restaurantId', select: 'name image address rating isOpen isActive approvalStatus' });
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
  if (campaign.ownerId.toString() !== req.user!.id && req.user!.role !== 'admin')
    return res.status(403).json({ message: 'Forbidden' });
  res.json({ campaign, analytics: await campaignAnalytics(campaign) });
};

/** Owner cancels: unpaid → cancelled; paid-but-not-live → gateway refund → refunded. */export const cancelCampaign = async (req: AuthRequest, res: Response) => {
  const campaign: any = await PromoCampaign.findById(req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
  if (campaign.ownerId.toString() !== req.user!.id) return res.status(403).json({ message: 'Forbidden' });
  if (campaign.status === 'payment_pending') {
    campaign.status = 'cancelled';
    await campaign.save();
    return res.json({ message: 'Unpaid campaign cancelled', campaign });
  }
  if (['awaiting_approval', 'scheduled'].includes(campaign.status) && campaign.payment?.razorpayPaymentId) {
    try {
      const r = await paymentService.createRefund(campaign.payment.razorpayPaymentId, campaign.payment.amountPaise, {
        campaignId: campaign._id.toString(),
        reason: req.body?.reason || 'owner cancelled promo',
      });
      campaign.status = 'refunded';
      campaign.refund = { refundId: r.id, status: r.status, at: new Date(), reason: String(req.body?.reason || 'owner cancelled').slice(0, 500) };
      await campaign.save();
      return res.json({ message: 'Campaign cancelled and refunded', campaign });
    } catch (e: any) {
      return res.status(e.status || 502).json({ message: e.message || 'Refund failed at gateway' });
    }
  }
  return res.status(400).json({ message: `Cannot cancel a ${campaign.status} campaign — contact support` });
};

const TERMINAL = ['expired', 'cancelled', 'rejected', 'refunded'];

/** Owner edits the offer line (display-only, safe anytime before terminal state). */
export const updateCampaign = async (req: AuthRequest, res: Response) => {
  const campaign: any = await PromoCampaign.findById(req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
  if (campaign.ownerId.toString() !== req.user!.id) return res.status(403).json({ message: 'Forbidden' });
  if (TERMINAL.includes(campaign.status))
    return res.status(400).json({ message: `Cannot edit a ${campaign.status} campaign — buy a new one instead` });
  const { offerText } = req.body || {};
  if (offerText === undefined) return res.status(400).json({ message: 'offerText required' });
  campaign.offerText = String(offerText).slice(0, 120) || undefined;
  await campaign.save();
  res.json({ message: 'Offer updated', campaign });
};

/** Owner resumes an interrupted payment: re-issues the Razorpay intent (old order id is abandoned). */
export const repayCampaign = async (req: AuthRequest, res: Response) => {
  const campaign: any = await PromoCampaign.findById(req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
  if (campaign.ownerId.toString() !== req.user!.id) return res.status(403).json({ message: 'Forbidden' });
  if (campaign.status !== 'payment_pending')
    return res.status(400).json({ message: `Only unpaid campaigns can be repaid (now ${campaign.status})` });
  const amountPaise = campaign.payment?.amountPaise || toPaise(campaign.snapshot.price);
  const intent = await paymentService.createOrderIntent({
    amount: amountPaise,
    receipt: `promo_${campaign._id.toString()}`.slice(0, 40),
  });
  campaign.payment = {
    razorpayOrderId: intent.id,
    amountPaise,
    mode: (intent as any).mode || paymentService.mode(),
  };
  await campaign.save();
  res.json({
    campaignId: campaign._id,
    campaign,
    razorpayOrderId: intent.id,
    amount: intent.amount,
    currency: intent.currency,
    keyId: intent.keyId,
    mode: campaign.payment.mode,
    checkoutPath: `/api/promos/checkout/${intent.id}`,
  });
};

// ---------- customer: featured + tracking ----------

/** Sponsored carousel: live campaigns for eligible restaurants, ranked (priority → fair rotation). */
export const featured = async (_req: any, res: Response) => {
  const now = new Date();
  const campaigns: any[] = await PromoCampaign.find(liveFilter(now))
    .populate({ path: 'restaurantId' })
    .sort({ createdAt: -1 })
    .limit(50);
  const eligible = campaigns.filter((c: any) => {
    const r = c.restaurantId;
    return r && !(r as any).isDeleted && (r as any).isActive && (r as any).isOpen && (r as any).approvalStatus === 'approved';
  });
  res.json(rankSponsored(eligible).map(campaignCard));
};

/** Batch impression/click beacons from the customer app. Only live campaigns count. */
export const trackEvents = async (req: AuthRequest, res: Response) => {
  const events: Array<{ campaignId: string; type: string }> = Array.isArray(req.body?.events) ? req.body.events.slice(0, 100) : [];
  if (!events.length) return res.status(400).json({ message: 'events array required (max 100)' });
  const now = new Date();
  const ids = [...new Set(events.map((e) => String(e.campaignId || '')).filter(Boolean))];
  const live: any[] = await PromoCampaign.find({ _id: { $in: ids }, ...liveFilter(now) }).select('_id restaurantId');
  const liveById = new Map(live.map((c: any) => [c._id.toString(), c]));
  const docs: any[] = [];
  for (const e of events) {
    const c: any = liveById.get(String(e.campaignId));
    if (!c || !['impression', 'click'].includes(e.type)) continue;
    docs.push({ campaignId: c._id, restaurantId: c.restaurantId, type: e.type });
  }
  if (docs.length) {
    await PromoEvent.insertMany(docs, { ordered: false }).catch(() => {});
    const inc: Record<string, { impressions: number; clicks: number }> = {};
    for (const d of docs) {
      const k = d.campaignId.toString();
      inc[k] = inc[k] || { impressions: 0, clicks: 0 };
      if (d.type === 'impression') inc[k].impressions += 1;
      else inc[k].clicks += 1;
    }
    await Promise.all(
      Object.entries(inc).map(([id, v]) =>
        PromoCampaign.updateOne({ _id: id }, { $inc: { 'metrics.impressions': v.impressions, 'metrics.clicks': v.clicks } })
      )
    );
  }
  res.json({ recorded: docs.length });
};

// ---------- admin ----------

export const adminListPackages = async (_req: AuthRequest, res: Response) => {
  res.json(await PromoPackage.find().sort({ createdAt: -1 }));
};

export const adminCreatePackage = async (req: AuthRequest, res: Response) => {
  const { name, description, durationDays, price, priority } = req.body || {};
  if (!name || !Number(durationDays) || durationDays < 1 || durationDays > 365)
    return res.status(400).json({ message: 'name + durationDays (1–365) required' });
  if (!(Number(price) >= 0)) return res.status(400).json({ message: 'price (₹) required' });
  const pkg = await PromoPackage.create({
    name: String(name).slice(0, 100),
    description: String(description || '').slice(0, 500) || undefined,
    durationDays: Number(durationDays),
    price: Number(price),
    priority: Number(priority) || 0,
  });
  res.status(201).json(pkg);
};

export const adminUpdatePackage = async (req: AuthRequest, res: Response) => {
  const pkg: any = await PromoPackage.findById(req.params.id);
  if (!pkg) return res.status(404).json({ message: 'Package not found' });
  const { name, description, durationDays, price, priority, isActive } = req.body || {};
  if (name !== undefined) pkg.name = String(name).slice(0, 100);
  if (description !== undefined) pkg.description = String(description).slice(0, 500);
  if (durationDays !== undefined) {
    if (!Number(durationDays) || durationDays < 1 || durationDays > 365)
      return res.status(400).json({ message: 'durationDays must be 1–365' });
    pkg.durationDays = Number(durationDays);
  }
  if (price !== undefined) {
    if (!(Number(price) >= 0)) return res.status(400).json({ message: 'Invalid price' });
    pkg.price = Number(price);
  }
  if (priority !== undefined) pkg.priority = Number(priority) || 0;
  if (isActive !== undefined) pkg.isActive = !!isActive;
  await pkg.save();
  res.json(pkg);
};

export const adminListCampaigns = async (req: AuthRequest, res: Response) => {
  const filter: any = {};
  if (req.query.status) filter.status = req.query.status;
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
  const [total, data] = await Promise.all([
    PromoCampaign.countDocuments(filter),
    PromoCampaign.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: 'restaurantId', select: 'name image' })
      .populate({ path: 'ownerId', select: 'name email' }),
  ]);
  res.json({ data, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
};

export const adminCampaignDetail = async (req: AuthRequest, res: Response) => {
  const campaign: any = await PromoCampaign.findById(req.params.id)
    .populate({ path: 'restaurantId', select: 'name image address isActive isOpen approvalStatus' })
    .populate({ path: 'ownerId', select: 'name email phone' });
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
  res.json({ campaign, analytics: await campaignAnalytics(campaign) });
};

/** Approve: starts now (active) or later (scheduled). Reject: paid → gateway refund. */
export const adminDecideCampaign = async (req: AuthRequest, res: Response) => {
  const { action, note, startDate } = req.body || {};
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ message: 'action must be approve|reject' });
  const campaign: any = await PromoCampaign.findById(req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
  if (!['awaiting_approval'].includes(campaign.status))
    return res.status(400).json({ message: `Only awaiting_approval campaigns can be decided (now ${campaign.status})` });

  if (action === 'reject') {
    if (!String(note || '').trim()) return res.status(400).json({ message: 'A reason is required to reject' });
    campaign.status = 'rejected';
    campaign.approval = { status: 'rejected', by: req.user!.id, at: new Date(), note: String(note).slice(0, 500) };
    if (campaign.payment?.razorpayPaymentId) {
      try {
        const r = await paymentService.createRefund(campaign.payment.razorpayPaymentId, campaign.payment.amountPaise, {
          campaignId: campaign._id.toString(),
          reason: 'promo rejected by admin',
        });
        campaign.refund = { refundId: r.id, status: r.status, at: new Date(), reason: 'rejected by admin' };
      } catch (e: any) {
        campaign.refund = { status: 'failed', at: new Date(), reason: String(e.message || 'refund failed').slice(0, 500) };
      }
    }
    await campaign.save();
    return res.json({ message: 'Campaign rejected' + (campaign.refund?.refundId ? ' and refunded' : ''), campaign });
  }

  const start = startDate ? new Date(startDate) : new Date();
  if (Number.isNaN(start.getTime())) return res.status(400).json({ message: 'Invalid startDate' });
  const end = new Date(start.getTime() + campaign.snapshot.durationDays * 24 * 60 * 60 * 1000);
  campaign.schedule = { startDate: start, endDate: end };
  campaign.status = start.getTime() <= Date.now() ? 'active' : 'scheduled';
  campaign.approval = { status: 'approved', by: req.user!.id, at: new Date(), note: String(note || '').slice(0, 500) || undefined };
  await campaign.save();
  res.json({ message: campaign.status === 'active' ? 'Campaign is live' : 'Campaign scheduled', campaign });
};

export const adminPauseCampaign = async (req: AuthRequest, res: Response) => {
  const { paused } = req.body || {};
  const campaign: any = await PromoCampaign.findById(req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
  if (paused && campaign.status !== 'active') return res.status(400).json({ message: 'Only active campaigns can be paused' });
  if (!paused && campaign.status !== 'paused') return res.status(400).json({ message: 'Only paused campaigns can be resumed' });
  campaign.status = paused ? 'paused' : 'active';
  await campaign.save();
  res.json({ message: paused ? 'Campaign paused' : 'Campaign resumed', campaign });
};

/** Periodic sweeper: scheduled → active at start, active → expired at end. */
export async function sweepPromos(now = new Date()) {
  const [activated, expired] = await Promise.all([
    PromoCampaign.updateMany(
      { status: 'scheduled', 'approval.status': 'approved', 'schedule.startDate': { $lte: now } },
      { $set: { status: 'active' } }
    ),
    PromoCampaign.updateMany(
      { status: 'active', 'schedule.endDate': { $lt: now } },
      { $set: { status: 'expired' } }
    ),
  ]);
  return { activated: activated.modifiedCount || 0, expired: expired.modifiedCount || 0 };
}
