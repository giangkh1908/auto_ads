export default {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/tests/**/*.test.js'],
  transform: {},
  setupFilesAfterEnv: ['<rootDir>/tests/setup/testSetup.js'],
  testTimeout: 10000, // Reduced from 30s to 10s to encourage efficient tests
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
