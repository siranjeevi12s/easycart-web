export type UserRole = 'customer' | 'restaurant' | 'admin';
export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'PICKED_UP' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface ApiResponse<T> { data: T; message?: string; }

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['PICKED_UP'],
  PICKED_UP: [],
  CANCELLED: [],
};
