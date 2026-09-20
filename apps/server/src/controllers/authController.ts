import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { validationResult } from 'express-validator';
import { User } from '../models/User';
import { signToken } from '../utils/jwt';

export const register = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  let { name, email, phone, avatarUrl, password, role } = req.body;
  if (role === 'admin') return res.status(403).json({ message: 'Admin registration not allowed' });
  if (!['customer', 'restaurant'].includes(role)) role = 'customer';
  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ message: 'Email already registered' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, phone, avatarUrl: avatarUrl || '', passwordHash, role });
  const token = signToken({ id: user._id.toString(), role: user.role });
  res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone, avatarUrl: user.avatarUrl, role: user.role } });
};

export const login = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  const token = signToken({ id: user._id.toString(), role: user.role });
  res.json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone, avatarUrl: user.avatarUrl, role: user.role } });
};

export const me = async (req: any, res: Response) => {
  const user = await User.findById(req.user.id).select('-passwordHash');
  res.json(user);
};

export const updateMe = async (req: any, res: Response) => {
  const { name, phone, avatarUrl } = req.body;
  if (name !== undefined && (!name || name.trim().length < 2)) return res.status(400).json({ message: 'Name must be at least 2 characters' });
  if (phone !== undefined && phone && !/^\+?[0-9\s\-()]{7,20}$/.test(phone)) return res.status(400).json({ message: 'Invalid phone number' });
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (name !== undefined) user.name = name.trim();
  if (phone !== undefined) user.phone = phone.trim();
  if (avatarUrl !== undefined) (user as any).avatarUrl = avatarUrl.trim();
  await user.save();
  const safe = await User.findById(user._id).select('-passwordHash');
  res.json(safe);
};

export const changePassword = async (req: any, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Current and new password required' });
  if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return res.status(400).json({ message: 'Current password incorrect' });
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ message: 'Password updated' });
};
