# Install Mailgun API - Quick Guide

## Step 1: Stop your dev server
Press `Ctrl+C` in your terminal to stop the running server

## Step 2: Install packages
```bash
npm install mailgun.js form-data
npm install --save-dev @types/mailgun.js
```

## Step 3: Add authorized recipient
1. Go to: https://app.mailgun.com/app/sending/domains
2. Click your sandbox domain
3. Scroll to "Authorized Recipients"
4. Click "Add Recipient"
5. Enter your email address
6. Check your email and verify it

## Step 4: Enable Mailgun in .env
Change this line in your `.env`:
```env
EMAIL_SERVICE=mailgun  # Change from 'console' to 'mailgun'
```

## Step 5: Restart server
```bash
npm run dev
```

## Step 6: Test in Postman!
Register a user with your authorized email and receive a real email! 📧

---

## What's Already Done:
✅ Mailgun API service created (`MailgunEmailService.ts`)
✅ Your API key and domain added to `.env`
✅ Auth routes updated to use Mailgun
✅ Beautiful HTML email templates ready

## Just Need To:
1. Install the packages
2. Add authorized recipient
3. Change EMAIL_SERVICE to 'mailgun'
4. Restart and test!

That's it! Way easier than SMTP! 🚀
