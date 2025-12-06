import request from 'supertest';
import express from 'express';
import { authenticate, authenticateSSE } from '../../src/middlewares/auth.middleware.js';
import {
  createTestUser,
  generateTestToken,
  generateExpiredToken,
  generateInvalidToken,
  mockRequest,
  mockResponse,
  mockNext,
  cleanupTestData,
} from '../utils/testHelpers.js';
import { connect, closeDatabase, clearDatabase } from '../setup/testDb.js';
import mongoose from 'mongoose';

describe('Authentication Security Tests', () => {
  let testUser;
  let validToken;

  beforeAll(async () => {
    await connect();
  });

  beforeEach(async () => {
    // Create a test user
    testUser = await createTestUser({
      email: `auth.test${Date.now()}@example.com`,
    });
    validToken = generateTestToken(testUser._id);
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('JWT Token Validation', () => {
    test('should accept valid JWT token', async () => {
      const req = mockRequest({
        headers: { authorization: `Bearer ${validToken}` },
      });
      const res = mockResponse();
      const next = mockNext();

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user._id.toString()).toBe(testUser._id.toString());
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should reject request without token', async () => {
      const req = mockRequest({
        headers: {},
      });
      const res = mockResponse();
      const next = mockNext();

      await authenticate(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token không được cung cấp.',
      });
    });

    test('should reject request with malformed authorization header', async () => {
      const req = mockRequest({
        headers: { authorization: validToken }, // Missing "Bearer " prefix
      });
      const res = mockResponse();
      const next = mockNext();

      await authenticate(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('should reject expired token', async () => {
      const expiredToken = generateExpiredToken(testUser._id);
      
      // Wait a bit to ensure token is expired
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const req = mockRequest({
        headers: { authorization: `Bearer ${expiredToken}` },
      });
      const res = mockResponse();
      const next = mockNext();

      await authenticate(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token đã hết hạn.',
      });
    });

    test('should reject token with invalid signature', async () => {
      const invalidToken = generateInvalidToken(testUser._id);
      const req = mockRequest({
        headers: { authorization: `Bearer ${invalidToken}` },
      });
      const res = mockResponse();
      const next = mockNext();

      await authenticate(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token không hợp lệ.',
      });
    });

    test('should reject token for non-existent user', async () => {
      const fakeUserId = new mongoose.Types.ObjectId();
      const fakeToken = generateTestToken(fakeUserId);
      const req = mockRequest({
        headers: { authorization: `Bearer ${fakeToken}` },
      });
      const res = mockResponse();
      const next = mockNext();

      await authenticate(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token không hợp lệ hoặc người dùng không tồn tại.',
      });
    });

    test('should reject token for inactive user', async () => {
      const inactiveUser = await createTestUser({
        email: `inactive${Date.now()}@example.com`,
        status: 'inactive',
      });
      const inactiveToken = generateTestToken(inactiveUser._id);
      const req = mockRequest({
        headers: { authorization: `Bearer ${inactiveToken}` },
      });
      const res = mockResponse();
      const next = mockNext();

      await authenticate(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Tài khoản chưa được kích hoạt hoặc đã bị khóa.',
      });
    });

    test('should reject token for user with unverified email', async () => {
      const unverifiedUser = await createTestUser({
        email: `unverified${Date.now()}@example.com`,
        emailVerified: false,
      });
      const unverifiedToken = generateTestToken(unverifiedUser._id);
      const req = mockRequest({
        headers: { authorization: `Bearer ${unverifiedToken}` },
      });
      const res = mockResponse();
      const next = mockNext();

      await authenticate(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Vui lòng xác nhận email trước khi truy cập hệ thống.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    });
  });

  describe('SSE Authentication', () => {
    test('should accept valid token in query parameter', async () => {
      const req = mockRequest({
        query: { token: validToken },
      });
      const res = mockResponse();
      const next = mockNext();

      await authenticateSSE(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user._id.toString()).toBe(testUser._id.toString());
    });

    test('should reject SSE request without token', async () => {
      const req = mockRequest({
        query: {},
      });
      const res = mockResponse();
      const next = mockNext();

      await authenticateSSE(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('should reject SSE request with invalid token', async () => {
      const invalidToken = generateInvalidToken(testUser._id);
      const req = mockRequest({
        query: { token: invalidToken },
      });
      const res = mockResponse();
      const next = mockNext();

      await authenticateSSE(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Password Security', () => {
    test('should not expose password in user object', async () => {
      const req = mockRequest({
        headers: { authorization: `Bearer ${validToken}` },
      });
      const res = mockResponse();
      const next = mockNext();

      await authenticate(req, res, next);

      expect(req.user.password).toBeUndefined();
      expect(req.user.facebookAccessToken).toBeUndefined();
      expect(req.user.facebookRefreshToken).toBeUndefined();
    });
  });

  describe('Token Manipulation', () => {
    test('should reject tampered token payload', async () => {
      const parts = validToken.split('.');
      // Tamper with the payload
      const tamperedPayload = Buffer.from(JSON.stringify({ id: 'fake_id' })).toString('base64');
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
      
      const req = mockRequest({
        headers: { authorization: `Bearer ${tamperedToken}` },
      });
      const res = mockResponse();
      const next = mockNext();

      await authenticate(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('should reject completely malformed token', async () => {
      const req = mockRequest({
        headers: { authorization: 'Bearer invalid.token.format' },
      });
      const res = mockResponse();
      const next = mockNext();

      await authenticate(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
