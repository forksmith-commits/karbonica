import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import { IEmailService } from '../../domain/services/IEmailService';
import { logger } from '../../utils/logger';
import { config } from '../../config';

/**
 * Mailgun Email Service
 * Sends emails using Mailgun API (faster and easier than SMTP)
 */
export class MailgunEmailService implements IEmailService {
  private mailgun: any;
  private domain: string;

  constructor() {
    const mailgun = new Mailgun(FormData);
    this.mailgun = mailgun.client({
      username: 'api',
      key: process.env.MAILGUN_API_KEY || '',
    });
    this.domain = process.env.MAILGUN_DOMAIN || '';

    if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
      logger.warn('Mailgun API key or domain not configured');
    } else {
      logger.info('Mailgun email service initialized', { domain: this.domain });
    }
  }

  async sendVerificationEmail(
    email: string,
    name: string,
    verificationToken: string
  ): Promise<void> {
    const verificationUrl = `${config.app.frontendUrl}/verify-email?token=${verificationToken}`;

    const messageData = {
      from: `Karbonica <noreply@${this.domain}>`,
      to: email,
      subject: 'Verify Your Email - Karbonica',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2c5f2d; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .button { 
              display: inline-block; 
              padding: 12px 30px; 
              background-color: #2c5f2d; 
              color: white !important; 
              text-decoration: none; 
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .token { 
              background-color: #e8e8e8; 
              padding: 10px; 
              border-radius: 5px; 
              font-family: monospace;
              word-break: break-all;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">🌱 Karbonica</h1>
              <p style="margin: 5px 0 0 0;">Carbon Credit Registry Platform</p>
            </div>
            <div class="content">
              <h2>Hi ${name},</h2>
              <p>Thank you for registering with Karbonica!</p>
              <p>Please verify your email address by clicking the button below:</p>
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>
              <p>Or copy and paste this link into your browser:</p>
              <div class="token">${verificationUrl}</div>
              <p><strong>This link will expire in 24 hours.</strong></p>
              <p>If you did not create an account, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>© 2024 Karbonica. All rights reserved.</p>
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hi ${name},

Thank you for registering with Karbonica!

Please verify your email address by clicking the link below:
${verificationUrl}

This link will expire in 24 hours.

If you did not create an account, please ignore this email.

Best regards,
The Karbonica Team
      `,
    };

    try {
      const response = await this.mailgun.messages.create(this.domain, messageData);
      logger.info('Verification email sent via Mailgun', {
        to: email,
        messageId: response.id,
      });
    } catch (error) {
      logger.error('Failed to send verification email via Mailgun', { error, to: email });
      throw new Error('Failed to send verification email');
    }
  }

  async sendPasswordResetEmail(email: string, name: string, resetToken: string): Promise<void> {
    const resetUrl = `${config.app.frontendUrl}/reset-password?token=${resetToken}`;

    const messageData = {
      from: `Karbonica <noreply@${this.domain}>`,
      to: email,
      subject: 'Reset Your Password - Karbonica',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2c5f2d; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .button { 
              display: inline-block; 
              padding: 12px 30px; 
              background-color: #d9534f; 
              color: white !important; 
              text-decoration: none; 
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">🌱 Karbonica</h1>
            </div>
            <div class="content">
              <h2>Hi ${name},</h2>
              <p>We received a request to reset your password.</p>
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              <p><strong>This link will expire in 1 hour.</strong></p>
              <p>If you did not request a password reset, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>© 2024 Karbonica. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hi ${name},

We received a request to reset your password.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you did not request a password reset, please ignore this email.

Best regards,
The Karbonica Team
      `,
    };

    try {
      const response = await this.mailgun.messages.create(this.domain, messageData);
      logger.info('Password reset email sent via Mailgun', {
        to: email,
        messageId: response.id,
      });
    } catch (error) {
      logger.error('Failed to send password reset email via Mailgun', { error, to: email });
      throw new Error('Failed to send password reset email');
    }
  }

  async sendNotificationEmail(email: string, subject: string, body: string): Promise<void> {
    const messageData = {
      from: `Karbonica <noreply@${this.domain}>`,
      to: email,
      subject: subject,
      html: body,
      text: body.replace(/<[^>]*>/g, ''), // Strip HTML tags for text version
    };

    try {
      const response = await this.mailgun.messages.create(this.domain, messageData);
      logger.info('Notification email sent via Mailgun', {
        to: email,
        subject,
        messageId: response.id,
      });
    } catch (error) {
      logger.error('Failed to send notification email via Mailgun', { error, to: email });
      throw new Error('Failed to send notification email');
    }
  }
}
