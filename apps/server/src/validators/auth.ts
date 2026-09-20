import { body } from 'express-validator';
export const registerValidator = [
  body('name').trim().notEmpty().withMessage('Name required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
  body('role').optional().isIn(['customer', 'restaurant']).withMessage('Invalid role — admin must be seeded'),
];
export const loginValidator = [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];
