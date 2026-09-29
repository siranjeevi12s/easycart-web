import { Router } from 'express';
import { register, login, me, updateMe, changePassword, refreshToken } from '../controllers/authController';
import { registerValidator, loginValidator } from '../validators/auth';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.post('/register', registerValidator, asyncHandler(register));
router.post('/login', loginValidator, asyncHandler(login));
router.get('/me', authenticate, asyncHandler(me));
router.put('/me', authenticate, asyncHandler(updateMe));
router.post('/change-password', authenticate, asyncHandler(changePassword));
router.post('/refresh-token', asyncHandler(refreshToken));
export default router;