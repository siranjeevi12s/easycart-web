import { Response } from 'express';
import { AuthRequest } from '../types';
import { MenuItem } from '../models/MenuItem';
import { Restaurant } from '../models/Restaurant';

export const getMenu = async (req: AuthRequest, res: Response) => {
  const items = await MenuItem.find({ restaurantId: req.params.restaurantId, isDeleted: { $ne: true } }).sort({ category: 1, name: 1 });
  res.json(items);
};

// Only these fields may be set by owners/admins. restaurantId comes from the
// URL (create) or is immutable (update); isDeleted changes only via DELETE;
// _id/__v/timestamps are never client-writable.
const MENU_WRITABLE = ['name', 'description', 'price', 'image', 'category', 'isAvailable'] as const;

function pickMenuFields(body: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of MENU_WRITABLE) {
    if (body?.[key] !== undefined) out[key] = body[key];
  }
  return out;
}

export const addMenuItem = async (req: AuthRequest, res: Response) => {
  const { restaurantId } = req.params;
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
  if (restaurant.isDeleted) return res.status(404).json({ message: 'Restaurant removed' });
  if (restaurant.ownerId.toString() !== req.user!.id && req.user!.role !== 'admin')
    return res.status(403).json({ message: 'Forbidden' });
  // NOTE: fields picked BEFORE restaurantId is set, so a restaurantId in the
  // body can never override the URL param and inject items into another restaurant.
  const item = await MenuItem.create({ ...pickMenuFields(req.body), restaurantId });
  res.status(201).json(item);
};

export const updateMenuItem = async (req: AuthRequest, res: Response) => {
  const item = await MenuItem.findById(req.params.itemId);
  if (!item) return res.status(404).json({ message: 'Not found' });
  if (item.isDeleted) return res.status(404).json({ message: 'Item removed' });
  const restaurant = await Restaurant.findById(item.restaurantId);
  if (restaurant && restaurant.ownerId.toString() !== req.user!.id && req.user!.role !== 'admin')
    return res.status(403).json({ message: 'Forbidden' });
  // restaurantId/isDeleted intentionally dropped: items cannot be moved across
  // restaurants or (un)deleted through this endpoint.
  Object.assign(item, pickMenuFields(req.body));
  await item.save();
  res.json(item);
};

export const deleteMenuItem = async (req: AuthRequest, res: Response) => {
  const item = await MenuItem.findById(req.params.itemId);
  if (!item) return res.status(404).json({ message: 'Not found' });
  if (item.isDeleted) return res.status(404).json({ message: 'Already removed' });
  const restaurant = await Restaurant.findById(item.restaurantId);
  if (restaurant && restaurant.ownerId.toString() !== req.user!.id && req.user!.role !== 'admin')
    return res.status(403).json({ message: 'Forbidden' });
  item.isDeleted = true;
  await item.save();
  res.json({ message: 'Soft deleted' });
};