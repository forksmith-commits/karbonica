# MailerSend Setup Guide

## What's Been Done:

✅ Created `MailerSendEmailService` with beautiful HTML email templates
✅ Updated `.env` with your MailerSend API key
✅ Updated auth routes to use MailerSend
✅ Professional email designs with gradients and modern styling

## Installation:

### Step 1: Stop your server
Press `Ctrl+C`

### Step 2: Install MailerSend package
```bash
npm install mailersend
```

### Step 3: Restart server
```bash
npm run dev
```

## Configuration:

Your `.env` is already configured with:
```env
EMAIL_SERVICE=mailersend
MAILERSEND_API_KEY=mlsn.f53bfd86e30eeef283378c7b644dfb39e8dd4a19a802d6bc27b6675f542bf795
MAILERSEND_FROM_EMAIL=noreply@trial-0r83ql3zx7pg9yjw.mlsender.net
MAILERSEND_FROM_NAME=Karbonica
```

## Testing:

### Register a User in Postman:
**POST** `http://localhost:3000/api/v1/auth/register`

```json
{
  "email": "your-email@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "company": "Acme Corp",
  "role": "developer"
}
```

You'll receive a **beautiful HTML email** with:
- 🌱 Karbonica branding
- Modern gradient header
- Professional styling
- Green "Verify Email Address" button
- Mobile-responsive design
- 24-hour expiration warning

## Email Features:

### Verification Email:
- Beautiful gradient green header
- Large verification button
- Fallback link for copy/paste
- Warning about 24-hour expiration
- Professional footer
- Plain text fallback

### Password Reset Email:
- Red gradient header for urgency
- Reset password button
- 1-hour expiration warning
- Security notice

## MailerSend Advantages:

✅ **Better Deliverability** - Higher inbox placement rate
✅ **No Sandbox Restrictions** - Send to any email (no authorized recipients needed)
✅ **Free Tier** - 12,000 emails/month free forever
✅ **Modern API** - Cleaner, easier to use
✅ **Email Analytics** - Track opens, clicks, bounces
✅ **Template Support** - Visual email builder
✅ **Webhooks** - Real-time email events

## Monitoring:

Check your emails in MailerSend dashboard:
1. Go to: https://app.mailersend.com/
2. Click "Activity" to see all sent emails
3. View delivery status, opens, clicks
4. Debug any issues

## Switching Email Services:

You can easily switch between services by changing `EMAIL_SERVICE` in `.env`:

```env
EMAIL_SERVICE=console      # Log to console (development)
EMAIL_SERVICE=mailersend   # MailerSend (recommended)
EMAIL_SERVICE=mailgun      # Mailgun
EMAIL_SERVICE=smtp         # Generic SMTP
```

## Troubleshooting:

### Issue: "Cannot find module 'mailersend'"
**Solution:** Run `npm install mailersend`

### Issue: Email not received
**Solution:**
1. Check spam folder
2. Verify API key is correct
3. Check MailerSend dashboard for delivery status
4. Make sure `EMAIL_SERVICE=mailersend` in .env

### Issue: "Invalid API key"
**Solution:** Double-check your API key in .env matches your MailerSend dashboard

## Next Steps:

### Verify Your Domain (Optional):
1. Go to MailerSend dashboard
2. Add your custom domain
3. Update DNS records
4. Update `MAILERSEND_FROM_EMAIL` to use your domain

### Create Email Templates (Optional):
1. Use MailerSend's visual template builder
2. Create branded templates
3. Use template IDs in your code

### Set Up Webhooks (Optional):
1. Configure webhooks in MailerSend
2. Receive real-time email events
3. Track bounces, complaints, opens, clicks

## Summary:

✅ MailerSend configured and ready
✅ Beautiful HTML email templates
✅ No sandbox restrictions
✅ 12,000 free emails/month
✅ Better deliverability than Mailgun
✅ Easy to monitor and debug

Just install the package and test! 🚀
