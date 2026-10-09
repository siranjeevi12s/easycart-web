import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import type { AuthRequest } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Restaurant } from '../models/Restaurant';
import { Order } from '../models/Order';
import { Payment } from '../models/Payment';
import { AuditLog, recordAudit } from '../models/AuditLog';
import { toggleRestaurant } from '../controllers/restaurantController';

const router = Router();
router.use(authenticate, authorize('admin'));

/** Shared paginator: ?page=1&limit=20 (cap 100). Returns { data, page, limit, total, pages }. */
async function paginate(model: any, filter: any, req: any, sort: any = { createdAt: -1 }, populate?: any) {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const [total, docs] = await Promise.all([
    model.countDocuments(filter),
    (() => {
      let q = model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit);
      if (populate) q = q.populate(populate);
      return q;
    })(),
  ]);
  return { data: docs, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}

const searchRx = (s?: string) => (s ? new RegExp(String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null);

// ---------- Customers ----------
router.get('/customers', asyncHandler(async (req, res) => {
  const filter: any = { role: 'customer', isDeleted: { $ne: true } };
  const s = searchRx(req.query.search as string);
  if (s) filter.$or = [{ name: s }, { email: s }];
  if (req.query.status === 'suspended') filter.isSuspended = true;
  if (req.query.status === 'active') filter.isSuspended = { $ne: true };
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from as string);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to as string);
  }
  const out: any = await paginate(User, filter, req);
  out.data = out.data.map((u: any) => ({ ...u.toObject(), passwordHash: undefined, refreshToken: undefined }));
  res.json(out);
}));

// ---------- Owners (with restaurant counts) ----------
router.get('/owners', asyncHandler(async (req, res) => {
  const match: any = { role: 'restaurant', isDeleted: { $ne: true } };
  const s = searchRx(req.query.search as string);
  if (s) match.$or = [{ name: s }, { email: s }];
  if (req.query.status === 'suspended') match.isSuspended = true;
  if (req.query.status === 'active') match.isSuspended = { $ne: true };
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
  const pipeline: any[] = [
    { $match: match },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: 'restaurants',
        let: { oid: '$_id' },
        pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$ownerId', '$$oid'] }, { $ne: ['$isDeleted', true] }] } } }, { $project: { _id: 1, name: 1, approvalStatus: 1, isActive: 1 } }],
        as: 'restaurants',
      },
    },
    { $addFields: { restaurantCount: { $size: '$restaurants' } } },
    {
      $facet: {
        data: [{ $skip: (page - 1) * limit }, { $limit: limit }, { $project: { passwordHash: 0, refreshToken: 0 } }],
        total: [{ $count: 'n' }],
      },
    },
  ];
  const [out] = await User.aggregate(pipeline);
  const total = out?.total?.[0]?.n || 0;
  res.json({ data: out?.data || [], page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
}));

// ---------- Restaurants ----------
router.get('/restaurants', asyncHandler(async (req, res) => {
  const filter: any = { isDeleted: { $ne: true } };
  const s = searchRx(req.query.search as string);
  if (s) filter.$or = [{ name: s }, { address: s }];
  if (req.query.status) filter.approvalStatus = req.query.status;
  if (req.query.active === 'true') filter.isActive = true;
  if (req.query.active === 'false') filter.isActive = false;
  res.json(await paginate(Restaurant, filter, req, { createdAt: -1 }, { path: 'ownerId', select: 'name email' }));
}));

router.patch('/restaurants/:id/toggle', asyncHandler(async (req: AuthRequest, res: Response) => {
  await toggleRestaurant(req as any, res);
  if (res.statusCode < 400) {
    const r = await Restaurant.findById(req.params.id).select('name isActive');
    await recordAudit({ adminId: req.user!.id, adminEmail: req.user!.email, action: 'restaurant.toggle', targetType: 'restaurant', targetId: String(req.params.id), meta: { isActive: r?.isActive } });
  }
}));

const APPROVALS = ['pending', 'under_review', 'approved', 'rejected', 'suspended'];
router.patch('/restaurants/:id/approval', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status, note } = req.body || {};
  if (!APPROVALS.includes(status)) return res.status(400).json({ message: `status must be one of ${APPROVALS.join(', ')}` });
  if ((status === 'rejected' || status === 'suspended') && !String(note || '').trim())
    return res.status(400).json({ message: 'A reason is required to reject or suspend' });
  const r = await Restaurant.findById(req.params.id);
  if (!r || (r as any).isDeleted) return res.status(404).json({ message: 'Restaurant not found' });
  const from = (r as any).approvalStatus || 'pending';
  (r as any).approvalStatus = status;
  (r as any).approvalNote = String(note || '').slice(0, 500) || undefined;
  if (status === 'approved') { (r as any).approvedAt = new Date(); (r as any).approvedBy = req.user!.id; }
  await r.save();
  await recordAudit({
    adminId: req.user!.id, adminEmail: req.user!.email, action: `restaurant.${status}`,
    targetType: 'restaurant', targetId: (r as any)._id.toString(), reason: (r as any).approvalNote,
    meta: { from, to: status, name: (r as any).name },
  });
  res.json(r);
}));

// ---------- Admin users (single-role system) ----------
router.get('/admins', asyncHandler(async (req, res) => {
  const filter: any = { role: 'admin', isDeleted: { $ne: true } };
  const out: any = await paginate(User, filter, req);
  out.data = out.data.map((u: any) => ({ ...u.toObject(), passwordHash: undefined, refreshToken: undefined }));
  res.json(out);
}));

// ---------- Users: suspend / reactivate / create ----------
router.patch('/users/:id/suspend', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { suspend, reason } = req.body || {};
  const u = await User.findById(req.params.id);
  if (!u || (u as any).isDeleted) return res.status(404).json({ message: 'User not found' });
  if (String((u as any)._id) === req.user!.id) return res.status(400).json({ message: 'Cannot suspend yourself' });
  if (suspend && !String(reason || '').trim()) return res.status(400).json({ message: 'A reason is required to suspend' });
  (u as any).isSuspended = !!suspend;
  (u as any).suspendedAt = suspend ? new Date() : undefined;
  (u as any).suspendReason = suspend ? String(reason).slice(0, 500) : undefined;
  if (suspend) (u as any).refreshToken = undefined; // kill sessions immediately
  await u.save();
  await recordAudit({
    adminId: req.user!.id, adminEmail: req.user!.email, action: suspend ? 'user.suspend' : 'user.reactivate',
    targetType: 'user', targetId: (u as any)._id.toString(), reason: (u as any).suspendReason,
    meta: { email: (u as any).email, role: (u as any).role },
  });
  const safe = u.toObject();
  delete (safe as any).passwordHash;
  delete (safe as any).refreshToken;
  res.json(safe);
}));

router.post('/users', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ message: 'name, email, password required' });
  if (!['customer', 'restaurant', 'admin'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
  if (String(password).length < 6) return res.status(400).json({ message: 'Password min 6 chars' });
  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ message: 'Email already registered' });
  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = await User.create({ name, email, phone: req.body.phone || '', passwordHash, role });
  await recordAudit({
    adminId: req.user!.id, adminEmail: req.user!.email, action: 'user.create',
    targetType: 'user', targetId: (user as any)._id.toString(), meta: { email, role },
  });
  const safe = user.toObject();
  delete (safe as any).passwordHash;
  delete (safe as any).refreshToken;
  res.status(201).json(safe);
}));

// ---------- Orders ----------
router.get('/orders', asyncHandler(async (req, res) => {
  const filter: any = { isDeleted: { $ne: true } };
  if (req.query.status) filter.orderStatus = req.query.status;
  if (req.query.payment) filter.paymentStatus = req.query.payment;
  if (req.query.restaurantId) filter.restaurantId = req.query.restaurantId;
  if (req.query.search) filter.orderNumber = searchRx(req.query.search as string);
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from as string);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to as string);
  }
  res.json(
    await paginate(Order, filter, req, { createdAt: -1 }, [
      { path: 'restaurantId', select: 'name' },
      { path: 'customerId', select: 'name email' },
    ])
  );
}));

// ---------- Payments (read-only ledger + refund states) ----------
router.get('/payments', asyncHandler(async (req, res) => {
  const filter: any = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) filter.razorpayPaymentId = searchRx(req.query.search as string);
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from as string);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to as string);
  }
  res.json(
    await paginate(Payment, filter, req, { createdAt: -1 }, [
      { path: 'orderId', select: 'orderNumber totalAmount' },
      { path: 'restaurantId', select: 'name' },
    ])
  );
}));

// ---------- Audit log (read-only) ----------
router.get('/audit', asyncHandler(async (req, res) => {
  const filter: any = {};
  if (req.query.action) filter.action = req.query.action;
  if (req.query.adminId) filter.adminId = req.query.adminId;
  res.json(await paginate(AuditLog, filter, req, { createdAt: -1 }, { path: 'adminId', select: 'name email' }));
}));

// ---------- Dashboard stats ----------
router.get('/stats', asyncHandler(async (_req, res) => {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const [
    customers, activeCustomers, owners, restaurants, pendingApprovals, activeRestaurants, orders, openOrders, gmv, fees,
    ordersByDay, regsByDay, restRegsByDay, statusDist, topRestaurants,
  ] = await Promise.all([
    User.countDocuments({ role: 'customer', isDeleted: { $ne: true } }),
    User.countDocuments({ role: 'customer', isDeleted: { $ne: true }, isSuspended: { $ne: true } }),
    User.countDocuments({ role: 'restaurant', isDeleted: { $ne: true } }),
    Restaurant.countDocuments({ isDeleted: { $ne: true } }),
    Restaurant.countDocuments({ isDeleted: { $ne: true }, approvalStatus: { $in: ['pending', 'under_review'] } }),
    Restaurant.countDocuments({ isDeleted: { $ne: true }, isActive: true, approvalStatus: 'approved' }),
    Order.countDocuments({ isDeleted: { $ne: true } }),
    Order.countDocuments({ isDeleted: { $ne: true }, orderStatus: { $in: ['PAID', 'ACCEPTED', 'PREPARING'] } }),
    Order.aggregate([{ $match: { isDeleted: { $ne: true }, paymentStatus: 'PAID' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Order.aggregate([{ $match: { isDeleted: { $ne: true }, paymentStatus: 'PAID' } }, { $group: { _id: null, total: { $sum: '$platformFee' } } }]),
    Order.aggregate([
      { $match: { isDeleted: { $ne: true }, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 }, gmv: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'PAID'] }, '$totalAmount', 0] } } } },
      { $sort: { _id: 1 } },
    ]),
    User.aggregate([
      { $match: { role: 'customer', createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Restaurant.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([{ $match: { isDeleted: { $ne: true } } }, { $group: { _id: '$orderStatus', n: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { isDeleted: { $ne: true }, paymentStatus: 'PAID' } },
      { $group: { _id: '$restaurantId', gmv: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
      { $sort: { gmv: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'restaurants', localField: '_id', foreignField: '_id', as: 'r' } },
      { $project: { name: { $arrayElemAt: ['$r.name', 0] }, gmv: 1, orders: 1 } },
    ]),
  ]);
  res.json({
    customers, activeCustomers, owners, restaurants, pendingApprovals, activeRestaurants,
    orders, openOrders,
    gmv: gmv[0]?.total || 0,
    platformFees: fees[0]?.total || 0,
    ordersByDay: ordersByDay.map((d) => ({ date: d._id, orders: d.n, gmv: d.gmv })),
    customerRegsByDay: regsByDay.map((d) => ({ date: d._id, count: d.n })),
    restaurantRegsByDay: restRegsByDay.map((d) => ({ date: d._id, count: d.n })),
    statusDist: statusDist.map((d) => ({ status: d._id, count: d.n })),
    topRestaurants,
  });
}));

export default router;
