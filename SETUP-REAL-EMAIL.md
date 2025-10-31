# Setup Real Email Testing

You have 3 options for testing real emails:

## Option 1: Ethereal Email (Recommended for Testing) ⭐

Ethereal is a fake SMTP service that captures emails for testing. Perfect for development!

### Step 1: Create Ethereal Account
Visit: https://ethereal.email/create

You'll get credentials like:
```
Host: smtp.ethereal.email
Port: 587
Username: your.username@ethereal.email
Password: your-password-here
```

### Step 2: Add to .env
```env
# Email Configuration
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your.username@ethereal.email
SMTP_PASSWORD=your-password-here
SMTP_FROM=noreply@karbonica.com
```

### Step 3: Install nodemailer
```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

### Step 4: Update auth routes
Change from `ConsoleEmailService` to `SmtpEmailService`:

```typescript
// In src/routes/auth.ts
import { SmtpEmailService } from '../infrastructure/services/SmtpEmailService';

const getAuthService = () => {
  const userRepository = new UserRepository();
  const emailVerificationTokenRepository = new EmailVerificationTokenRepository();
  const emailService = new SmtpEmailService(); // Changed this line
  return new AuthService(userRepository, emailVerificationTokenRepository, emailService);
};
```

### Step 5: Test!
1. Register a user via Postman
2. Check your server console for a preview URL like:
   ```
   📧 Preview email at: https://ethereal.email/message/xxxxx
   ```
3. Click that URL to see the email in your browser!
4. Copy the verification token from the email
5. Use it to verify the email

**Pros:**
- ✅ Free
- ✅ No signup required (auto-generated accounts)
- ✅ See emails in browser
- ✅ Perfect for testing
- ✅ No rate limits

**Cons:**
- ❌ Emails aren't actually delivered (fake inbox)

---

## Option 2: Gmail SMTP (Real Emails)

Send real emails using your Gmail account.

### Step 1: Enable App Password
1. Go to your Google Account: https://myaccount.google.com/
2. Security → 2-Step Verification (enable if not already)
3. Security → App passwords
4. Generate an app password for "Mail"
5. Copy the 16-character password

### Step 2: Add to .env
```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your.email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
SMTP_FROM=your.email@gmail.com
```

### Step 3: Install nodemailer (if not already)
```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

### Step 4: Update auth routes (same as Option 1)

### Step 5: Test!
1. Register with your real email address
2. Check your inbox for the verification email
3. Click the link or copy the token
4. Verify!

**Pros:**
- ✅ Real emails delivered
- ✅ Free (Gmail account)
- ✅ Test with actual email clients

**Cons:**
- ❌ Gmail has sending limits (500/day)
- ❌ Requires app password setup
- ❌ May trigger spam filters

---

## Option 3: SendGrid (Production-Ready)

Professional email service with free tier (100 emails/day).

### Step 1: Create SendGrid Account
1. Sign up at: https://sendgrid.com/
2. Verify your email
3. Create an API key (Settings → API Keys)
4. Copy the API key

### Step 2: Add to .env
```env
# Email Configuration
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key-here
SMTP_FROM=noreply@yourdomain.com
```

### Step 3: Verify Sender Identity
In SendGrid dashboard:
- Settings → Sender Authentication
- Verify a single sender email address

### Step 4: Install nodemailer (if not already)
```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

### Step 5: Update auth routes (same as Option 1)

**Pros:**
- ✅ Production-ready
- ✅ High deliverability
- ✅ Analytics dashboard
- ✅ 100 emails/day free

**Cons:**
- ❌ Requires account setup
- ❌ Need to verify sender domain/email

---

## Quick Setup Script

I'll create a script to help you set up Ethereal (easiest option):

### Step 1: Install nodemailer
```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

### Step 2: Run this script to get Ethereal credentials
```bash
node setup-ethereal.js
```

### Step 3: Copy the credentials to your .env file

### Step 4: Update auth routes to use SmtpEmailService

---

## Switching Between Email Services

You can make it configurable in your .env:

```env
# Email Configuration
EMAIL_SERVICE=smtp  # Options: console, smtp
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your.username@ethereal.email
SMTP_PASSWORD=your-password
SMTP_FROM=noreply@karbonica.com
```

Then in your code:
```typescript
const getAuthService = () => {
  const userRepository = new UserRepository();
  const emailVerificationTokenRepository = new EmailVerificationTokenRepository();
  
  // Choose email service based on environment
  const emailService = process.env.EMAIL_SERVICE === 'smtp' 
    ? new SmtpEmailService() 
    : new ConsoleEmailService();
    
  return new AuthService(userRepository, emailVerificationTokenRepository, emailService);
};
```

---

## My Recommendation

For testing right now:
1. **Use Ethereal** - It's the fastest to set up and perfect for testing
2. Visit https://ethereal.email/create
3. Copy credentials to .env
4. Install nodemailer
5. Switch to SmtpEmailService
6. Test and see beautiful emails in your browser!

For production later:
- Use **SendGrid** or **AWS SES** for reliability and deliverability

Want me to help you set up any of these options?
