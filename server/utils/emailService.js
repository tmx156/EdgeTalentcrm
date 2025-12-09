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

  // Log attachments if present
  if (attachments && attachments.length > 0) {
    console.log(`📎 [${emailId}] Attachments: ${attachments.length} file(s) will be included`);
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
    // Always send as "Edge Talent" regardless of account
    const startTime = Date.now();
    const emailResult = await gmailService.sendEmail(to, subject, text, {
      isHtml,
      accountKey: accountKey, // Pass through the account key
      fromName: 'Edge Talent', // Always use "Edge Talent" as sender name
      attachments: attachments || [] // Pass attachments to Gmail API
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
      // Check if it's an invalid_grant error and we're using secondary account
      // Automatically fallback to primary account
      if (accountKey === 'secondary' && emailResult.isInvalidGrant) {
        console.log(`⚠️ [${emailId}] Secondary account token expired, falling back to primary account...`);
        
        try {
          const fallbackResult = await gmailService.sendEmail(to, subject, text, {
            isHtml,
            accountKey: 'primary',
            fromName: 'Edge Talent',
            attachments: attachments || []
          });

          if (fallbackResult.success) {
            console.log('\n' + '✅'.repeat(40));
            console.log(`✅ EMAIL SENT SUCCESSFULLY via Gmail API (primary - fallback)`);
            console.log('✅'.repeat(40));
            console.log(`✅ Message ID: ${fallbackResult.messageId || 'N/A'}`);
            console.log(`✅ Account:    primary (${fallbackResult.fromEmail})`);
            console.log(`✅ Provider:   Gmail API`);
            console.log(`⚠️  Note: Secondary account token expired, used primary account as fallback`);
            console.log('='.repeat(80) + '\n');

            return {
              success: true,
              messageId: fallbackResult.messageId,
              response: `Email sent via Gmail API (primary - fallback from secondary)`,
              provider: 'gmail-api',
              accountKey: 'primary',
              fromEmail: fallbackResult.fromEmail,
              fallbackUsed: true,
              originalError: emailResult.error
            };
          }
        } catch (fallbackError) {
          console.error(`❌ [${emailId}] Fallback to primary account also failed:`, fallbackError.message);
        }
      }

      console.log('\n' + '❌'.repeat(40));
      console.log(`❌ EMAIL SEND FAILED via Gmail API (${accountKey})`);
      console.log('❌'.repeat(40));
      console.log(`❌ Error: ${emailResult.error || 'Unknown error'}`);
      console.log(`❌ Code:  ${emailResult.code || 'N/A'}`);
      
      if (emailResult.isInvalidGrant) {
        const railwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
          ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN.replace(/^https?:\/\//, '')}`
          : process.env.GMAIL_REDIRECT_URI?.replace('/api/gmail/oauth2callback', '') || 
            'https://edgetalentcrm-production.up.railway.app';
        
        const authEndpoint = accountKey === 'secondary' 
          ? `${railwayUrl}/api/gmail/auth2`
          : `${railwayUrl}/api/gmail/auth`;
        
        const tokenVar = accountKey === 'secondary' ? 'GMAIL_REFRESH_TOKEN_2' : 'GMAIL_REFRESH_TOKEN';
        
        console.log(`❌ ACTION REQUIRED: Re-authenticate at ${authEndpoint}`);
        console.log(`❌ Then update ${tokenVar} in Railway environment variables`);
      }
      
      console.log('='.repeat(80) + '\n');

      return {
        success: false,
        error: emailResult.error || 'Unknown Gmail API error',
        code: emailResult.code,
        accountKey: accountKey,
        isInvalidGrant: emailResult.isInvalidGrant || false
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
