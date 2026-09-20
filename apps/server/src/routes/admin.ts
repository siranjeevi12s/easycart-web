import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { User } from '../models/User';
import { Restaurant } from '../models/Restaurant';
import { Order } from '../models/Order';

const router = Router();
router.use(authenticate, authorize('admin'));

router.get('/customers', asyncHandler(async (_req, res) => {
  const users = await User.find({ role: 'customer' }).select('-passwordHash');
  res.json(users);
}));
router.get('/restaurants', asyncHandler(async (_req, res) => {
  const list = await Restaurant.find().populate('ownerId', 'name email');
  res.json(list);
}));
router.patch('/restaurants/:id/toggle', asyncHandler(async (req, res) => {
  const r = await Restaurant.findById(req.params.id);
  if (!r) return res.status(404).json({ message: 'Not found' });
  r.isActive = !r.isActive;
  await r.save();
  res.json(r);
}));
router.get('/orders', asyncHandler(async (_req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 }).limit(100).populate('restaurantId customerId');
  res.json(orders);
}));

export default router;
