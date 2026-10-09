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
    const user = await User.findById(payload.id).select('email role isDeleted isSuspended');
    if (!user || user.isDeleted) return res.status(401).json({ message: 'Unauthorized: Account removed' });
    if (user.isSuspended) return res.status(403).json({ message: 'Account suspended — contact support' });
    // Role comes from the DATABASE, never from the token payload — a role change
    // (e.g. demotion) takes effect immediately instead of living on in old tokens.
    // NOTE: no per-request writes here (lastLoginAt is updated at login only) —
    // a DB write on every authenticated call is pure write amplification.
    req.user = { id: payload.id, role: user.role, email: user.email };
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
  }
};

export const authorize = (...roles: UserRole[]) => (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden: insufficient role' });
  next();
};