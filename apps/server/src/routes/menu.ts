import { Router } from 'express';
import { getMenu, addMenuItem, updateMenuItem, deleteMenuItem } from '../controllers/menuController';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.get('/restaurants/:restaurantId/menu', asyncHandler(getMenu));
router.post('/restaurants/:restaurantId/menu', authenticate, asyncHandler(addMenuItem));
router.put('/menu/:itemId', authenticate, asyncHandler(updateMenuItem));
router.delete('/menu/:itemId', authenticate, asyncHandler(deleteMenuItem));
export default router;
