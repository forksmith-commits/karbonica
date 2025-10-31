# Setup Mailgun for Email Verification

Mailgun is a professional email service with a free tier (5,000 emails/month for 3 months).

## Step 1: Create Mailgun Account

1. Go to: https://signup.mailgun.com/
2. Sign up for a free account
3. Verify your email address
4. Complete the account setup

## Step 2: Get Your Mailgun Credentials

### Option A: Using Mailgun Sandbox Domain (Quick Testing)

After signup, you'll get a sandbox domain automatically:

1. Go to: https://app.mailgun.com/app/sending/domains
2. Click on your sandbox domain (looks like: `sandboxXXXXXXXX.mailgun.org`)
3. You'll see:
   - **SMTP Hostname:** `smtp.mailgun.org`
   - **Port:** `587` (or `465` for SSL)
   - **Username:** `postmaster@sandboxXXXXXXXX.mailgun.org`
   - **Password:** Click "Reset Password" to get/reset it

**Note:** Sandbox domains can only send to **authorized recipients**. You need to add your test email addresses.

4. Scroll down to "Authorized Recipients"
5. Click "Add Recipient"
6. Enter your email address (the one you'll use for testing)
7. Check your email and click the verification link

### Option B: Using Your Own Domain (Production)

1. Go to: https://app.mailgun.com/app/sending/domains
2. Click "Add New Domain"
3. Enter your domain (e.g., `mg.yourdomain.com`)
4. Follow the DNS setup instructions (add MX, TXT, CNAME records)
5. Wait for verification (can take a few minutes to hours)
6. Once verified, get your SMTP credentials from the domain settings

## Step 3: Add Credentials to .env

Add these to your `.env` file:

```env
# Email Configuration
EMAIL_SERVICE=smtp
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@sandboxXXXXXXXX.mailgun.org
SMTP_PASSWORD=your-mailgun-smtp-password
SMTP_FROM=noreply@sandboxXXXXXXXX.mailgun.org
```

**Replace:**
- `sandboxXXXXXXXX` with your actual sandbox domain
- `your-mailgun-smtp-password` with your SMTP password

## Step 4: Install nodemailer (if not already installed)

```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

## Step 5: Update auth routes

In `src/routes/auth.ts`, change from `ConsoleEmailService` to `SmtpEmailService`:

```typescript
import { SmtpEmailService } from '../infrastructure/services/SmtpEmailService';

const getAuthService = () => {
  const userRepository = new UserRepository();
  const emailVerificationTokenRepository = new EmailVerificationTokenRepository();
  const emailService = new SmtpEmailService(); // Changed this line
  return new AuthService(userRepository, emailVerificationTokenRepository, emailService);
};
```

## Step 6: Test!

1. **Restart your server:**
   ```bash
   npm run dev
   ```

2. **Register a user in Postman:**
   - POST `http://localhost:3000/api/v1/auth/register`
   - Use an email address you added as an authorized recipient
   ```json
   {
     "email": "your-authorized-email@example.com",
     "password": "SecurePass123!",
     "name": "Test User",
     "company": "Test Company",
     "role": "developer"
   }
   ```

3. **Check your email inbox!** You should receive a beautiful HTML email with a verification link.

4. **Click the verification link** or copy the token and verify via Postman:
   - GET `http://localhost:3000/api/v1/auth/verify-email?token=YOUR_TOKEN`

## Troubleshooting

### Issue: "Free accounts are for test purposes only"

**Solution:** You're using the sandbox domain. You need to:
1. Add your test email as an authorized recipient
2. Verify the email address
3. Only send to that verified email

### Issue: "Authentication failed"

**Solution:** 
1. Make sure you're using the correct SMTP password
2. Reset your SMTP password in Mailgun dashboard if needed
3. Check that username includes the full domain: `postmaster@sandboxXXX.mailgun.org`

### Issue: "Email not received"

**Solution:**
1. Check spam/junk folder
2. Verify the recipient email is authorized (for sandbox)
3. Check Mailgun logs: https://app.mailgun.com/app/logs
4. Make sure your server restarted after adding .env variables

### Issue: "Domain not verified"

**Solution:**
1. If using custom domain, check DNS records are properly set
2. Wait a few hours for DNS propagation
3. Use sandbox domain for immediate testing

## Mailgun Dashboard Features

Once set up, you can:
- **View Logs:** See all sent emails at https://app.mailgun.com/app/logs
- **Track Deliveries:** See opens, clicks, bounces
- **Analytics:** View email statistics
- **Templates:** Create email templates (advanced)

## Upgrading from Sandbox

When ready for production:

1. **Add Payment Method:**
   - Go to: https://app.mailgun.com/app/account/billing
   - Add a credit card (you won't be charged unless you exceed free tier)

2. **Verify Your Domain:**
   - Add your custom domain
   - Set up DNS records
   - Wait for verification

3. **Update .env:**
   ```env
   SMTP_USER=postmaster@mg.yourdomain.com
   SMTP_FROM=noreply@yourdomain.com
   ```

4. **Remove Authorized Recipients Restriction:**
   - With a verified domain, you can send to any email address

## Free Tier Limits

- **5,000 emails/month** for first 3 months
- After 3 months: Pay-as-you-go ($0.80 per 1,000 emails)
- No daily sending limits
- Full API access
- Email validation included

## Alternative: Mailgun API (Instead of SMTP)

Mailgun also has a REST API that's faster than SMTP. If you want to use it:

```bash
npm install mailgun.js form-data
```

Let me know if you want me to create a `MailgunApiService` instead of using SMTP!

## Summary

1. ✅ Sign up at https://signup.mailgun.com/
2. ✅ Get sandbox domain credentials
3. ✅ Add your test email as authorized recipient
4. ✅ Add credentials to .env
5. ✅ Update auth routes to use SmtpEmailService
6. ✅ Test and receive real emails!

Need help with any step? Let me know!
