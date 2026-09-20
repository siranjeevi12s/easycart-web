import { Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { AuthRequest, UserRole } from '../types';
import { User } from '../models/User';

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized: No token' });
  const token = header.split(' ')[1];
  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.id).select('email role');
    if (!user) return res.status(401).json({ message: 'Unauthorized: User not found' });
    req.user = { id: payload.id, role: payload.role, email: user.email };
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
  }
};

export const authorize = (...roles: UserRole[]) => (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden: insufficient role' });
  next();
};
