export const formatCurrency = (n: number) => `₹${n.toFixed(0)}`;
export const generateOrderNumber = () => `#FD-${Math.floor(1000 + Math.random() * 9000)}`;
