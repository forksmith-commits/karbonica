import { beforeAll, afterAll } from 'vitest';
import { database } from '../config/database';

// Setup database connection before all tests
beforeAll(async () => {
  try {
    await database.connect();
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }
});

// Cleanup after all tests
afterAll(async () => {
  try {
    await database.disconnect();
  } catch (error) {
    console.error('Failed to disconnect from test database:', error);
  }
});
