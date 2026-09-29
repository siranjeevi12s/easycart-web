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
  const { restaurantId, items, paymentMethod } = req.body;
  if (!restaurantId || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ message: 'restaurantId and items required' });
  if (!isValidId(restaurantId)) return res.status(400).json({ message: 'Invalid restaurantId' });
  for (const it of items) if (!isValidId(it.menuItemId)) return res.status(400).json({ message: 'Invalid menuItemId' });
  const order = await orderService.createOrder(req.user!.id, restaurantId, items, paymentMethod);
  res.status(201).json(order);
};

export const listOrders = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const role = req.user!.role;
  let filter: any = { isDeleted: false };
  if (role === 'customer') filter.customerId = userId;
  else if (role === 'restaurant') {
    const myRestaurants = await Restaurant.find({ ownerId: userId, isDeleted: false }).select('_id');
    const ids = myRestaurants.map((r) => r._id);
    filter.restaurantId = { $in: ids };
  }
  if (req.query.status) filter.orderStatus = req.query.status;
  const orders = await Order.find(filter).sort({ createdAt: -1 }).populate('restaurantId customerId');
  res.json(orders);
};

export const getOrder = async (req: AuthRequest, res: Response) => {
  if (!isValidId(req.params.id as string)) return res.status(400).json({ message: 'Invalid order id' });
  const order = await Order.findById(req.params.id);
  if (!order || order.isDeleted) return res.status(404).json({ message: 'Not found' });
  if (req.user!.role === 'customer' && getId(order.customerId) !== req.user!.id)
    return res.status(403).json({ message: 'Forbidden' });
  if (req.user!.role === 'restaurant') {
    const rest = await Restaurant.findById(order.restaurantId);
    if (!rest || rest.ownerId.toString() !== req.user!.id || rest.isDeleted) return res.status(403).json({ message: 'Forbidden' });
  }
  await order.populate('restaurantId customerId');
  res.json(order);
};

export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
  const { status, reason } = req.body as { status: OrderStatus; reason?: string };
  if (!status) return res.status(400).json({ message: 'status required' });
  if (status === 'PICKED_UP') return res.status(400).json({ message: 'Use /pickup endpoint with orderNumber/QR verification' });
  if (!isValidId(req.params.id as string)) return res.status(400).json({ message: 'Invalid order id' });
  const order = await Order.findById(req.params.id);
  if (!order || order.isDeleted) return res.status(404).json({ message: 'Not found' });

  if (req.user!.role === 'restaurant') {
    const restaurant = await Restaurant.findById(order.restaurantId);
    if (!restaurant || restaurant.ownerId.toString() !== req.user!.id || restaurant.isDeleted)
      return res.status(403).json({ message: 'Forbidden: not your order' });
  } else if (req.user!.role === 'customer') {
    if (status !== 'CANCELLED') return res.status(403).json({ message: 'Customers can only cancel' });
    if (getId(order.customerId) !== req.user!.id) return res.status(403).json({ message: 'Forbidden' });
  } else if (req.user!.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: insufficient role' });
  }

  const updated = await orderService.transitionOrder(req.params.id as string, status, { id: req.user!.id, role: req.user!.role }, reason);

  // Cancelling a PAID order must return the customer's money: best-effort
  // gateway refund. Refund failure never blocks cancellation itself.
  let refundNote: string | undefined;
  if (status === 'CANCELLED' && updated.paymentStatus === 'PAID' && updated.paymentId) {
    try {
      const { paymentService } = await import('../services/paymentService');
      const { toPaise } = await import('../utils/commission');
      const { id: refundId, status: refundStatus } = await paymentService.createRefund(
        updated.paymentId,
        toPaise(updated.totalAmount),
        { orderId: updated._id.toString(), reason: reason || 'order cancelled' }
      );
      updated.paymentStatus = 'REFUNDED';
      updated.refundId = refundId;
      updated.refundStatus = refundStatus;
      updated.refundedAt = new Date();
      await updated.save();
      const { Payment } = await import('../models/Payment');
      await Payment.findOneAndUpdate(
        { razorpayOrderId: updated.razorpayOrderId },
        { $set: { status: 'REFUNDED', refundId, refundStatus } }
      );
      const { Settlement } = await import('../models/Settlement');
      await Settlement.findOneAndUpdate(
        { orderId: updated._id },
        { $set: { status: 'REVERSED', settlementRef: refundId } }
      );
      refundNote = `Refund ${refundId} initiated`;
    } catch (e: any) {
      refundNote = `Refund attempt failed (${e.message}) — ops must refund manually`;
      console.error('[orderController] auto-refund failed:', e?.message || e);
    }
  }

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

  res.json(refundNote ? { ...updated.toObject(), refundNote } : updated);
};

export const pickupOrder = async (req: AuthRequest, res: Response) => {
  if (!isValidId(req.params.id as string)) return res.status(400).json({ message: 'Invalid order id' });
  const { orderNumber, qrData, code } = req.body;
  const providedCode = qrData || code || orderNumber;
  if (!providedCode) return res.status(400).json({ message: 'Order number or QR code required — customer must present unique #FD-xxxx' });
  const order = await Order.findById(req.params.id);
  if (!order || order.isDeleted) return res.status(404).json({ message: 'Not found' });
  const restaurant = await Restaurant.findById(order.restaurantId);
  if (!restaurant || restaurant.ownerId.toString() !== req.user!.id || restaurant.isDeleted)
    return res.status(403).json({ message: 'Forbidden' });

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

  const updated = await orderService.transitionOrder(order._id.toString(), 'PICKED_UP', { id: req.user!.id, role: req.user!.role });

  try {
    const io = getIO();
    io.to(`order:${updated._id.toString()}`).emit('order:update', updated);
    io.to(`customer:${getId(updated.customerId)}`).emit('order:picked_up', updated);
  } catch {}

  res.json(updated);
};

export const getOrderQR = async (req: AuthRequest, res: Response) => {
  if (!isValidId(req.params.id as string)) return res.status(400).json({ message: 'Invalid order id' });
  const order = await Order.findById(req.params.id);
  if (!order || order.isDeleted) return res.status(404).json({ message: 'Not found' });
  if (req.user!.role === 'customer' && getId(order.customerId) !== req.user!.id)
    return res.status(403).json({ message: 'Forbidden' });
  if (req.user!.role === 'restaurant') {
    const rest = await Restaurant.findById(order.restaurantId);
    if (!rest || rest.ownerId.toString() !== req.user!.id || rest.isDeleted) return res.status(403).json({ message: 'Forbidden' });
  }
  const data = JSON.stringify({ orderId: order._id.toString(), orderNumber: order.orderNumber });
  try {
    const url = await QRCode.toDataURL(data);
    res.json({ data, qrDataUrl: url, orderNumber: order.orderNumber });
  } catch {
    res.json({ data, orderNumber: order.orderNumber });
  }
};