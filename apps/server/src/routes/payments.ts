import { Router } from 'express';
import {
  createPaymentIntent,
  verifyPayment,
  webhook,
  checkoutPage,
  reportFailure,
  cancelUnpaid,
  paymentStatus,
  refundPayment,
} from '../controllers/paymentController';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
// Hosted Razorpay Checkout page — public (unguessable razorpay order id, public key only)
router.get('/checkout/:rzpOrderId', asyncHandler(checkoutPage));
// Webhook must stay public (Razorpay has no JWT); HMAC-verified inside
router.post('/webhook', asyncHandler(webhook));

router.post('/create', authenticate, asyncHandler(createPaymentIntent));
router.post('/verify', authenticate, asyncHandler(verifyPayment));
router.post('/fail', authenticate, asyncHandler(reportFailure));
router.post('/cancel', authenticate, asyncHandler(cancelUnpaid));
router.get('/status/:orderId', authenticate, asyncHandler(paymentStatus));
router.post('/refund', authenticate, asyncHandler(refundPayment));
export default router;
