import { Request, Response, NextFunction } from 'express';

export const notFound = (_req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' });
};

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('ERROR:', err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  if (err.errors) return res.status(400).json({ message: 'Validation failed', errors: err.errors });
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({ message: `${field} already exists` });
  }
  res.status(status).json({ message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : message });
};