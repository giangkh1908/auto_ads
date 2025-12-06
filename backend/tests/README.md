# Security Tests

This directory contains comprehensive security tests for the Auto Ads backend application.

## Quick Start

```bash
# Install dependencies
npm install

# Run all security tests
npm run test:security

# Run specific test file
npm test -- tests/security/auth.test.js

# Run with coverage
npm run test:coverage
```

## Test Files

### `security/auth.test.js`
Tests JWT authentication, token validation, expiration, and manipulation prevention.

**Key Tests:**
- Valid token acceptance
- Invalid token rejection
- Expired token handling
- User status validation
- Email verification enforcement

### `security/authorization.test.js`
Tests role-based access control (RBAC) and shop-level permissions.

**Key Tests:**
- Permission-based access
- Shop ownership verification
- Privilege escalation prevention
- Cross-shop access prevention

### `security/inputValidation.test.js`
Tests input validation and injection attack prevention.

**Key Tests:**
- NoSQL injection prevention
- XSS prevention
- Command injection prevention
- Email/phone validation
- Data type validation

### `security/rateLimiting.test.js`
Tests rate limiting for various endpoints.

**Key Tests:**
- Login rate limiting
- Registration rate limiting
- Forgot password rate limiting
- Bypass attempt prevention

### `security/password.test.js`
Tests password hashing, verification, and strength requirements.

**Key Tests:**
- BCrypt hashing
- Password verification
- Strength requirements
- Common password detection
- Timing attack prevention

### `security/cors.test.js`
Tests CORS configuration and security.

**Key Tests:**
- CORS headers
- Origin validation
- Credentials support
- Preflight handling

## Test Utilities

### `utils/testHelpers.js`
Provides reusable test utilities:

- `generateTestToken()` - Generate valid JWT tokens
- `generateExpiredToken()` - Generate expired tokens
- `generateInvalidToken()` - Generate invalid tokens
- `createTestUser()` - Create test users in database
- `createTestAdmin()` - Create admin users
- `createTestRole()` - Create test roles
- `assignRoleToUser()` - Assign roles to users
- `cleanupTestData()` - Clean up test data
- `mockRequest()` - Mock Express request objects
- `mockResponse()` - Mock Express response objects
- `mockNext()` - Mock Express next function

## Test Setup

### `setup/testSetup.js`
Configures the test environment:
- Loads test environment variables
- Sets test timeout
- Optionally suppresses console logs

### `.env.test`
Contains test-specific environment variables:
- Test database connection
- Test JWT secrets
- Relaxed rate limiting for tests

## Writing New Tests

When adding new security tests:

1. **Follow the existing structure:**
```javascript
import { connectDB } from '../../src/config/db.js';
import { createTestUser, cleanupTestData } from '../utils/testHelpers.js';

describe('Your Security Feature', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test('should do something secure', async () => {
    // Your test code
  });
});
```

2. **Use test helpers:**
```javascript
const user = await createTestUser();
const token = generateTestToken(user._id);
const req = mockRequest({ headers: { authorization: `Bearer ${token}` }});
```

3. **Clean up after tests:**
```javascript
afterEach(async () => {
  await cleanupTestData();
});
```

4. **Test both positive and negative cases:**
```javascript
test('should allow with valid token', async () => {
  // Test success case
});

test('should reject with invalid token', async () => {
  // Test failure case
});
```

## Best Practices

1. **Isolation:** Each test should be independent
2. **Cleanup:** Always clean up test data
3. **Realistic:** Use realistic test data and scenarios
4. **Coverage:** Test both success and failure paths
5. **Documentation:** Add comments for complex tests
6. **Performance:** Keep tests fast and efficient

## Common Issues

### MongoDB Connection
If tests fail to connect to MongoDB:
- Ensure MongoDB is running
- Check `.env.test` configuration
- Verify network connectivity

### Timeout Errors
If tests timeout:
- Increase `jest.setTimeout()` value
- Check for hanging connections
- Ensure proper cleanup

### Rate Limiting
If rate limiting tests fail:
- Tests should reset between runs
- Check rate limit configuration
- Consider using separate test instances

## Coverage Goals

Target coverage for security tests:
- **Statements:** 80%+
- **Branches:** 75%+
- **Functions:** 80%+
- **Lines:** 80%+

## Running in CI/CD

Add to your CI/CD pipeline:

```yaml
- name: Run Security Tests
  run: |
    cd backend
    npm install
    npm run test:security
```

## Security Testing Checklist

Before marking security implementation complete:

- [ ] All authentication tests pass
- [ ] All authorization tests pass
- [ ] Input validation tests pass
- [ ] Rate limiting tests pass
- [ ] Password security tests pass
- [ ] CORS tests pass
- [ ] No security vulnerabilities in dependencies
- [ ] Documentation is complete
- [ ] Coverage meets minimum thresholds

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)

## Support

For questions or issues with security tests:
1. Check this documentation
2. Review test helper functions
3. Consult SECURITY_TESTING.md in the backend directory
4. Contact the development team
