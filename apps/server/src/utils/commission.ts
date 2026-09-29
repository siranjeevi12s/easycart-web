// Single source of truth for the marketplace split.
// Example: ₹500 order @ 5% -> platformFee ₹25, restaurantAmount ₹475.
// All amounts in RUPEES (integers). Paise conversion happens at the Razorpay boundary.
import { env } from '../config/env';

export interface Split {
  totalAmount: number;
  platformFee: number;
  restaurantAmount: number;
  feePercent: number;
}

export function computeSplit(totalAmount: number, feePercent?: number): Split {
  const pct = feePercent ?? env.PLATFORM_FEE_PERCENT ?? 5;
  const total = Math.max(0, Math.round(totalAmount));
  const platformFee = Math.min(total, Math.round((total * pct) / 100));
  return {
    totalAmount: total,
    platformFee,
    restaurantAmount: total - platformFee,
    feePercent: pct,
  };
}

export const toPaise = (rs: number): number => Math.round(rs * 100);
export const toRupees = (paise: number): number => Math.round(paise / 100);
