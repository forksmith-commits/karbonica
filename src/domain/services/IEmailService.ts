/**
 * Email Service Interface
 * Defines the contract for sending emails
 */
export interface IEmailService {
  /**
   * Send email verification email to user
   * @param email - Recipient email address
   * @param name - Recipient name
   * @param verificationToken - Verification token
   */
  sendVerificationEmail(email: string, name: string, verificationToken: string): Promise<void>;

  /**
   * Send password reset email to user
   * @param email - Recipient email address
   * @param name - Recipient name
   * @param resetToken - Password reset token
   */
  sendPasswordResetEmail(email: string, name: string, resetToken: string): Promise<void>;

  /**
   * Send notification email
   * @param email - Recipient email address
   * @param subject - Email subject
   * @param body - Email body (HTML)
   */
  sendNotificationEmail(email: string, subject: string, body: string): Promise<void>;
}
