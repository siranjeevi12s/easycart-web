import { Router } from 'express';
import {
  createPaymentIntent,
  verifyPayment,
  webhook,
  checkoutPage,
  paymentReturn,
  reportFailure,
  cancelUnpaid,
  paymentStatus,
  batchStatus,
  refundPayment,
} from '../controllers/paymentController';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
// Hosted checkout pages — public (unguessable gateway order ids, no secrets inside)
router.get('/checkout/:rzpOrderId', asyncHandler(checkoutPage));
router.get('/return', asyncHandler(paymentReturn));
// Webhooks stay public (gateways have no JWT); HMAC-verified inside
router.post('/webhook', asyncHandler(webhook));

router.post('/create', authenticate, asyncHandler(createPaymentIntent));
router.post('/verify', authenticate, asyncHandler(verifyPayment));
router.post('/fail', authenticate, asyncHandler(reportFailure));
router.post('/cancel', authenticate, asyncHandler(cancelUnpaid));
router.get('/status/:orderId', authenticate, asyncHandler(paymentStatus));
router.get('/batch/:batchId', authenticate, asyncHandler(batchStatus));
router.post('/refund', authenticate, asyncHandler(refundPayment));
export default router;
