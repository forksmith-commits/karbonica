import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend';
import { IEmailService } from '../../domain/services/IEmailService';
import { logger } from '../../utils/logger';
import { config } from '../../config';

/**
 * MailerSend Email Service
 * Sends emails using MailerSend API
 */
export class MailerSendEmailService implements IEmailService {
  private mailerSend: MailerSend;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.mailerSend = new MailerSend({
      apiKey: process.env.MAILERSEND_API_KEY || '',
    });

    this.fromEmail =
      process.env.MAILERSEND_FROM_EMAIL || 'noreply@trial-0r83ql3zx7pg9yjw.mlsender.net';
    this.fromName = process.env.MAILERSEND_FROM_NAME || 'Karbonica';

    if (!process.env.MAILERSEND_API_KEY) {
      logger.warn('MailerSend API key not configured');
    } else {
      logger.info('MailerSend email service initialized');
    }
  }

  async sendVerificationEmail(
    email: string,
    name: string,
    verificationToken: string
  ): Promise<void> {
    const verificationUrl = `${config.app.frontendUrl}/verify-email?token=${verificationToken}`;

    const sentFrom = new Sender(this.fromEmail, this.fromName);
    const recipients = [new Recipient(email, name)];

    const emailParams = new EmailParams()
      .setFrom(sentFrom)
      .setTo(recipients)
      .setSubject('Verify Your Email - Karbonica').setHtml(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6; 
              color: #333;
              margin: 0;
              padding: 0;
              background-color: #f4f4f4;
            }
            .container { 
              max-width: 600px; 
              margin: 40px auto; 
              background: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #2c5f2d 0%, #3a7d3c 100%);
              color: white; 
              padding: 40px 20px; 
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .header p {
              margin: 8px 0 0 0;
              opacity: 0.9;
              font-size: 14px;
            }
            .content { 
              padding: 40px 30px;
            }
            .content h2 {
              color: #2c5f2d;
              margin-top: 0;
            }
            .button { 
              display: inline-block; 
              padding: 14px 32px; 
              background-color: #2c5f2d; 
              color: white !important; 
              text-decoration: none; 
              border-radius: 6px;
              margin: 24px 0;
              font-weight: 600;
              font-size: 16px;
              transition: background-color 0.3s;
            }
            .button:hover {
              background-color: #1f4420;
            }
            .button-container {
              text-align: center;
              margin: 30px 0;
            }
            .footer { 
              text-align: center; 
              padding: 30px 20px;
              background-color: #f9f9f9;
              color: #666; 
              font-size: 13px;
              border-top: 1px solid #e0e0e0;
            }
            .token { 
              background-color: #f5f5f5; 
              padding: 12px; 
              border-radius: 6px; 
              font-family: 'Courier New', monospace;
              word-break: break-all;
              font-size: 12px;
              border: 1px solid #e0e0e0;
              margin: 20px 0;
            }
            .warning {
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 12px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .icon {
              font-size: 48px;
              margin-bottom: 10px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="icon">🌱</div>
              <h1>Karbonica</h1>
              <p>Carbon Credit Registry Platform</p>
            </div>
            <div class="content">
              <h2>Hi ${name},</h2>
              <p>Thank you for registering with Karbonica! We're excited to have you join our mission to combat climate change through transparent carbon credit management.</p>
              <p>To get started, please verify your email address by clicking the button below:</p>
              <div class="button-container">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>
              <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
              <div class="token">${verificationUrl}</div>
              <div class="warning">
                <strong>⏰ Important:</strong> This verification link will expire in 24 hours.
              </div>
              <p style="color: #666; font-size: 14px;">If you did not create an account with Karbonica, please ignore this email and no account will be created.</p>
            </div>
            <div class="footer">
              <p><strong>Karbonica</strong> - Building a sustainable future</p>
              <p>© 2024 Karbonica. All rights reserved.</p>
              <p style="margin-top: 10px;">This is an automated email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `).setText(`
Hi ${name},

Thank you for registering with Karbonica!

Please verify your email address by clicking the link below:
${verificationUrl}

This link will expire in 24 hours.

If you did not create an account, please ignore this email.

Best regards,
The Karbonica Team

---
Karbonica - Building a sustainable future
© 2024 Karbonica. All rights reserved.
      `);

    try {
      const response = await this.mailerSend.email.send(emailParams);
      logger.info('Verification email sent via MailerSend', {
        to: email,
        messageId: response.headers?.['x-message-id'],
      });
    } catch (error) {
      logger.error('Failed to send verification email via MailerSend', { error, to: email });
      throw new Error('Failed to send verification email');
    }
  }

  async sendPasswordResetEmail(email: string, name: string, resetToken: string): Promise<void> {
    const resetUrl = `${config.app.frontendUrl}/reset-password?token=${resetToken}`;

    const sentFrom = new Sender(this.fromEmail, this.fromName);
    const recipients = [new Recipient(email, name)];

    const emailParams = new EmailParams()
      .setFrom(sentFrom)
      .setTo(recipients)
      .setSubject('Reset Your Password - Karbonica').setHtml(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6; 
              color: #333;
              margin: 0;
              padding: 0;
              background-color: #f4f4f4;
            }
            .container { 
              max-width: 600px; 
              margin: 40px auto; 
              background: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #d9534f 0%, #c9302c 100%);
              color: white; 
              padding: 40px 20px; 
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .content { 
              padding: 40px 30px;
            }
            .button { 
              display: inline-block; 
              padding: 14px 32px; 
              background-color: #d9534f; 
              color: white !important; 
              text-decoration: none; 
              border-radius: 6px;
              margin: 24px 0;
              font-weight: 600;
              font-size: 16px;
            }
            .button-container {
              text-align: center;
              margin: 30px 0;
            }
            .footer { 
              text-align: center; 
              padding: 30px 20px;
              background-color: #f9f9f9;
              color: #666; 
              font-size: 13px;
              border-top: 1px solid #e0e0e0;
            }
            .warning {
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 12px;
              margin: 20px 0;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔒 Password Reset</h1>
            </div>
            <div class="content">
              <h2>Hi ${name},</h2>
              <p>We received a request to reset your password for your Karbonica account.</p>
              <div class="button-container">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              <div class="warning">
                <strong>⏰ Important:</strong> This link will expire in 1 hour.
              </div>
              <p style="color: #666; font-size: 14px;">If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
            </div>
            <div class="footer">
              <p>© 2024 Karbonica. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `).setText(`
Hi ${name},

We received a request to reset your password.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you did not request a password reset, please ignore this email.

Best regards,
The Karbonica Team
      `);

    try {
      const response = await this.mailerSend.email.send(emailParams);
      logger.info('Password reset email sent via MailerSend', {
        to: email,
        messageId: response.headers?.['x-message-id'],
      });
    } catch (error) {
      logger.error('Failed to send password reset email via MailerSend', { error, to: email });
      throw new Error('Failed to send password reset email');
    }
  }

  async sendNotificationEmail(email: string, subject: string, body: string): Promise<void> {
    const sentFrom = new Sender(this.fromEmail, this.fromName);
    const recipients = [new Recipient(email)];

    const emailParams = new EmailParams()
      .setFrom(sentFrom)
      .setTo(recipients)
      .setSubject(subject)
      .setHtml(body)
      .setText(body.replace(/<[^>]*>/g, '')); // Strip HTML for text version

    try {
      const response = await this.mailerSend.email.send(emailParams);
      logger.info('Notification email sent via MailerSend', {
        to: email,
        subject,
        messageId: response.headers?.['x-message-id'],
      });
    } catch (error) {
      logger.error('Failed to send notification email via MailerSend', { error, to: email });
      throw new Error('Failed to send notification email');
    }
  }
}
