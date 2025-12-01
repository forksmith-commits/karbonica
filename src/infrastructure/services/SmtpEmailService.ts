import nodemailer from 'nodemailer';
import { IEmailService } from '../../domain/services/IEmailService';
import { logger } from '../../utils/logger';
import { config } from '../../config';

/**
 * SMTP Email Service
 * Sends real emails using SMTP (works with Gmail, SendGrid, Ethereal, etc.)
 */
export class SmtpEmailService implements IEmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // Verify connection configuration
    this.transporter.verify((error, _success) => {
      if (error) {
        logger.error('SMTP connection failed', { error });
      } else {
        logger.info('SMTP server is ready to send emails');
      }
    });
  }

  async sendVerificationEmail(
    email: string,
    name: string,
    verificationToken: string
  ): Promise<void> {
    const verificationUrl = `${config.app.frontendUrl}/verify-email?token=${verificationToken}`;

    const mailOptions = {
      from: `"Karbonica" <${process.env.SMTP_FROM || 'noreply@karbonica.com'}>`,
      to: email,
      subject: 'Verify Your Email - Karbonica',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2c5f2d; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 30px; }
            .button { 
              display: inline-block; 
              padding: 12px 30px; 
              background-color: #2c5f2d; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .token { 
              background-color: #e8e8e8; 
              padding: 10px; 
              border-radius: 5px; 
              font-family: monospace;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🌱 Karbonica</h1>
              <p>Carbon Credit Registry Platform</p>
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

Or copy and paste this link into your browser.

This link will expire in 24 hours.

If you did not create an account, please ignore this email.

Best regards,
The Karbonica Team
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Verification email sent', {
        to: email,
        messageId: info.messageId,
        previewUrl: nodemailer.getTestMessageUrl(info), // Only works with Ethereal
      });

      // Log preview URL for Ethereal (testing service)
      if (process.env.SMTP_HOST?.includes('ethereal')) {
        console.log('\n📧 Preview email at:', nodemailer.getTestMessageUrl(info));
      }
    } catch (error) {
      logger.error('Failed to send verification email', { error, to: email });
      throw new Error('Failed to send verification email');
    }
  }

  async sendPasswordResetEmail(email: string, name: string, resetToken: string): Promise<void> {
    const resetUrl = `${config.app.frontendUrl}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: `"Karbonica" <${process.env.SMTP_FROM || 'noreply@karbonica.com'}>`,
      to: email,
      subject: 'Reset Your Password - Karbonica',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2c5f2d; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 30px; }
            .button { 
              display: inline-block; 
              padding: 12px 30px; 
              background-color: #d9534f; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🌱 Karbonica</h1>
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
      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Password reset email sent', {
        to: email,
        messageId: info.messageId,
      });
    } catch (error) {
      logger.error('Failed to send password reset email', { error, to: email });
      throw new Error('Failed to send password reset email');
    }
  }

  async sendNotificationEmail(email: string, subject: string, body: string): Promise<void> {
    const mailOptions = {
      from: `"Karbonica" <${process.env.SMTP_FROM || 'noreply@karbonica.com'}>`,
      to: email,
      subject: subject,
      html: body,
      text: body.replace(/<[^>]*>/g, ''), // Strip HTML tags for text version
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Notification email sent', {
        to: email,
        subject,
        messageId: info.messageId,
      });
    } catch (error) {
      logger.error('Failed to send notification email', { error, to: email });
      throw new Error('Failed to send notification email');
    }
  }
}
