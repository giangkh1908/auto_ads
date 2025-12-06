import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import User from '../../src/models/user.model.js';
import Role from '../../src/models/role.model.js';
import UserRole from '../../src/models/userRole.model.js';

/**
 * Generate a test JWT token
 */
export const generateTestToken = (userId, expiresIn = '1h') => {
  // Use dedicated test secret to avoid using production secrets in tests
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing_only';
  if (!process.env.JWT_ACCESS_SECRET && !process.env.JWT_SECRET) {
    console.warn('Warning: Using fallback test JWT secret. Set JWT_ACCESS_SECRET in .env.test');
  }
  return jwt.sign({ id: userId }, secret, { expiresIn });
};

/**
 * Generate an expired token for testing
 */
export const generateExpiredToken = (userId) => {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing_only';
  return jwt.sign({ id: userId }, secret, { expiresIn: '0s' });
};

/**
 * Generate an invalid token (wrong secret)
 */
export const generateInvalidToken = (userId) => {
  return jwt.sign({ id: userId }, 'wrong_secret', { expiresIn: '1h' });
};

/**
 * Create a test user in the database
 */
export const createTestUser = async (userData = {}) => {
  const defaultUser = {
    full_name: 'Test User',
    email: `test${Date.now()}@example.com`,
    password: await bcrypt.hash('TestPassword123!', 10),
    phone: '0123456789',
    provider: 'local',
    emailVerified: true,
    status: 'active',
    internal_role: 'User',
    ...userData,
  };

  const user = await User.create(defaultUser);
  return user;
};

/**
 * Create a test admin user
 */
export const createTestAdmin = async (userData = {}) => {
  return createTestUser({
    internal_role: 'System Admin',
    ...userData,
  });
};

/**
 * Create a test role
 */
export const createTestRole = async (roleData = {}) => {
  const defaultRole = {
    role_name: `Test Role ${Date.now()}`,
    permissions: [],
    ...roleData,
  };

  const role = await Role.create(defaultRole);
  return role;
};

/**
 * Assign a role to a user
 */
export const assignRoleToUser = async (userId, roleId, shopId = null) => {
  const userRole = await UserRole.create({
    user_id: userId,
    role_id: roleId,
    shop_id: shopId,
  });
  return userRole;
};

/**
 * Clean up test data
 */
export const cleanupTestData = async () => {
  // Clean up test users (keep some basic data structure)
  await User.deleteMany({ email: { $regex: /test.*@example\.com/i } });
  
  // Get test role IDs to delete only test-related UserRole entries
  const testRoles = await Role.find({ role_name: { $regex: /^Test Role/i } });
  const testRoleIds = testRoles.map(role => role._id);
  
  await Role.deleteMany({ role_name: { $regex: /^Test Role/i } });
  
  // Only delete UserRole entries associated with test roles
  if (testRoleIds.length > 0) {
    await UserRole.deleteMany({ role_id: { $in: testRoleIds } });
  }
};

/**
 * Mock request object for testing
 */
export const mockRequest = (data = {}) => {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...data,
  };
};

/**
 * Mock response object for testing
 */
export const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * Mock next function for middleware testing
 */
export const mockNext = () => jest.fn();

/**
 * Wait for a specified time (useful for rate limiting tests)
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
