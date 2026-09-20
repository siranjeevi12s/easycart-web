import { Order } from '../models/Order';
import { MenuItem } from '../models/MenuItem';
import { Restaurant } from '../models/Restaurant';
import { canTransition, OrderStatus } from '../types';
import { generateOrderNumber } from '../utils/orderNumber';

export const orderService = {
  async createOrder(customerId: string, restaurantId: string, items: { menuItemId: string; quantity: number }[]) {
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) throw Object.assign(new Error('Restaurant not found'), { status: 404 });
    if (!restaurant.isActive) throw Object.assign(new Error('Restaurant is deactivated'), { status: 400 });
    if (!restaurant.isOpen) throw Object.assign(new Error('Restaurant is closed'), { status: 400 });

    // Build snapshot & calculate totals server-side — never trust client totals
    let subtotal = 0;
    const snapshots = [];
    for (const { menuItemId, quantity } of items) {
      if (quantity < 1) throw Object.assign(new Error('Invalid quantity'), { status: 400 });
      const mi = await MenuItem.findOne({ _id: menuItemId, restaurantId });
      if (!mi) throw Object.assign(new Error(`Menu item ${menuItemId} not found`), { status: 404 });
      if (!mi.isAvailable) throw Object.assign(new Error(`${mi.name} is unavailable`), { status: 400 });
      const itemSubtotal = mi.price * quantity;
      snapshots.push({
        menuItemId: mi._id,
        name: mi.name,
        price: mi.price,
        quantity,
        subtotal: itemSubtotal,
      });
      subtotal += itemSubtotal;
    }
    const tax = Math.round(subtotal * 0.05); // 5% example
    const totalAmount = subtotal + tax;
    let orderNumber = await generateOrderNumber();
    // Retry on race duplicate (E11000)
    let order: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        order = await Order.create({
          orderNumber,
          customerId,
          restaurantId,
          items: snapshots,
          subtotal,
          tax,
          totalAmount,
          paymentStatus: 'PENDING',
          orderStatus: 'PENDING_PAYMENT',
        });
        break;
      } catch (e: any) {
        if (e.code === 11000 && attempt < 2) {
          // duplicate orderNumber race — bump and retry
          const num = parseInt(orderNumber.replace('#FD-', ''), 10) + 1 + Math.floor(Math.random() * 10);
          orderNumber = `#FD-${num}`;
          continue;
        }
        throw e;
      }
    }
    if (!order) throw new Error('Failed to create order');
    return order;
  },

  async transitionOrder(orderId: string, to: OrderStatus, actor: { id: string; role: string }) {
    const order = await Order.findById(orderId);
    if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
    if (!canTransition(order.orderStatus as OrderStatus, to))
      throw Object.assign(new Error(`Invalid transition ${order.orderStatus} -> ${to}`), { status: 400 });

    // Business rules
    if (['ACCEPTED', 'PREPARING', 'READY'].includes(to) && order.paymentStatus !== 'PAID')
      throw Object.assign(new Error('Cannot progress unpaid order'), { status: 400 });
    if (to === 'PICKED_UP' && order.orderStatus !== 'READY')
      throw Object.assign(new Error('Only READY orders can be picked up'), { status: 400 });
    if (order.orderStatus === 'PICKED_UP' || order.orderStatus === 'CANCELLED')
      throw Object.assign(new Error('Order already terminal'), { status: 400 });

    // Ownership check for pickup done in controller
    order.orderStatus = to;
    if (to === 'ACCEPTED') order.acceptedAt = new Date();
    if (to === 'PREPARING') order.preparingAt = new Date();
    if (to === 'READY') order.readyAt = new Date();
    if (to === 'PICKED_UP') order.pickedUpAt = new Date();
    if (to === 'CANCELLED') (order as any).cancelledAt = new Date();
    await order.save();
    return order;
  },
};
