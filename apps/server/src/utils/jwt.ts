import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JWTPayload } from '../types';

export const signToken = (payload: JWTPayload) =>
  jwt.sign(payload, env.JWT_SECRET as string, { expiresIn: env.JWT_EXPIRES_IN } as any);

export const signRefreshToken = (payload: JWTPayload) =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET as string, { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as any);

export const verifyToken = (token: string): JWTPayload =>
  jwt.verify(token, env.JWT_SECRET as string) as JWTPayload;