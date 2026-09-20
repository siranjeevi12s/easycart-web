import mongoose from 'mongoose';

/**
 * 4-digit random order number #FD-xxxx (1000-9999) with DB uniqueness check
 */
export const generateOrderNumber = async (): Promise<string> => {
  const Order = mongoose.model('Order');
  for (let attempt = 0; attempt < 10; attempt++) {
    const num = Math.floor(1000 + Math.random() * 9000); // 1000-9999
    const candidate = `#FD-${num}`;
    const exists = await Order.findOne({ orderNumber: candidate }).select('_id').lean();
    if (!exists) return candidate;
  }
  // Fallback to timestamp-based if collisions persist
  return `#FD-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-3)}`;
};

export const generateOrderNumberDB = generateOrderNumber;
