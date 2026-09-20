import { Router } from 'express';
import { createPaymentIntent, verifyPayment, webhook } from '../controllers/paymentController';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.post('/create', authenticate, asyncHandler(createPaymentIntent));
router.post('/verify', authenticate, asyncHandler(verifyPayment));
router.post('/webhook', asyncHandler(webhook));
export default router;
