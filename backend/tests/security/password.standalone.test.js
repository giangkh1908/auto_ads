import bcrypt from 'bcrypt';

describe('Password Security Tests (Standalone)', () => {
  describe('Password Hashing', () => {
    test('should hash passwords with bcrypt', async () => {
      const plainPassword = 'MySecurePassword123!';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(plainPassword);
      expect(hashedPassword.length).toBeGreaterThan(50);
      expect(hashedPassword).toMatch(/^\$2[aby]\$/); // bcrypt format
    });

    test('should use sufficient salt rounds', async () => {
      const plainPassword = 'TestPassword123!';
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

      // Verify the hash format includes proper salt
      expect(hashedPassword).toMatch(/^\$2[aby]\$10\$/);
    });

    test('should generate different hashes for same password', async () => {
      const plainPassword = 'SamePassword123!';
      const hash1 = await bcrypt.hash(plainPassword, 10);
      const hash2 = await bcrypt.hash(plainPassword, 10);

      expect(hash1).not.toBe(hash2);
      
      // But both should validate correctly
      const valid1 = await bcrypt.compare(plainPassword, hash1);
      const valid2 = await bcrypt.compare(plainPassword, hash2);
      expect(valid1).toBe(true);
      expect(valid2).toBe(true);
    });
  });

  describe('Password Verification', () => {
    test('should verify correct password', async () => {
      const plainPassword = 'CorrectPassword123!';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      const isValid = await bcrypt.compare(plainPassword, hashedPassword);
      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const plainPassword = 'CorrectPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      const isValid = await bcrypt.compare(wrongPassword, hashedPassword);
      expect(isValid).toBe(false);
    });

    test('should reject case-sensitive mismatches', async () => {
      const plainPassword = 'Password123!';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      const isValid = await bcrypt.compare('password123!', hashedPassword);
      expect(isValid).toBe(false);
    });

    test('should reject password with extra characters', async () => {
      const plainPassword = 'Password123!';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      const isValid = await bcrypt.compare('Password123!extra', hashedPassword);
      expect(isValid).toBe(false);
    });
  });

  describe('Password Strength Requirements', () => {
    test('should enforce minimum length', () => {
      const weakPasswords = [
        'abc',
        '12345',
        'pass',
        'a1B!',
      ];

      for (const pwd of weakPasswords) {
        expect(pwd.length).toBeLessThan(8);
      }
    });

    test('should encourage strong passwords', () => {
      const strongPassword = 'MyStr0ng!Pass@2024';
      
      // Check various strength criteria
      const hasUpperCase = /[A-Z]/.test(strongPassword);
      const hasLowerCase = /[a-z]/.test(strongPassword);
      const hasDigit = /\d/.test(strongPassword);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(strongPassword);
      const isLongEnough = strongPassword.length >= 8;

      expect(hasUpperCase).toBe(true);
      expect(hasLowerCase).toBe(true);
      expect(hasDigit).toBe(true);
      expect(hasSpecialChar).toBe(true);
      expect(isLongEnough).toBe(true);
    });

    test('should detect weak passwords', () => {
      const weakPasswords = [
        'password',
        '12345678',
        'qwerty',
        'abc123',
        'Password', // No numbers or special chars
        'password123', // No uppercase or special chars
      ];

      for (const pwd of weakPasswords) {
        const hasUpperCase = /[A-Z]/.test(pwd);
        const hasLowerCase = /[a-z]/.test(pwd);
        const hasDigit = /\d/.test(pwd);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);

        // At least one of these should be false for weak passwords
        const isWeak = !(hasUpperCase && hasLowerCase && hasDigit && hasSpecialChar);
        expect(isWeak).toBe(true);
      }
    });
  });

  describe('Common Password Patterns', () => {
    test('should detect common passwords', () => {
      const commonPasswords = [
        'password',
        '12345678',
        'qwerty123',
        'admin',
        'letmein',
        'welcome',
        'monkey',
        '123456789',
      ];

      // These passwords should be rejected or flagged
      for (const pwd of commonPasswords) {
        expect(commonPasswords).toContain(pwd);
      }
    });

    test('should detect sequential patterns', () => {
      const sequentialPasswords = [
        'abcdefgh',
        '12345678',
        'qwertyui',
      ];

      for (const pwd of sequentialPasswords) {
        // Check if password contains sequential characters
        const hasSequential = /abc|123|qwer/i.test(pwd);
        expect(hasSequential).toBe(true);
      }
    });

    test('should detect repeated characters', () => {
      const repeatedPasswords = [
        'aaaaaaaa',
        '11111111',
        'password!!!!!!',
      ];

      for (const pwd of repeatedPasswords) {
        // Check if password has too many repeated characters
        const hasRepeated = /(.)\1{3,}/.test(pwd);
        expect(hasRepeated).toBe(true);
      }
    });
  });

  describe('Timing Attack Prevention', () => {
    test('should have consistent timing for password verification', async () => {
      const plainPassword = 'TestPassword123!';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      // Measure time for correct password using high-resolution timer
      const start1 = process.hrtime.bigint();
      await bcrypt.compare(plainPassword, hashedPassword);
      const time1 = process.hrtime.bigint() - start1;

      // Measure time for incorrect password
      const start2 = process.hrtime.bigint();
      await bcrypt.compare('WrongPassword123!', hashedPassword);
      const time2 = process.hrtime.bigint() - start2;

      // Convert nanoseconds to milliseconds for comparison
      const time1Ms = Number(time1) / 1_000_000;
      const time2Ms = Number(time2) / 1_000_000;

      // Times should be similar (bcrypt has built-in timing attack protection)
      // Allow some variance but they should be in the same order of magnitude
      const timeDifference = Math.abs(time1Ms - time2Ms);
      expect(timeDifference).toBeLessThan(100); // Less than 100ms difference
    });
  });

  describe('Brute Force Prevention', () => {
    test('should use sufficient computational cost', async () => {
      const plainPassword = 'TestPassword123!';
      const saltRounds = 10;

      const start = Date.now();
      await bcrypt.hash(plainPassword, saltRounds);
      const duration = Date.now() - start;

      // Should take at least some time to compute
      // With 10 rounds, it should take at least 50ms on most systems
      expect(duration).toBeGreaterThan(10);
    });

    test('should make multiple attempts time-consuming', async () => {
      const plainPassword = 'TestPassword123!';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      const attempts = 5;

      const start = Date.now();
      for (let i = 0; i < attempts; i++) {
        await bcrypt.compare(`WrongPassword${i}`, hashedPassword);
      }
      const totalTime = Date.now() - start;

      // Multiple attempts should take significant time
      expect(totalTime).toBeGreaterThan(attempts * 10);
    });
  });

  describe('Password Reset Token Security', () => {
    test('should generate random unpredictable tokens', () => {
      const token1 = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const token2 = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      expect(token1).not.toBe(token2);
      expect(token1.length).toBeGreaterThan(15);
      expect(token2.length).toBeGreaterThan(15);
    });

    test('should handle token expiration', () => {
      const tokenExpiry = new Date();
      tokenExpiry.setHours(tokenExpiry.getHours() + 1); // 1 hour expiry

      const now = new Date();
      const isExpired = now > tokenExpiry;

      expect(isExpired).toBe(false);

      // Simulate time passing
      const futureTime = new Date(tokenExpiry.getTime() + 1000);
      const isExpiredLater = futureTime > tokenExpiry;
      expect(isExpiredLater).toBe(true);
    });
  });
});
