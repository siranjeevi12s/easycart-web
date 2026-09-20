import { Router } from 'express';
import { listRestaurants, getRestaurant, createRestaurant, updateRestaurant, myRestaurants } from '../controllers/restaurantController';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.get('/', asyncHandler(listRestaurants));
router.get('/my', authenticate, asyncHandler(myRestaurants));
router.get('/:id', asyncHandler(getRestaurant));
router.post('/', authenticate, authorize('restaurant', 'admin'), asyncHandler(createRestaurant));
router.put('/:id', authenticate, asyncHandler(updateRestaurant));
export default router;
