import { describe, it, expect } from 'vitest';

describe('Configuration', () => {
  it('should load configuration', () => {
    // Set minimal required env vars for test
    process.env.DB_PASSWORD = 'test_password';
    process.env.JWT_SECRET = 'test_secret_at_least_32_characters_long';
    
    const { config } = require('./index');
    
    expect(config).toBeDefined();
    expect(config.env).toBeDefined();
    expect(config.port).toBeDefined();
    expect(config.database).toBeDefined();
    expect(config.redis).toBeDefined();
  });
});
