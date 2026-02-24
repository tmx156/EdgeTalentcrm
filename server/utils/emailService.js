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
 * @param {Array} attachments - Email attachments (optional)
 * @param {string|Object} accountKey - Email account to use: 'primary', 'secondary', UUID, or database account object (default: 'primary')
 * @returns {Promise<{success: boolean, response?: string, error?: string}>}
 */
async function sendEmail(to, subject, text, attachments = [], accountKey = 'primary') {
  const emailId = Math.random().toString(36).substring(2, 8);

  // Determine account info for logging
  let accountEmail;
  let accountDisplay;
  const isDbAccount = typeof accountKey === 'object' && accountKey.email;

  if (isDbAccount) {
    accountEmail = accountKey.email;
    accountDisplay = `database:${accountKey.name || accountKey.email}`;
  } else {
    const accountInfo = gmailService.getAccountInfo(accountKey);
    accountEmail = accountInfo?.email || 'Unknown';
    accountDisplay = accountKey;
  }

  console.log(`📧 [${emailId}] Sending email via Gmail API (${accountDisplay}): ${subject} → ${to}`);
  console.log(`📧 [${emailId}] Email Account: ${accountDisplay} (${accountEmail})`);

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

    console.log(`📧 [${emailId}] Sending email via Gmail API (${accountDisplay})...`);
    console.log(`📧 [${emailId}] Content type: ${isHtml ? 'HTML' : 'Plain text'}`);

    // Send via Gmail API with specified account
    // Always send as "Edge Talent" or the account's display name
    const startTime = Date.now();
    const fromName = isDbAccount ? (accountKey.display_name || 'Edge Talent') : 'Edge Talent';
    const emailResult = await gmailService.sendEmail(to, subject, text, {
      isHtml,
      accountKey: accountKey, // Pass through the account key or database account object
      fromName: fromName,
      attachments: attachments || [] // Pass attachments to Gmail API
    });

    const timeTaken = Date.now() - startTime;

    if (emailResult.success) {
      console.log('\n' + '✅'.repeat(40));
      console.log(`✅ EMAIL SENT SUCCESSFULLY via Gmail API (${accountDisplay})`);
      console.log('✅'.repeat(40));
      console.log(`✅ Message ID: ${emailResult.messageId || 'N/A'}`);
      console.log(`✅ Account:    ${accountDisplay} (${emailResult.fromEmail || accountEmail})`);
      console.log(`✅ Provider:   Gmail API`);
      console.log(`✅ Time Taken: ${timeTaken}ms`);
      console.log('='.repeat(80) + '\n');

      return {
        success: true,
        messageId: emailResult.messageId,
        response: `Email sent via Gmail API (${accountDisplay}: ${emailResult.fromEmail})`,
        provider: 'gmail-api',
        accountKey: isDbAccount ? accountKey.id : accountKey,
        fromEmail: emailResult.fromEmail,
        isDbAccount: isDbAccount
      };
    } else {
      // Check if it's an invalid_grant error and we're using secondary/tertiary account or database account
      // Automatically fallback: try default database account first, then primary env var
      const shouldFallback = emailResult.isInvalidGrant && (accountKey === 'secondary' || accountKey === 'tertiary' || accountKey === 'quaternary' || accountKey === 'quinary' || isDbAccount);

      if (shouldFallback) {
        console.log(`⚠️ [${emailId}] ${accountDisplay} token expired, attempting fallback...`);

        // Try 1: If this was a non-default database account, try the default database account
        if (isDbAccount && !accountKey.is_default) {
          try {
            console.log(`⚠️ [${emailId}] Trying default database account...`);
            const emailAccountService = require('./emailAccountService');
            const defaultAccount = await emailAccountService.getDefaultAccount();

            if (defaultAccount && defaultAccount.id !== accountKey.id) {
              const fallbackResult = await gmailService.sendEmail(to, subject, text, {
                isHtml,
                accountKey: defaultAccount,
                fromName: defaultAccount.display_name || 'Edge Talent',
                attachments: attachments || []
              });

              if (fallbackResult.success) {
                console.log('\n' + '✅'.repeat(40));
                console.log(`✅ EMAIL SENT SUCCESSFULLY via Gmail API (default db account - fallback)`);
                console.log('✅'.repeat(40));
                console.log(`✅ Message ID: ${fallbackResult.messageId || 'N/A'}`);
                console.log(`✅ Account:    ${defaultAccount.email} (database default)`);
                console.log(`✅ Provider:   Gmail API`);
                console.log(`⚠️  Note: ${accountDisplay} token expired, used default database account as fallback`);
                console.log('='.repeat(80) + '\n');

                return {
                  success: true,
                  messageId: fallbackResult.messageId,
                  response: `Email sent via Gmail API (default db - fallback from ${accountDisplay})`,
                  provider: 'gmail-api',
                  accountKey: defaultAccount.id,
                  fromEmail: fallbackResult.fromEmail,
                  fallbackUsed: true,
                  fallbackType: 'database-default',
                  originalError: emailResult.error
                };
              }
            }
          } catch (dbFallbackError) {
            console.error(`❌ [${emailId}] Default database account fallback failed:`, dbFallbackError.message);
          }
        }

        // Try 2: Fall back to primary env var account
        try {
          console.log(`⚠️ [${emailId}] Trying primary env var account...`);
          const fallbackResult = await gmailService.sendEmail(to, subject, text, {
            isHtml,
            accountKey: 'primary',
            fromName: 'Edge Talent',
            attachments: attachments || []
          });

          if (fallbackResult.success) {
            console.log('\n' + '✅'.repeat(40));
            console.log(`✅ EMAIL SENT SUCCESSFULLY via Gmail API (primary env - fallback)`);
            console.log('✅'.repeat(40));
            console.log(`✅ Message ID: ${fallbackResult.messageId || 'N/A'}`);
            console.log(`✅ Account:    primary (${fallbackResult.fromEmail})`);
            console.log(`✅ Provider:   Gmail API`);
            console.log(`⚠️  Note: ${accountDisplay} token expired, used primary env account as fallback`);
            console.log('='.repeat(80) + '\n');

            return {
              success: true,
              messageId: fallbackResult.messageId,
              response: `Email sent via Gmail API (primary env - fallback from ${accountDisplay})`,
              provider: 'gmail-api',
              accountKey: 'primary',
              fromEmail: fallbackResult.fromEmail,
              fallbackUsed: true,
              fallbackType: 'env-primary',
              originalError: emailResult.error
            };
          }
        } catch (fallbackError) {
          console.error(`❌ [${emailId}] Primary env account fallback also failed:`, fallbackError.message);
        }
      }

      console.log('\n' + '❌'.repeat(40));
      console.log(`❌ EMAIL SEND FAILED via Gmail API (${accountDisplay})`);
      console.log('❌'.repeat(40));
      console.log(`❌ Error: ${emailResult.error || 'Unknown error'}`);
      console.log(`❌ Code:  ${emailResult.code || 'N/A'}`);

      if (emailResult.isInvalidGrant && !isDbAccount) {
        const railwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN
          ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN.replace(/^https?:\/\//, '')}`
          : process.env.GMAIL_REDIRECT_URI?.replace('/api/gmail/oauth2callback', '') ||
            'https://edgetalentcrm-production.up.railway.app';

        const authEndpointMap = { secondary: 'auth2', tertiary: 'auth3', quaternary: 'auth4', quinary: 'auth5' };
        const authEndpoint = `${railwayUrl}/api/gmail/${authEndpointMap[accountKey] || 'auth'}`;

        const tokenVarMap = { secondary: 'GMAIL_REFRESH_TOKEN_2', tertiary: 'GMAIL_REFRESH_TOKEN_3', quaternary: 'GMAIL_REFRESH_TOKEN_4', quinary: 'GMAIL_REFRESH_TOKEN_5' };
        const tokenVar = tokenVarMap[accountKey] || 'GMAIL_REFRESH_TOKEN';

        console.log(`❌ ACTION REQUIRED: Re-authenticate at ${authEndpoint}`);
        console.log(`❌ Then update ${tokenVar} in Railway environment variables`);
      } else if (emailResult.isInvalidGrant && isDbAccount) {
        console.log(`❌ ACTION REQUIRED: Update refresh token for ${accountEmail} in Email Accounts settings`);
      }

      console.log('='.repeat(80) + '\n');

      return {
        success: false,
        error: emailResult.error || 'Unknown Gmail API error',
        code: emailResult.code,
        accountKey: isDbAccount ? accountKey.id : accountKey,
        isInvalidGrant: emailResult.isInvalidGrant || false,
        isDbAccount: isDbAccount
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
