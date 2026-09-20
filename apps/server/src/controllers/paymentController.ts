import { Response } from 'express';
import { AuthRequest } from '../types';
import { paymentService } from '../services/paymentService';
import { Order } from '../models/Order';
import { getIO } from '../sockets';

export const createPaymentIntent = async (req: AuthRequest, res: Response) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ message: 'orderId required' });
  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.customerId.toString() !== req.user!.id) return res.status(403).json({ message: 'Forbidden' });
  if (order.paymentStatus === 'PAID') return res.json({ message: 'Already paid', order });

  const amountPaise = Math.round(order.totalAmount * 100);
  const intent = await paymentService.createOrderIntent({ amount: amountPaise, receipt: order.orderNumber });
  order.razorpayOrderId = intent.id;
  await order.save();
  res.json({ razorpayOrderId: intent.id, amount: intent.amount, currency: intent.currency, keyId: intent.keyId, order });
};

export const verifyPayment = async (req: AuthRequest, res: Response) => {
  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
    return res.status(400).json({ message: 'Missing payment fields' });
  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.paymentStatus === 'PAID') return res.json({ message: 'Already verified', order }); // idempotent

  const valid = paymentService.verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
  if (!valid) {
    order.paymentStatus = 'FAILED';
    await order.save();
    return res.status(400).json({ message: 'Payment verification failed' });
  }

  order.paymentStatus = 'PAID';
  order.orderStatus = 'PAID';
  order.paymentId = razorpay_payment_id;
  order.razorpayOrderId = razorpay_order_id;
  await order.save();

  try {
    const io = getIO();
    io.to(`restaurant:${order.restaurantId.toString()}`).emit('order:new', order);
    io.to(`customer:${order.customerId.toString()}`).emit('order:paid', order);
  } catch {}

  res.json({ message: 'Payment verified', order });
};

export const webhook = async (req: any, res: Response) => {
  // For Razorpay webhook - verify and update
  // Simplified: expect { orderId, paymentId, signature }
  res.json({ received: true });
};
