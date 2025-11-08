import { describe, it, expect, beforeEach } from 'vitest';
import { CreditService } from '../../application/services/CreditService';
import { CreditEntryRepository } from '../../infrastructure/repositories/CreditEntryRepository';
import { CreditTransactionRepository } from '../../infrastructure/repositories/CreditTransactionRepository';
import { ProjectRepository } from '../../infrastructure/repositories/ProjectRepository';
import { UserRepository } from '../../infrastructure/repositories/UserRepository';
import { CreditStatus } from '../../domain/entities/CreditEntry';
import { TransactionType, TransactionStatus } from '../../domain/entities/CreditTransaction';
import { UserRole } from '../../domain/entities/User';
import { v4 as uuidv4 } from 'uuid';

describe('Credit Transfer', () => {
  let creditService: CreditService;
  let creditEntryRepository: CreditEntryRepository;
  let creditTransactionRepository: CreditTransactionRepository;
  let projectRepository: ProjectRepository;
  let userRepository: UserRepository;

  beforeEach(() => {
    creditEntryRepository = new CreditEntryRepository();
    creditTransactionRepository = new CreditTransactionRepository();
    projectRepository = new ProjectRepository();
    userRepository = new UserRepository();

    creditService = new CreditService(
      creditEntryRepository,
      creditTransactionRepository,
      projectRepository,
      userRepository
    );
  });

  it('should validate recipient user exists', async () => {
    const creditId = uuidv4();
    const senderId = uuidv4();
    const recipientId = uuidv4();
    const quantity = 100;

    // Mock recipient not found
    userRepository.findById = async (id: string) => {
      return null;
    };

    await expect(
      creditService.transferCredits(creditId, senderId, recipientId, quantity)
    ).rejects.toThrow('Recipient user not found');
  });

  it('should validate user owns the credit', async () => {
    const creditId = uuidv4();
    const senderId = uuidv4();
    const recipientId = uuidv4();
    const ownerId = uuidv4(); // Different from sender
    const quantity = 100;

    const mockRecipient = {
      id: recipientId,
      email: 'recipient@test.com',
      passwordHash: 'hashed',
      name: 'Test Recipient',
      company: 'Test Company',
      role: UserRole.BUYER,
      emailVerified: true,
      accountLocked: false,
      failedLoginAttempts: 0,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockCredit = {
      id: creditId,
      creditId: 'KRB-2024-001-000001',
      projectId: uuidv4(),
      ownerId: ownerId, // Different from sender
      quantity: 1000,
      vintage: 2024,
      status: CreditStatus.ACTIVE,
      issuedAt: new Date(),
      lastActionAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    userRepository.findById = async (id: string) => {
      if (id === recipientId) return mockRecipient;
      return null;
    };

    const mockClient = {
      query: async (query: string, params?: any[]) => {
        if (query.includes('BEGIN')) return { rows: [] };
        if (query.includes('FOR UPDATE')) {
          return { rows: [mockCredit] };
        }
        return { rows: [] };
      },
      release: () => {},
    };

    creditEntryRepository.getClient = async () => mockClient;
    creditEntryRepository.lockForUpdateWithClient = async (client: any, id: string) => {
      if (id === creditId) return mockCredit;
      return null;
    };

    await expect(
      creditService.transferCredits(creditId, senderId, recipientId, quantity)
    ).rejects.toThrow('You do not own this credit');
  });

  it('should validate credit status is active', async () => {
    const creditId = uuidv4();
    const senderId = uuidv4();
    const recipientId = uuidv4();
    const quantity = 100;

    const mockRecipient = {
      id: recipientId,
      email: 'recipient@test.com',
      passwordHash: 'hashed',
      name: 'Test Recipient',
      company: 'Test Company',
      role: UserRole.BUYER,
      emailVerified: true,
      accountLocked: false,
      failedLoginAttempts: 0,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockCredit = {
      id: creditId,
      creditId: 'KRB-2024-001-000001',
      projectId: uuidv4(),
      ownerId: senderId,
      quantity: 1000,
      vintage: 2024,
      status: CreditStatus.RETIRED, // Not active
      issuedAt: new Date(),
      lastActionAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    userRepository.findById = async (id: string) => {
      if (id === recipientId) return mockRecipient;
      return null;
    };

    const mockClient = {
      query: async (query: string, params?: any[]) => {
        if (query.includes('BEGIN')) return { rows: [] };
        if (query.includes('FOR UPDATE')) {
          return { rows: [mockCredit] };
        }
        return { rows: [] };
      },
      release: () => {},
    };

    creditEntryRepository.getClient = async () => mockClient;
    creditEntryRepository.lockForUpdateWithClient = async (client: any, id: string) => {
      if (id === creditId) return mockCredit;
      return null;
    };

    await expect(
      creditService.transferCredits(creditId, senderId, recipientId, quantity)
    ).rejects.toThrow('Credit must be active to transfer');
  });

  it('should validate transfer quantity is positive', async () => {
    const creditId = uuidv4();
    const senderId = uuidv4();
    const recipientId = uuidv4();
    const quantity = -100; // Negative quantity

    const mockRecipient = {
      id: recipientId,
      email: 'recipient@test.com',
      passwordHash: 'hashed',
      name: 'Test Recipient',
      company: 'Test Company',
      role: UserRole.BUYER,
      emailVerified: true,
      accountLocked: false,
      failedLoginAttempts: 0,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockCredit = {
      id: creditId,
      creditId: 'KRB-2024-001-000001',
      projectId: uuidv4(),
      ownerId: senderId,
      quantity: 1000,
      vintage: 2024,
      status: CreditStatus.ACTIVE,
      issuedAt: new Date(),
      lastActionAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    userRepository.findById = async (id: string) => {
      if (id === recipientId) return mockRecipient;
      return null;
    };

    const mockClient = {
      query: async (query: string, params?: any[]) => {
        if (query.includes('BEGIN')) return { rows: [] };
        if (query.includes('FOR UPDATE')) {
          return { rows: [mockCredit] };
        }
        return { rows: [] };
      },
      release: () => {},
    };

    creditEntryRepository.getClient = async () => mockClient;
    creditEntryRepository.lockForUpdateWithClient = async (client: any, id: string) => {
      if (id === creditId) return mockCredit;
      return null;
    };

    await expect(
      creditService.transferCredits(creditId, senderId, recipientId, quantity)
    ).rejects.toThrow('Transfer quantity must be positive');
  });

  it('should validate transfer quantity does not exceed owned amount', async () => {
    const creditId = uuidv4();
    const senderId = uuidv4();
    const recipientId = uuidv4();
    const quantity = 2000; // More than owned

    const mockRecipient = {
      id: recipientId,
      email: 'recipient@test.com',
      passwordHash: 'hashed',
      name: 'Test Recipient',
      company: 'Test Company',
      role: UserRole.BUYER,
      emailVerified: true,
      accountLocked: false,
      failedLoginAttempts: 0,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockCredit = {
      id: creditId,
      creditId: 'KRB-2024-001-000001',
      projectId: uuidv4(),
      ownerId: senderId,
      quantity: 1000, // Less than transfer quantity
      vintage: 2024,
      status: CreditStatus.ACTIVE,
      issuedAt: new Date(),
      lastActionAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    userRepository.findById = async (id: string) => {
      if (id === recipientId) return mockRecipient;
      return null;
    };

    const mockClient = {
      query: async (query: string, params?: any[]) => {
        if (query.includes('BEGIN')) return { rows: [] };
        if (query.includes('FOR UPDATE')) {
          return { rows: [mockCredit] };
        }
        return { rows: [] };
      },
      release: () => {},
    };

    creditEntryRepository.getClient = async () => mockClient;
    creditEntryRepository.lockForUpdateWithClient = async (client: any, id: string) => {
      if (id === creditId) return mockCredit;
      return null;
    };

    await expect(
      creditService.transferCredits(creditId, senderId, recipientId, quantity)
    ).rejects.toThrow('Transfer quantity exceeds owned amount');
  });
});
