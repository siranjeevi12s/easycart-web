import { Router } from 'express';
import { getMenu, addMenuItem, updateMenuItem, deleteMenuItem } from '../controllers/menuController';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.get('/restaurants/:restaurantId/menu', asyncHandler(getMenu));
router.post('/restaurants/:restaurantId/menu', authenticate, authorize('restaurant', 'admin'), asyncHandler(addMenuItem));
router.put('/menu/:itemId', authenticate, authorize('restaurant', 'admin'), asyncHandler(updateMenuItem));
router.delete('/menu/:itemId', authenticate, authorize('restaurant', 'admin'), asyncHandler(deleteMenuItem));
export default router;
