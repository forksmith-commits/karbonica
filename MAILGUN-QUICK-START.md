# Mailgun Quick Start Checklist ✅

Follow these steps to send real emails with Mailgun:

## ☐ Step 1: Install nodemailer
```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

## ☐ Step 2: Sign up for Mailgun
1. Go to: https://signup.mailgun.com/
2. Create a free account
3. Verify your email

## ☐ Step 3: Get SMTP Credentials
1. Go to: https://app.mailgun.com/app/sending/domains
2. Click on your sandbox domain (e.g., `sandboxXXXXXXXX.mailgun.org`)
3. Find these values:
   - **SMTP Hostname:** `smtp.mailgun.org`
   - **Port:** `587`
   - **Username:** `postmaster@sandboxXXXXXXXX.mailgun.org`
   - **Password:** Click "Reset Password" to get/reset it

## ☐ Step 4: Add Authorized Recipient (Important!)
Sandbox domains can only send to authorized emails:
1. Scroll down to "Authorized Recipients" section
2. Click "Add Recipient"
3. Enter YOUR email address (the one you'll test with)
4. Check your email and click the verification link

## ☐ Step 5: Update .env File
Add these lines to your `.env` file:

```env
# Email Configuration (Mailgun)
EMAIL_SERVICE=smtp
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@sandboxXXXXXXXX.mailgun.org
SMTP_PASSWORD=your-mailgun-smtp-password-here
SMTP_FROM=noreply@sandboxXXXXXXXX.mailgun.org
```

**Replace:**
- `sandboxXXXXXXXX` with your actual sandbox domain ID
- `your-mailgun-smtp-password-here` with your SMTP password

## ☐ Step 6: Restart Your Server
```bash
# Stop the current server (Ctrl+C)
npm run dev
```

## ☐ Step 7: Test in Postman!

### Register a User:
**POST** `http://localhost:3000/api/v1/auth/register`

**Body:**
```json
{
  "email": "your-authorized-email@example.com",
  "password": "SecurePass123!",
  "name": "Test User",
  "company": "Test Company",
  "role": "developer"
}
```

**Important:** Use the email you added as an authorized recipient!

### Check Your Email Inbox:
You should receive a beautiful HTML email with:
- Karbonica branding
- Green "Verify Email Address" button
- Verification link
- 24-hour expiration notice

### Verify Your Email:
Click the button in the email, or copy the token and use:

**GET** `http://localhost:3000/api/v1/auth/verify-email?token=YOUR_TOKEN`

You should get:
```json
{
  "status": "success",
  "data": {
    "message": "Email verified successfully. You can now log in."
  }
}
```

## 🎉 Success!

You're now sending real emails with Mailgun!

## Troubleshooting

### ❌ "Authentication failed"
- Double-check your SMTP username and password in .env
- Make sure username includes full domain: `postmaster@sandboxXXX.mailgun.org`
- Try resetting your SMTP password in Mailgun dashboard

### ❌ "Email not received"
- Check your spam/junk folder
- Verify you added your email as an authorized recipient
- Make sure you verified the recipient email (check for Mailgun's verification email)
- Check Mailgun logs: https://app.mailgun.com/app/logs

### ❌ "Free accounts are for test purposes only"
- This is normal for sandbox domains
- You can only send to authorized recipients
- Add and verify your test email address

### ❌ Server still using console emails
- Make sure `EMAIL_SERVICE=smtp` is in your .env
- Restart your server after updating .env
- Check that nodemailer is installed

## View Email Logs

Check all sent emails in Mailgun dashboard:
https://app.mailgun.com/app/logs

You can see:
- Delivery status
- Opens and clicks
- Bounce/failure reasons
- Full email content

## Next Steps

### For Production:
1. Add a payment method (still free up to 5,000 emails/month)
2. Verify your own domain
3. Update .env with your domain
4. Remove authorized recipient restrictions

### Current Limits:
- ✅ 5,000 emails/month (first 3 months free)
- ✅ Send to any authorized recipient
- ✅ Full email tracking and analytics
- ✅ Professional email templates

## Need Help?

Check the full guide: `SETUP-MAILGUN.md`

Or let me know what's not working!
