import { Request, Response, NextFunction } from 'express';

export const notFound = (_req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' });
};

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  if (err.errors) return res.status(400).json({ message: 'Validation failed', errors: err.errors });
  res.status(status).json({ message });
};
