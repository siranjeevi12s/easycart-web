import { Router } from 'express';
import { createOrder, listOrders, getOrder, updateOrderStatus, pickupOrder, getOrderQR } from '../controllers/orderController';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.post('/', authenticate, asyncHandler(createOrder));
router.get('/', authenticate, asyncHandler(listOrders));
router.get('/:id', authenticate, asyncHandler(getOrder));
router.get('/:id/qr', authenticate, asyncHandler(getOrderQR));
router.patch('/:id/status', authenticate, asyncHandler(updateOrderStatus));
router.post('/:id/pickup', authenticate, asyncHandler(pickupOrder));
export default router;
