import { Order } from '../models/Order';
import { MenuItem } from '../models/MenuItem';
import { Restaurant } from '../models/Restaurant';
import { canTransition, OrderStatus } from '../types';
import { generateOrderNumber } from '../utils/orderNumber';
import { computeSplit } from '../utils/commission';

export const orderService = {
  /**
   * Multi-seller checkout: items may span restaurants. Creates ONE order per
   * restaurant, all linked by batchId and paid by a SINGLE gateway payment
   * (split via Route transfers[]). Totals stay backend-authoritative.
   * Returns { batchId, orders } — single-restaurant carts yield one order.
   */
  async createBatch(customerId: string, items: { restaurantId: string; menuItemId: string; quantity: number }[], paymentMethod?: string) {
    if (!Array.isArray(items) || items.length === 0)
      throw Object.assign(new Error('items required'), { status: 400 });
    const groups = new Map<string, { menuItemId: string; quantity: number }[]>();
    for (const it of items) {
      if (!it.restaurantId || !it.menuItemId) throw Object.assign(new Error('restaurantId and menuItemId required per item'), { status: 400 });
      const list = groups.get(it.restaurantId) || [];
      list.push({ menuItemId: it.menuItemId, quantity: it.quantity });
      groups.set(it.restaurantId, list);
    }
    const batchId = `B_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const orders: any[] = [];
    for (const [restaurantId, grub] of groups) {
      const order = await this.createOrder(customerId, restaurantId, grub, paymentMethod, batchId);
      orders.push(order);
    }
    return { batchId, orders };
  },

  async createOrder(customerId: string, restaurantId: string, items: { menuItemId: string; quantity: number }[], paymentMethod?: string, batchId?: string) {
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) throw Object.assign(new Error('Restaurant not found'), { status: 404 });
    if (restaurant.isDeleted) throw Object.assign(new Error('Restaurant removed'), { status: 404 });
    if (!restaurant.isActive) throw Object.assign(new Error('Restaurant is deactivated'), { status: 400 });
    if (!restaurant.isOpen) throw Object.assign(new Error('Restaurant is closed'), { status: 400 });
    // Real-world workflow: no payouts configured → can't receive order amounts → block new orders
    if (!restaurant.payoutEnabled)
      throw Object.assign(
        new Error('Restaurant has not configured payment details yet — cannot accept orders. Ask the restaurant to complete Payments setup.'),
        { status: 400, code: 'PAYOUT_NOT_CONFIGURED' }
      );

    let subtotal = 0;
    const snapshots = [];
    for (const { menuItemId, quantity } of items) {
      if (quantity < 1) throw Object.assign(new Error('Invalid quantity'), { status: 400 });
      if (quantity > 99) throw Object.assign(new Error('Max quantity is 99'), { status: 400 });
      const mi = await MenuItem.findOne({ _id: menuItemId, restaurantId });
      if (!mi) throw Object.assign(new Error(`Menu item ${menuItemId} not found`), { status: 404 });
      if (mi.isDeleted) throw Object.assign(new Error(`${mi.name} has been removed`), { status: 400 });
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
    const tax = Math.round(subtotal * 0.05);
    const totalAmount = subtotal + tax;
    // Backend-authoritative marketplace split (never trust frontend totals)
    const split = computeSplit(totalAmount);
    const method = paymentMethod || 'RAZORPAY';
    let orderNumber = await generateOrderNumber();
    let order: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        order = await Order.create({
          orderNumber,
          batchId,
          customerId,
          restaurantId,
          items: snapshots,
          subtotal,
          tax,
          totalAmount,
          platformFee: split.platformFee,
          restaurantAmount: split.restaurantAmount,
          paymentStatus: 'PENDING',
          orderStatus: 'PENDING_PAYMENT',
          paymentMethod: method,
        });
        break;
      } catch (e: any) {
        if (e.code === 11000 && attempt < 4) {
          orderNumber = await generateOrderNumber();
          continue;
        }
        throw e;
      }
    }
    if (!order) throw new Error('Failed to create order');
    return order;
  },

  async transitionOrder(orderId: string, to: OrderStatus, actor: { id: string; role: string }, reason?: string) {
    const order = await Order.findById(orderId);
    if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
    if (!canTransition(order.orderStatus as OrderStatus, to))
      throw Object.assign(new Error(`Invalid transition ${order.orderStatus} -> ${to}`), { status: 400 });

    if (['ACCEPTED', 'PREPARING', 'READY'].includes(to) && order.paymentStatus !== 'PAID')
      throw Object.assign(new Error('Cannot progress unpaid order'), { status: 400 });
    if (to === 'PICKED_UP' && order.orderStatus !== 'READY')
      throw Object.assign(new Error('Only READY orders can be picked up'), { status: 400 });
    if (order.orderStatus === 'PICKED_UP' || order.orderStatus === 'CANCELLED')
      throw Object.assign(new Error('Order already terminal'), { status: 400 });

    order.orderStatus = to;
    if (to === 'ACCEPTED') order.acceptedAt = new Date();
    if (to === 'PREPARING') order.preparingAt = new Date();
    if (to === 'READY') order.readyAt = new Date();
    if (to === 'PICKED_UP') order.pickedUpAt = new Date();
    if (to === 'CANCELLED') { order.cancelledAt = new Date(); order.cancellationReason = reason || 'Cancelled by user'; }
    await order.save();
    return order;
  },
};