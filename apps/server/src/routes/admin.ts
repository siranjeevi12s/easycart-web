import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { User } from '../models/User';
import { Restaurant } from '../models/Restaurant';
import { Order } from '../models/Order';
import { toggleRestaurant } from '../controllers/restaurantController';

const router = Router();
router.use(authenticate, authorize('admin'));

router.get('/customers', asyncHandler(async (_req, res) => {
  const users = await User.find({ role: 'customer', isDeleted: false }).select('-passwordHash');
  res.json(users);
}));
router.get('/restaurants', asyncHandler(async (_req, res) => {
  const list = await Restaurant.find({ isDeleted: false }).populate('ownerId', 'name email');
  res.json(list);
}));
router.patch('/restaurants/:id/toggle', toggleRestaurant);
router.get('/orders', asyncHandler(async (_req, res) => {
  const orders = await Order.find({ isDeleted: false }).sort({ createdAt: -1 }).limit(100).populate('restaurantId customerId');
  res.json(orders);
}));

export default router;