// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Add custom Jest matchers
import '@testing-library/jest-dom'

// Global test setup can go here
global.console = {
  ...console,
  // Uncomment to silence console.log during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}