import { Response } from 'express';
import { AuthRequest } from '../types';
import { MenuItem } from '../models/MenuItem';
import { Restaurant } from '../models/Restaurant';

export const getMenu = async (req: AuthRequest, res: Response) => {
  const items = await MenuItem.find({ restaurantId: req.params.restaurantId, isDeleted: { $ne: true } }).sort({ category: 1, name: 1 });
  res.json(items);
};

export const addMenuItem = async (req: AuthRequest, res: Response) => {
  const { restaurantId } = req.params;
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
  if (restaurant.isDeleted) return res.status(404).json({ message: 'Restaurant removed' });
  if (restaurant.ownerId.toString() !== req.user!.id && req.user!.role !== 'admin')
    return res.status(403).json({ message: 'Forbidden' });
  const item = await MenuItem.create({ restaurantId, ...req.body });
  res.status(201).json(item);
};

export const updateMenuItem = async (req: AuthRequest, res: Response) => {
  const item = await MenuItem.findById(req.params.itemId);
  if (!item) return res.status(404).json({ message: 'Not found' });
  if (item.isDeleted) return res.status(404).json({ message: 'Item removed' });
  const restaurant = await Restaurant.findById(item.restaurantId);
  if (restaurant && restaurant.ownerId.toString() !== req.user!.id && req.user!.role !== 'admin')
    return res.status(403).json({ message: 'Forbidden' });
  Object.assign(item, req.body);
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