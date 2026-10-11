import { Router } from 'express';
import {
  listPackages,
  createPromoCheckout,
  promoCheckoutPage,
  verifyPromoPayment,
  myCampaigns,
  campaignDetail,
  updateCampaign,
  repayCampaign,
  cancelCampaign,
  featured,
  trackEvents,
  adminListPackages,
  adminCreatePackage,
  adminUpdatePackage,
  adminListCampaigns,
  adminCampaignDetail,
  adminDecideCampaign,
  adminPauseCampaign,
} from '../controllers/promoController';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Customer discovery (public) + engagement beacons
router.get('/featured', asyncHandler(featured as any));
router.post('/events', authenticate, asyncHandler(trackEvents));

// Owner: buy + manage (restaurant owners and admins)
router.get('/packages', authenticate, authorize('restaurant', 'admin'), asyncHandler(listPackages));
router.post('/checkout', authenticate, authorize('restaurant', 'admin'), asyncHandler(createPromoCheckout));
router.get('/checkout/:rzpOrderId', asyncHandler(promoCheckoutPage as any));
router.post('/verify', authenticate, authorize('restaurant', 'admin'), asyncHandler(verifyPromoPayment));
router.get('/campaigns', authenticate, authorize('restaurant', 'admin'), asyncHandler(myCampaigns));
router.get('/campaigns/:id', authenticate, authorize('restaurant', 'admin'), asyncHandler(campaignDetail));
router.patch('/campaigns/:id', authenticate, authorize('restaurant'), asyncHandler(updateCampaign));
router.post('/campaigns/:id/repay', authenticate, authorize('restaurant'), asyncHandler(repayCampaign));
router.post('/campaigns/:id/cancel', authenticate, authorize('restaurant'), asyncHandler(cancelCampaign));

// Admin: packages + moderation
router.get('/admin/packages', authenticate, authorize('admin'), asyncHandler(adminListPackages));
router.post('/admin/packages', authenticate, authorize('admin'), asyncHandler(adminCreatePackage));
router.patch('/admin/packages/:id', authenticate, authorize('admin'), asyncHandler(adminUpdatePackage));
router.get('/admin/campaigns', authenticate, authorize('admin'), asyncHandler(adminListCampaigns));
router.get('/admin/campaigns/:id', authenticate, authorize('admin'), asyncHandler(adminCampaignDetail));
router.post('/admin/campaigns/:id/decide', authenticate, authorize('admin'), asyncHandler(adminDecideCampaign));
router.post('/admin/campaigns/:id/pause', authenticate, authorize('admin'), asyncHandler(adminPauseCampaign));

export default router;
