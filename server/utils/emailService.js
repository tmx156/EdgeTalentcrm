require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// ========================================
// ✅ GMAIL API SERVICE - MULTI-ACCOUNT SUPPORT
// ========================================
console.log('📧 Email Service: Using Gmail API with Multi-Account Support');

const gmailService = require('./gmailService');

// Log configured accounts
const primaryInfo = gmailService.getAccountInfo('primary');
const secondaryInfo = gmailService.getAccountInfo('secondary');

console.log('📧 Primary Account:', primaryInfo?.email || 'Not configured');
console.log('📧 Secondary Account:', secondaryInfo?.email || 'Not configured');

/**
 * Send an email using Gmail API
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Email plain text body
 * @param {Array} attachments - Email attachments (optional) - NOT YET SUPPORTED IN GMAIL API
 * @param {string} accountKey - Email account to use: 'primary' or 'secondary' (default: 'primary')
 * @returns {Promise<{success: boolean, response?: string, error?: string}>}
 */
async function sendEmail(to, subject, text, attachments = [], accountKey = 'primary') {
  const emailId = Math.random().toString(36).substring(2, 8);

  // Get account info for logging
  const accountInfo = gmailService.getAccountInfo(accountKey);
  const accountEmail = accountInfo?.email || 'Unknown';

  console.log(`📧 [${emailId}] Sending email via Gmail API (${accountKey}): ${subject} → ${to}`);
  console.log(`📧 [${emailId}] Email Account: ${accountKey} (${accountEmail})`);

  // Note about attachments
  if (attachments && attachments.length > 0) {
    console.warn(`⚠️ [${emailId}] Attachments not yet supported in Gmail API - ${attachments.length} attachments will be ignored`);
    console.warn(`⚠️ [${emailId}] TODO: Implement attachment support in gmailService.js`);
  }

  if (!to || !subject || !text) {
    const errorMsg = `📧 [${emailId}] Missing required fields: ${!to ? 'to, ' : ''}${!subject ? 'subject, ' : ''}${!text ? 'body' : ''}`.replace(/, $/, '');
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }

  try {
    // Detect if text contains HTML
    const isHtml = text.includes('<') && text.includes('>');

    console.log(`📧 [${emailId}] Sending email via Gmail API (${accountKey})...`);
    console.log(`📧 [${emailId}] Content type: ${isHtml ? 'HTML' : 'Plain text'}`);

    // Send via Gmail API with specified account
    const startTime = Date.now();
    const emailResult = await gmailService.sendEmail(to, subject, text, {
      isHtml,
      accountKey: accountKey // Pass through the account key
    });

    const timeTaken = Date.now() - startTime;

    if (emailResult.success) {
      console.log('\n' + '✅'.repeat(40));
      console.log(`✅ EMAIL SENT SUCCESSFULLY via Gmail API (${accountKey})`);
      console.log('✅'.repeat(40));
      console.log(`✅ Message ID: ${emailResult.messageId || 'N/A'}`);
      console.log(`✅ Account:    ${accountKey} (${emailResult.fromEmail || accountEmail})`);
      console.log(`✅ Provider:   Gmail API`);
      console.log(`✅ Time Taken: ${timeTaken}ms`);
      console.log('='.repeat(80) + '\n');

      return {
        success: true,
        messageId: emailResult.messageId,
        response: `Email sent via Gmail API (${accountKey}: ${emailResult.fromEmail})`,
        provider: 'gmail-api',
        accountKey: accountKey,
        fromEmail: emailResult.fromEmail
      };
    } else {
      console.log('\n' + '❌'.repeat(40));
      console.log(`❌ EMAIL SEND FAILED via Gmail API (${accountKey})`);
      console.log('❌'.repeat(40));
      console.log(`❌ Error: ${emailResult.error || 'Unknown error'}`);
      console.log(`❌ Code:  ${emailResult.code || 'N/A'}`);
      console.log('='.repeat(80) + '\n');

      return {
        success: false,
        error: emailResult.error || 'Unknown Gmail API error',
        code: emailResult.code,
        accountKey: accountKey
      };
    }

  } catch (error) {
    console.error(`❌ [${emailId}] Email send failed: ${error.message}`);

    return {
      success: false,
      error: error.message,
      code: error.code,
      accountKey: accountKey
    };
  }
}

module.exports = {
  sendEmail
};
