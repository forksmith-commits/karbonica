import { config } from '../../config';

// Ensure we're using test environment
if (config.env !== 'test') {
  console.warn('Warning: Tests should run in test environment. Set NODE_ENV=test');
}

// Global test setup can be added here
