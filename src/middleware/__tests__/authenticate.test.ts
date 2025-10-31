import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authenticate } from '../authenticate';
import { AuthenticationError } from '../errorHandler';

// Mock dependencies
vi.mock('../../utils/crypto');
vi.mock('../../infrastructure/repositories/SessionRepository');
vi.mock('../../infrastructure/repositories/UserRepository');
vi.mock('../../utils/logger');

describe('authenticate middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {};
    mockNext = vi.fn();
  });

  it('should throw AuthenticationError when no authorization header is provided', async () => {
    await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    const error = (mockNext as any).mock.calls[0][0];
    expect(error.message).toBe('No authentication token provided');
  });

  it('should throw AuthenticationError when authorization header does not start with Bearer', async () => {
    mockRequest.headers = {
      authorization: 'Basic sometoken',
    };

    await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    const error = (mockNext as any).mock.calls[0][0];
    expect(error.message).toBe('No authentication token provided');
  });

  it('should throw AuthenticationError when token is invalid', async () => {
    const { CryptoUtils } = await import('../../utils/crypto');
    vi.mocked(CryptoUtils.verifyToken).mockImplementation(() => {
      throw new Error('Invalid token');
    });

    mockRequest.headers = {
      authorization: 'Bearer invalidtoken',
    };

    await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    const error = (mockNext as any).mock.calls[0][0];
    expect(error.message).toBe('Invalid or expired token');
  });
});
