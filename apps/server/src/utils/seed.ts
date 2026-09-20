import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db';
import { User } from '../models/User';
import { Restaurant } from '../models/Restaurant';
import { MenuItem } from '../models/MenuItem';

const seed = async () => {
  await connectDB();
  await User.deleteMany({});
  await Restaurant.deleteMany({});
  await MenuItem.deleteMany({});

  const pw = await bcrypt.hash('password123', 10);

  const admin = await User.create({ name: 'Admin', email: 'admin@easycart.local', passwordHash: pw, role: 'admin' });
  const customer = await User.create({ name: 'Aarav Sharma', email: 'customer@test.com', passwordHash: pw, role: 'customer', phone: '9876543210' });
  const owner = await User.create({ name: 'Raj Patel', email: 'restaurant@test.com', passwordHash: pw, role: 'restaurant', phone: '9876543211' });

  const r1 = await Restaurant.create({
    ownerId: owner._id,
    name: 'Spice Paradise',
    description: 'Authentic North Indian & Mughlai cuisine — order before you arrive, pick up without waiting.',
    address: 'MG Road, Pune, Maharashtra 411001',
    phone: '9876500001',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600',
    isOpen: true,
    isActive: true,
    rating: 4.6,
  });
  const r2 = await Restaurant.create({
    ownerId: owner._id,
    name: 'Burger Hub',
    description: 'Gourmet burgers, fries & shakes — ready when you are.',
    address: 'FC Road, Pune, Maharashtra 411005',
    phone: '9876500002',
    image: 'https://images.unsplash.com/photo-1555992336-03a8a9d25667?w=600',
    isOpen: true,
    isActive: true,
    rating: 4.4,
  });
  const r3 = await Restaurant.create({
    ownerId: owner._id,
    name: 'Sushi Zen',
    description: 'Fresh sushi & Asian delights. Pre-order for instant pickup.',
    address: 'Koregaon Park, Pune 411001',
    phone: '9876500003',
    image: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=600',
    isOpen: false,
    isActive: true,
    rating: 4.8,
  });

  await MenuItem.insertMany([
    { restaurantId: r1._id, name: 'Chicken Burger', description: 'Grilled chicken patty, lettuce, mayo', price: 180, category: 'Burgers', image: 'https://images.unsplash.com/photo-1568909344668-6f14a07b56a0?w=400', isAvailable: true },
    { restaurantId: r1._id, name: 'Paneer Tikka', description: 'Cottage cheese marinated in spices', price: 220, category: 'Starters', image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400', isAvailable: true },
    { restaurantId: r1._id, name: 'Butter Chicken', description: 'Creamy tomato gravy with chicken', price: 280, category: 'Mains', image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400', isAvailable: true },
    { restaurantId: r2._id, name: 'Classic Veg Burger', description: 'Crispy veg patty with cheese', price: 149, category: 'Burgers', image: 'https://images.unsplash.com/photo-1520072959219-c595dc870360?w=400', isAvailable: true },
    { restaurantId: r2._id, name: 'French Fries', description: 'Golden crispy fries with salt', price: 99, category: 'Sides', image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400', isAvailable: true },
    { restaurantId: r2._id, name: 'Coke 300ml', description: 'Chilled Coke', price: 40, category: 'Drinks', image: 'https://images.unsplash.com/photo-1624552184280-9e9631bbeee9?w=400', isAvailable: false },
    { restaurantId: r2._id, name: 'Chicken Wings', description: 'Spicy BBQ chicken wings (6 pcs)', price: 199, category: 'Starters', image: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=400', isAvailable: true },
  ]);

  console.log('Seed done');
  console.log({ admin: admin.email, customer: customer.email, owner: owner.email, password: 'password123' });
  console.log({ r1: r1._id.toString(), r2: r2._id.toString() });
  process.exit(0);
};

seed();
