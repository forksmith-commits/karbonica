import { IEmailService } from '../../domain/services/IEmailService';
import { logger } from '../../utils/logger';
import { config } from '../../config';

/**
 * Console Email Service
 * Logs emails to console instead of sending them (for development)
 */
export class ConsoleEmailService implements IEmailService {
  async sendVerificationEmail(
    email: string,
    name: string,
    verificationToken: string
  ): Promise<void> {
    const verificationUrl = `${config.app.frontendUrl}/verify-email?token=${verificationToken}`;

    logger.info('📧 Email Verification Email (Console)', {
      to: email,
      name,
      verificationUrl,
      token: verificationToken,
    });

    console.log('\n========================================');
    console.log('📧 EMAIL VERIFICATION');
    console.log('========================================');
    console.log(`To: ${email}`);
    console.log(`Name: ${name}`);
    console.log(`\nHi ${name},`);
    console.log('\nThank you for registering with Karbonica!');
    console.log('\nPlease verify your email address by clicking the link below:');
    console.log(`\n${verificationUrl}`);
    console.log('\nOr use this token directly:');
    console.log(`Token: ${verificationToken}`);
    console.log('\nThis link will expire in 24 hours.');
    console.log('\nIf you did not create an account, please ignore this email.');
    console.log('\nBest regards,');
    console.log('The Karbonica Team');
    console.log('========================================\n');
  }

  async sendPasswordResetEmail(email: string, name: string, resetToken: string): Promise<void> {
    const resetUrl = `${config.app.frontendUrl}/reset-password?token=${resetToken}`;

    logger.info('📧 Password Reset Email (Console)', {
      to: email,
      name,
      resetUrl,
    });

    console.log('\n========================================');
    console.log('📧 PASSWORD RESET');
    console.log('========================================');
    console.log(`To: ${email}`);
    console.log(`Name: ${name}`);
    console.log(`\nHi ${name},`);
    console.log('\nWe received a request to reset your password.');
    console.log('\nClick the link below to reset your password:');
    console.log(`\n${resetUrl}`);
    console.log('\nThis link will expire in 1 hour.');
    console.log('\nIf you did not request a password reset, please ignore this email.');
    console.log('\nBest regards,');
    console.log('The Karbonica Team');
    console.log('========================================\n');
  }

  async sendNotificationEmail(email: string, subject: string, body: string): Promise<void> {
    logger.info('📧 Notification Email (Console)', {
      to: email,
      subject,
    });

    console.log('\n========================================');
    console.log('📧 NOTIFICATION');
    console.log('========================================');
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log(`\n${body}`);
    console.log('========================================\n');
  }
}
