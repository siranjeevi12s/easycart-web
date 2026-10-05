import { Router } from 'express';
import {
  listRestaurants,
  getRestaurant,
  createRestaurant,
  updateRestaurant,
  myRestaurants,
  getPayoutDetails,
  updatePayoutDetails,
  getPublicPaymentInfo,
  listSettlements,
  markSettled,
  createRouteAccount,
} from '../controllers/restaurantController';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.get('/', asyncHandler(listRestaurants));
router.get('/my', authenticate, asyncHandler(myRestaurants));
// Payout / payment-details collection — must be before /:id to avoid clash? :id routes use exact segments so order safe,
// but keep specific routes first for clarity.
router.get('/:id/payment-info', asyncHandler(getPublicPaymentInfo));
router.get('/:id/payout', authenticate, asyncHandler(getPayoutDetails));
router.put('/:id/payout', authenticate, authorize('restaurant', 'admin'), asyncHandler(updatePayoutDetails));
router.post('/:id/route-account', authenticate, authorize('restaurant', 'admin'), asyncHandler(createRouteAccount));
router.get('/:id/settlements', authenticate, asyncHandler(listSettlements));
router.patch('/:id/settlements/:orderId', authenticate, authorize('restaurant', 'admin'), asyncHandler(markSettled));
router.get('/:id', asyncHandler(getRestaurant));
router.post('/', authenticate, authorize('restaurant', 'admin'), asyncHandler(createRestaurant));
router.put('/:id', authenticate, authorize('restaurant', 'admin'), asyncHandler(updateRestaurant));
export default router;
