import mongoose from 'mongoose';
import { authorize, authorizeInShop } from '../../src/middlewares/auth.middleware.js';
import {
  createTestUser,
  createTestAdmin,
  createTestRole,
  assignRoleToUser,
  mockRequest,
  mockResponse,
  mockNext,
  cleanupTestData,
} from '../utils/testHelpers.js';
import { connectDB } from '../../src/config/db.js';
import Shop from '../../src/models/shops/shop.model.js';

describe('Authorization Security Tests', () => {
  let testUser;
  let adminUser;
  let testShop;
  let testRole;

  beforeAll(async () => {
    await connectDB();
  });

  beforeEach(async () => {
    testUser = await createTestUser({
      email: `authz.test${Date.now()}@example.com`,
    });
    
    adminUser = await createTestAdmin({
      email: `admin${Date.now()}@example.com`,
    });

    // Create a test shop
    testShop = await Shop.create({
      shop_name: `Test Shop ${Date.now()}`,
      owner_id: testUser._id,
      status: 'active',
    });

    // Create a test role with specific permissions
    testRole = await createTestRole({
      role_name: `Test Role ${Date.now()}`,
      permissions: [
        { module: 'campaign', actions: ['view', 'create'] },
        { module: 'ads', actions: ['view'] },
      ],
    });
  });

  afterEach(async () => {
    await Shop.deleteMany({ shop_name: { $regex: /^Test Shop/i } });
    await cleanupTestData();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('System Admin Bypass', () => {
    test('should allow System Admin to access any resource', async () => {
      const req = mockRequest({
        user: adminUser,
        headers: { 'x-shop-id': testShop._id.toString() },
      });
      const res = mockResponse();
      const next = mockNext();

      const middleware = authorize('campaign', 'delete');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Permission-based Access Control', () => {
    test('should allow access with correct permission', async () => {
      await assignRoleToUser(testUser._id, testRole._id, testShop._id);

      const req = mockRequest({
        user: testUser,
        headers: { 'x-shop-id': testShop._id.toString() },
      });
      const res = mockResponse();
      const next = mockNext();

      const middleware = authorize('campaign', 'view');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should deny access without permission', async () => {
      await assignRoleToUser(testUser._id, testRole._id, testShop._id);

      const req = mockRequest({
        user: testUser,
        headers: { 'x-shop-id': testShop._id.toString() },
      });
      const res = mockResponse();
      const next = mockNext();

      const middleware = authorize('campaign', 'delete');
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Bạn không có quyền delete trên module campaign.',
      });
    });

    test('should deny access to different module', async () => {
      await assignRoleToUser(testUser._id, testRole._id, testShop._id);

      const req = mockRequest({
        user: testUser,
        headers: { 'x-shop-id': testShop._id.toString() },
      });
      const res = mockResponse();
      const next = mockNext();

      const middleware = authorize('settings', 'view');
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Shop-level Authorization', () => {
    test('should allow shop owner to access shop resources', async () => {
      const req = mockRequest({
        user: testUser,
        params: { id: testShop._id.toString() },
      });
      const res = mockResponse();
      const next = mockNext();

      const middleware = authorizeInShop('shop', 'view');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.shopId).toBe(testShop._id.toString());
    });

    test('should deny non-member access to shop', async () => {
      const otherUser = await createTestUser({
        email: `other${Date.now()}@example.com`,
      });

      const req = mockRequest({
        user: otherUser,
        params: { id: testShop._id.toString() },
      });
      const res = mockResponse();
      const next = mockNext();

      const middleware = authorizeInShop('shop', 'view');
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('You are not part of this shop'),
        })
      );
    });

    test('should require shop_id parameter', async () => {
      const req = mockRequest({
        user: testUser,
        params: {},
      });
      const res = mockResponse();
      const next = mockNext();

      const middleware = authorizeInShop('shop', 'view');
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Shop ID is required for this action.',
      });
    });

    test('should handle non-existent shop', async () => {
      const fakeShopId = new mongoose.Types.ObjectId();
      const req = mockRequest({
        user: testUser,
        params: { id: fakeShopId.toString() },
      });
      const res = mockResponse();
      const next = mockNext();

      const middleware = authorizeInShop('shop', 'view');
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Shop not found.',
      });
    });
  });

  describe('Privilege Escalation Prevention', () => {
    test('should not allow user to escalate privileges', async () => {
      // Create a role with limited permissions
      const limitedRole = await createTestRole({
        role_name: `Limited Role ${Date.now()}`,
        permissions: [{ module: 'ads', actions: ['view'] }],
      });
      
      await assignRoleToUser(testUser._id, limitedRole._id, testShop._id);

      const req = mockRequest({
        user: testUser,
        headers: { 'x-shop-id': testShop._id.toString() },
      });
      const res = mockResponse();
      const next = mockNext();

      // Try to access admin-level action
      const middleware = authorize('users', 'delete');
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('should enforce permissions per shop', async () => {
      // Create another shop owned by different user
      const otherUser = await createTestUser({
        email: `other${Date.now()}@example.com`,
      });
      
      const otherShop = await Shop.create({
        shop_name: `Other Shop ${Date.now()}`,
        owner_id: otherUser._id,
        status: 'active',
      });

      // User has permission in testShop, but not in otherShop
      await assignRoleToUser(testUser._id, testRole._id, testShop._id);

      const req = mockRequest({
        user: testUser,
        params: { id: otherShop._id.toString() },
      });
      const res = mockResponse();
      const next = mockNext();

      const middleware = authorizeInShop('shop', 'view');
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Cross-shop Access Prevention', () => {
    test('should prevent accessing resources from different shop', async () => {
      const otherUser = await createTestUser({
        email: `crossshop${Date.now()}@example.com`,
      });
      
      const otherShop = await Shop.create({
        shop_name: `Cross Shop ${Date.now()}`,
        owner_id: otherUser._id,
        status: 'active',
      });

      const req = mockRequest({
        user: testUser,
        params: { id: otherShop._id.toString() },
      });
      const res = mockResponse();
      const next = mockNext();

      const middleware = authorizeInShop('shop', 'update');
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
