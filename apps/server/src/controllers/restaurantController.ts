import { Response } from 'express';
import { AuthRequest } from '../types';
import { Restaurant } from '../models/Restaurant';

export const listRestaurants = async (req: AuthRequest, res: Response) => {
  const { search, open } = req.query as any;
  const filter: any = { isActive: true };
  if (search) filter.$text = { $search: search };
  if (open === 'true') filter.isOpen = true;
  // For customers only active restaurants; for admin show all but filtered above
  const restaurants = await Restaurant.find(filter).sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 });
  res.json(restaurants);
};

export const getRestaurant = async (req: AuthRequest, res: Response) => {
  const r = await Restaurant.findById(req.params.id);
  if (!r) return res.status(404).json({ message: 'Restaurant not found' });
  res.json(r);
};

export const createRestaurant = async (req: AuthRequest, res: Response) => {
  const { name, description, address, phone, image } = req.body;
  if (!name || !address) return res.status(400).json({ message: 'Name and address required' });
  // one owner can have multiple? allow one for simplicity check
  const restaurant = await Restaurant.create({
    ownerId: req.user!.id,
    name,
    description,
    address,
    phone,
    image: image || undefined,
  });
  res.status(201).json(restaurant);
};

export const updateRestaurant = async (req: AuthRequest, res: Response) => {
  const r = await Restaurant.findById(req.params.id);
  if (!r) return res.status(404).json({ message: 'Not found' });
  if (r.ownerId.toString() !== req.user!.id && req.user!.role !== 'admin')
    return res.status(403).json({ message: 'Forbidden' });
  Object.assign(r, req.body);
  await r.save();
  res.json(r);
};

export const myRestaurants = async (req: AuthRequest, res: Response) => {
  const list = await Restaurant.find({ ownerId: req.user!.id });
  res.json(list);
};
