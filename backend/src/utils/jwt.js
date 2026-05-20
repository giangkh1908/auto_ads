import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

const UNIT_MS = { ms: 1, s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };

export const parseDurationMs = (str) => {
  if (!str) return 7 * 24 * 60 * 60 * 1000;
  const match = String(str).match(/^(\d+)(ms|s|m|h|d)$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  return parseInt(match[1], 10) * (UNIT_MS[match[2].toLowerCase()] || UNIT_MS.d);
};

export const getRefreshCookieMaxAge = () => parseDurationMs(process.env.JWT_REFRESH_EXPIRES || '7d');

export const getRefreshExpirySeconds = () => {
  const ms = parseDurationMs(process.env.JWT_REFRESH_EXPIRES || '7d');
  return Math.floor(ms / 1000);
};

export const generateToken = (payload, secret, expiresIn) => {
  return jwt.sign(payload, secret, { expiresIn });
};

export const generateTokens = (userId, tokenVersion = 1, familyId) => {
  const accessJti = crypto.randomUUID();
  const refreshJti = crypto.randomUUID();
  const fid = familyId || crypto.randomUUID();

  const accessToken = jwt.sign(
    { id: userId, jti: accessJti, tv: tokenVersion },
    ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );

  const refreshToken = jwt.sign(
    { id: userId, jti: refreshJti, tv: tokenVersion, fid },
    REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );

  return {
    accessToken,
    refreshToken,
    accessJti,
    refreshJti,
    familyId: fid,
  };
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, ACCESS_SECRET);
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, REFRESH_SECRET);
};
