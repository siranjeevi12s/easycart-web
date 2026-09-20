import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest, OrderStatus } from '../types';
import { orderService } from '../services/orderService';
import { Order } from '../models/Order';
import { Restaurant } from '../models/Restaurant';
import { getIO } from '../sockets';
import QRCode from 'qrcode';

const getId = (v: any): string => (v?._id ? v._id.toString() : v?.toString());
const isValidId = (id: string) => mongoose.isValidObjectId(id);

export const createOrder = async (req: AuthRequest, res: Response) => {
  const { restaurantId, items } = req.body;
  if (!restaurantId || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ message: 'restaurantId and items required' });
  if (!isValidId(restaurantId)) return res.status(400).json({ message: 'Invalid restaurantId' });
  for (const it of items) if (!isValidId(it.menuItemId)) return res.status(400).json({ message: 'Invalid menuItemId' });
  const order = await orderService.createOrder(req.user!.id, restaurantId, items);
  res.status(201).json(order);
};

export const listOrders = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const role = req.user!.role;
  let filter: any = {};
  if (role === 'customer') filter.customerId = userId;
  else if (role === 'restaurant') {
    const myRestaurants = await Restaurant.find({ ownerId: userId }).select('_id');
    const ids = myRestaurants.map((r) => r._id);
    filter.restaurantId = { $in: ids };
  }
  // admin sees all
  if (req.query.status) filter.orderStatus = req.query.status;
  const orders = await Order.find(filter).sort({ createdAt: -1 }).populate('restaurantId customerId');
  res.json(orders);
};

export const getOrder = async (req: AuthRequest, res: Response) => {
  if (!isValidId(req.params.id as string)) return res.status(400).json({ message: 'Invalid order id' });
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Not found' });
  // ownership check BEFORE populate (avoids populated-doc toString bug)
  if (req.user!.role === 'customer' && getId(order.customerId) !== req.user!.id)
    return res.status(403).json({ message: 'Forbidden' });
  if (req.user!.role === 'restaurant') {
    const rest = await Restaurant.findById(order.restaurantId);
    if (!rest || rest.ownerId.toString() !== req.user!.id) return res.status(403).json({ message: 'Forbidden' });
  }
  await order.populate('restaurantId customerId');
  res.json(order);
};

export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
  const { status } = req.body as { status: OrderStatus };
  if (!status) return res.status(400).json({ message: 'status required' });
  if (status === 'PICKED_UP') return res.status(400).json({ message: 'Use /pickup endpoint with orderNumber/QR verification — PICKED_UP requires customer code' });
  if (!isValidId(req.params.id as string)) return res.status(400).json({ message: 'Invalid order id' });
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Not found' });

  // Restaurant can do ACCEPTED -> PREPARING -> READY -> PICKED_UP ; customer cannot change except cancel? For MVP only restaurant
  if (req.user!.role === 'restaurant') {
    const restaurant = await Restaurant.findById(order.restaurantId);
    if (!restaurant || restaurant.ownerId.toString() !== req.user!.id)
      return res.status(403).json({ message: 'Forbidden: not your order' });
  } else if (req.user!.role === 'customer') {
    // customer can only cancel pending? Restrict
    if (status !== 'CANCELLED') return res.status(403).json({ message: 'Customers can only cancel' });
    if (getId(order.customerId) !== req.user!.id) return res.status(403).json({ message: 'Forbidden' });
  } else if (req.user!.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: insufficient role' });
  }

  const updated = await orderService.transitionOrder(req.params.id as string, status, { id: req.user!.id, role: req.user!.role });

  // Socket emit on READY
  if (status === 'READY') {
    try {
      const io = getIO();
      io.to(`customer:${getId(updated.customerId)}`).emit('order:ready', updated);
      io.to(`restaurant:${getId(updated.restaurantId)}`).emit('order:update', updated);
      io.to(`order:${updated._id.toString()}`).emit('order:update', updated);
    } catch {}
  } else {
    try {
      const io = getIO();
      io.to(`order:${updated._id.toString()}`).emit('order:update', updated);
      io.to(`customer:${getId(updated.customerId)}`).emit('order:update', updated);
    } catch {}
  }

  res.json(updated);
};

export const pickupOrder = async (req: AuthRequest, res: Response) => {
  // POST /api/orders/:id/pickup { orderNumber, qrData, code } — requires customer unique code
  if (!isValidId(req.params.id as string)) return res.status(400).json({ message: 'Invalid order id' });
  const { orderNumber, qrData, code } = req.body;
  const providedCode = qrData || code || orderNumber;
  if (!providedCode) return res.status(400).json({ message: 'Order number or QR code required — customer must present unique #FD-xxxx' });
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Not found' });
  const restaurant = await Restaurant.findById(order.restaurantId);
  if (!restaurant || restaurant.ownerId.toString() !== req.user!.id)
    return res.status(403).json({ message: 'Forbidden' });

  // Verify customer unique code — supports plain #FD-xxxx or QR JSON {orderId, orderNumber}
  let verified = false;
  const trimmed = String(providedCode).trim();
  if (trimmed === order.orderNumber) verified = true;
  else {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.orderNumber === order.orderNumber && parsed.orderId === order._id.toString()) verified = true;
      else if (parsed.orderNumber === order.orderNumber) verified = true;
    } catch {}
  }
  if (!verified) return res.status(400).json({ message: `Invalid code — expected ${order.orderNumber} for this order` });

  // Enforce via service (checks READY, PAID, not already picked up)
  const updated = await orderService.transitionOrder(order._id.toString(), 'PICKED_UP', { id: req.user!.id, role: req.user!.role });

  try {
    const io = getIO();
    io.to(`order:${updated._id.toString()}`).emit('order:update', updated);
    io.to(`customer:${getId(updated.customerId)}`).emit('order:picked_up', updated);
  } catch {}

  res.json(updated);
};

// QR code generation endpoint
export const getOrderQR = async (req: AuthRequest, res: Response) => {
  if (!isValidId(req.params.id as string)) return res.status(400).json({ message: 'Invalid order id' });
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Not found' });
  // restaurant can only get QR for own orders
  if (req.user!.role === 'customer' && getId(order.customerId) !== req.user!.id)
    return res.status(403).json({ message: 'Forbidden' });
  if (req.user!.role === 'restaurant') {
    const rest = await Restaurant.findById(order.restaurantId);
    if (!rest || rest.ownerId.toString() !== req.user!.id) return res.status(403).json({ message: 'Forbidden' });
  }
  const data = JSON.stringify({ orderId: order._id.toString(), orderNumber: order.orderNumber });
  try {
    const url = await QRCode.toDataURL(data);
    res.json({ data, qrDataUrl: url, orderNumber: order.orderNumber });
  } catch {
    res.json({ data, orderNumber: order.orderNumber });
  }
};
