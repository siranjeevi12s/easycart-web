import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { JWTPayload } from '../types';

export const signToken = (payload: JWTPayload) =>
  jwt.sign(payload, env.JWT_SECRET as string, { expiresIn: env.JWT_EXPIRES_IN } as any);

export const signRefreshToken = (payload: JWTPayload) =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET as string, { expiresIn: env.JWT_REFRESH_EXPIRES_IN, jwtid: crypto.randomUUID() } as any);

export const verifyToken = (token: string): JWTPayload =>
  jwt.verify(token, env.JWT_SECRET as string) as JWTPayload;

/** Refresh tokens are signed with a SEPARATE secret — verifying with the
 *  access secret always fails. (This was a live bug: refresh never worked.) */
export const verifyRefreshToken = (token: string): JWTPayload =>
  jwt.verify(token, env.JWT_REFRESH_SECRET as string) as JWTPayload;