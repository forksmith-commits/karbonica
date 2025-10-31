// Quick script to generate Ethereal email credentials for testing
const nodemailer = require('nodemailer');

async function setupEthereal() {
  console.log('🔧 Setting up Ethereal Email for testing...\n');

  try {
    // Generate test SMTP service account from ethereal.email
    const testAccount = await nodemailer.createTestAccount();

    console.log('✅ Ethereal Email account created!\n');
    console.log('📋 Add these to your .env file:\n');
    console.log('# Email Configuration');
    console.log('EMAIL_SERVICE=smtp');
    console.log(`SMTP_HOST=${testAccount.smtp.host}`);
    console.log(`SMTP_PORT=${testAccount.smtp.port}`);
    console.log('SMTP_SECURE=false');
    console.log(`SMTP_USER=${testAccount.user}`);
    console.log(`SMTP_PASSWORD=${testAccount.pass}`);
    console.log('SMTP_FROM=noreply@karbonica.com');
    console.log('\n');
    console.log('📧 Web Interface: https://ethereal.email/');
    console.log(`   Username: ${testAccount.user}`);
    console.log(`   Password: ${testAccount.pass}`);
    console.log('\n');
    console.log('🎯 Next steps:');
    console.log('1. Copy the above credentials to your .env file');
    console.log('2. Run: npm install nodemailer @types/nodemailer');
    console.log('3. Update src/routes/auth.ts to use SmtpEmailService');
    console.log('4. Restart your server');
    console.log('5. Register a user and check console for email preview URL!');
    console.log('\n');
  } catch (error) {
    console.error('❌ Error creating Ethereal account:', error.message);
    console.log('\n💡 Alternative: Visit https://ethereal.email/create manually');
  }
}

setupEthereal();
