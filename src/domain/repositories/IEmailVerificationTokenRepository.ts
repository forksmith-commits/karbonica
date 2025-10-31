export interface EmailVerificationToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface IEmailVerificationTokenRepository {
  /**
   * Save a new verification token
   */
  save(token: EmailVerificationToken): Promise<EmailVerificationToken>;

  /**
   * Find a token by its value
   */
  findByToken(token: string): Promise<EmailVerificationToken | null>;

  /**
   * Mark a token as used
   */
  markAsUsed(tokenId: string): Promise<void>;

  /**
   * Delete expired tokens
   */
  deleteExpired(): Promise<void>;

  /**
   * Delete all tokens for a user
   */
  deleteByUserId(userId: string): Promise<void>;
}
