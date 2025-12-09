require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

/**
 * Gmail API Service - Multi-Account Support
 * Supports multiple Gmail accounts via Gmail API
 */

console.log('📧 Gmail Service: Initializing Multi-Account Support...');
console.log('📧 Primary Account (GMAIL_EMAIL):', process.env.GMAIL_EMAIL || 'Not set');
console.log('📧 Secondary Account (GMAIL_EMAIL_2):', process.env.GMAIL_EMAIL_2 || 'Not set');

// Account configurations
const ACCOUNTS = {
  primary: {
    email: process.env.GMAIL_EMAIL || 'hello@edgetalent.co.uk',
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:5000/api/gmail/oauth2callback',
    displayName: 'Edge Talent'
  },
  secondary: {
    email: process.env.GMAIL_EMAIL_2 || 'diary@edgetalent.co.uk',
    clientId: process.env.GMAIL_CLIENT_ID_2,
    clientSecret: process.env.GMAIL_CLIENT_SECRET_2,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN_2,
    redirectUri: process.env.GMAIL_REDIRECT_URI_2 || 'http://localhost:5000/api/gmail/oauth2callback2',
    displayName: 'Edge Talent'
  }
};

// Validate account configurations on startup
Object.keys(ACCOUNTS).forEach(key => {
  const account = ACCOUNTS[key];
  const hasAllCredentials = account.clientId && account.clientSecret && account.refreshToken;
  console.log(`📧 ${key.toUpperCase()} Account:`, hasAllCredentials ? '✅ Configured' : '⚠️ Missing credentials');
});

/**
 * Get authenticated Gmail client for a specific account
 * @param {string} accountKey - 'primary' or 'secondary'
 * @returns {Promise<Object>} Gmail API client
 * @throws {Error} If authentication fails with invalid_grant, includes re-auth instructions
 */
async function getGmailClient(accountKey = 'primary') {
  try {
    const account = ACCOUNTS[accountKey];

    if (!account) {
      throw new Error(`Invalid account key: ${accountKey}`);
    }

    const { clientId, clientSecret, refreshToken, redirectUri } = account;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(`Gmail API credentials not configured for ${accountKey} account`);
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // Test the token by making a simple API call to verify it's valid
    const testGmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    try {
      await testGmail.users.getProfile({ userId: 'me' });
      return testGmail;
    } catch (testError) {
      // Check if it's an invalid_grant error (token expired/revoked)
      if (testError.code === 400 && (
        testError.message?.includes('invalid_grant') || 
        testError.response?.data?.error === 'invalid_grant' ||
        testError.message?.includes('Token has been expired or revoked')
      )) {
        const railwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
          ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN.replace(/^https?:\/\//, '')}`
          : process.env.GMAIL_REDIRECT_URI?.replace('/api/gmail/oauth2callback', '') || 
            'https://edgetalentcrm-production.up.railway.app';
        
        const authEndpoint = accountKey === 'secondary' 
          ? `${railwayUrl}/api/gmail/auth2`
          : `${railwayUrl}/api/gmail/auth`;
        
        const tokenVar = accountKey === 'secondary' ? 'GMAIL_REFRESH_TOKEN_2' : 'GMAIL_REFRESH_TOKEN';
        
        const errorMsg = `OAuth token expired or revoked for ${account.email}. ` +
          `Please re-authenticate: ${authEndpoint}. ` +
          `Then update ${tokenVar} in Railway environment variables.`;
        
        console.error(`❌ [${account.displayName}] ${errorMsg}`);
        throw new Error(errorMsg);
      }
      // Re-throw other errors
      throw testError;
    }

  } catch (error) {
    // If it's already our formatted error, re-throw it
    if (error.message?.includes('OAuth token expired or revoked')) {
      throw error;
    }
    throw new Error(`Failed to authenticate Gmail API (${accountKey}): ${error.message}`);
  }
}

/**
 * Create email message in RFC 2822 format
 */
function createEmailMessage(to, subject, text, from, fromName) {
  const emailLines = [
    `From: ${fromName} <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    text
  ];

  const email = emailLines.join('\r\n');
  return Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Create email message with HTML content
 */
function createHtmlEmailMessage(to, subject, html, from, fromName) {
  const boundary = '----=_Part_0_' + Date.now() + '.' + Math.random();

  const emailLines = [
    `From: ${fromName} <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    'This is an HTML email. Please use an email client that supports HTML.',
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
    '',
    `--${boundary}--`
  ];

  const email = emailLines.join('\r\n');
  return Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Create email message with attachments
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Email body (plain text or HTML)
 * @param {string} from - Sender email address
 * @param {string} fromName - Sender display name
 * @param {Array} attachments - Array of attachment objects with {path, filename} or {buffer, filename, contentType}
 * @param {boolean} isHtml - Whether the text is HTML
 * @returns {Promise<string>} Base64-encoded email message
 */
async function createEmailMessageWithAttachments(to, subject, text, from, fromName, attachments = [], isHtml = false) {
  const boundary = '----=_Part_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
  const rootBoundary = '----=_Root_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);

  const emailLines = [
    `From: ${fromName} <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${rootBoundary}"`,
    ''
  ];

  // Add message body part
  emailLines.push(`--${rootBoundary}`);
  if (isHtml) {
    emailLines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    emailLines.push('');
    emailLines.push(`--${boundary}`);
    emailLines.push('Content-Type: text/plain; charset=utf-8');
    emailLines.push('');
    emailLines.push('This is an HTML email. Please use an email client that supports HTML.');
    emailLines.push('');
    emailLines.push(`--${boundary}`);
    emailLines.push('Content-Type: text/html; charset=utf-8');
    emailLines.push('');
    emailLines.push(text);
    emailLines.push('');
    emailLines.push(`--${boundary}--`);
  } else {
    emailLines.push('Content-Type: text/plain; charset=utf-8');
    emailLines.push('');
    emailLines.push(text);
  }

  // Add attachments
  for (const attachment of attachments) {
    try {
      let fileBuffer;
      let filename;
      let contentType = 'application/octet-stream';

      if (attachment.buffer) {
        // Attachment provided as buffer
        fileBuffer = attachment.buffer;
        filename = attachment.filename || 'attachment';
        contentType = attachment.contentType || contentType;
      } else if (attachment.path) {
        // Attachment provided as file path
        filename = attachment.filename || path.basename(attachment.path);
        fileBuffer = await fs.readFile(attachment.path);
        
        // Detect content type from filename
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
          '.pdf': 'application/pdf',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.doc': 'application/msword',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xls': 'application/vnd.ms-excel',
          '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.zip': 'application/zip',
          '.txt': 'text/plain'
        };
        if (mimeTypes[ext]) {
          contentType = mimeTypes[ext];
        }
      } else {
        console.warn(`⚠️ Skipping invalid attachment: ${JSON.stringify(attachment)}`);
        continue;
      }

      // Encode attachment in base64
      const encodedAttachment = fileBuffer.toString('base64');

      // Add attachment part
      emailLines.push(`--${rootBoundary}`);
      emailLines.push(`Content-Type: ${contentType}; name="${filename}"`);
      emailLines.push('Content-Disposition: attachment; filename="' + filename + '"');
      emailLines.push('Content-Transfer-Encoding: base64');
      emailLines.push('');
      // Split base64 into 76-character lines (RFC 2045)
      emailLines.push(encodedAttachment.match(/.{1,76}/g).join('\r\n'));
    } catch (error) {
      console.error(`❌ Error processing attachment ${attachment.filename || attachment.path}:`, error.message);
      // Continue with other attachments
    }
  }

  // Close root boundary
  emailLines.push(`--${rootBoundary}--`);

  const email = emailLines.join('\r\n');
  return Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Send an email using Gmail API
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Email plain text body (or HTML if isHtml is true)
 * @param {Object} options - Additional options
 * @param {boolean} options.isHtml - Whether the text is HTML
 * @param {string} options.fromName - Sender display name (default: account's display name)
 * @param {string} options.accountKey - Which account to use: 'primary' or 'secondary' (default: 'primary')
 * @param {Array} options.attachments - Array of attachment objects with {path, filename} or {buffer, filename, contentType}
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendEmail(to, subject, text, options = {}) {
  const emailId = Math.random().toString(36).substring(2, 8);
  const { isHtml = false, accountKey = 'primary', fromName, attachments = [] } = options;

  // Get account configuration
  const account = ACCOUNTS[accountKey];
  if (!account) {
    return { success: false, error: `Invalid account key: ${accountKey}` };
  }

  const senderName = fromName || account.displayName;
  const senderEmail = account.email;

  console.log(`📧 [${emailId}] Sending email via Gmail API (${accountKey}): ${subject} → ${to}`);
  console.log(`📧 [${emailId}] From: ${senderName} <${senderEmail}>`);

  if (attachments && attachments.length > 0) {
    console.log(`📎 [${emailId}] Attachments: ${attachments.length} file(s)`);
    attachments.forEach((att, idx) => {
      console.log(`📎 [${emailId}]   ${idx + 1}. ${att.filename || att.path || 'Unknown'} (${att.path ? 'file path' : 'buffer'})`);
    });
  }

  if (!to || !subject || !text) {
    const errorMsg = `📧 [${emailId}] Missing required fields: ${!to ? 'to, ' : ''}${!subject ? 'subject, ' : ''}${!text ? 'body' : ''}`.replace(/, $/, '');
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }

  try {
    const gmail = await getGmailClient(accountKey);

    // Create the email message
    let encodedMessage;
    if (attachments && attachments.length > 0) {
      // Use multipart/mixed for emails with attachments
      encodedMessage = await createEmailMessageWithAttachments(to, subject, text, senderEmail, senderName, attachments, isHtml);
      console.log(`📧 [${emailId}] Created multipart/mixed message with ${attachments.length} attachment(s)`);
    } else {
      // Use simple message format for emails without attachments
      encodedMessage = isHtml
        ? createHtmlEmailMessage(to, subject, text, senderEmail, senderName)
        : createEmailMessage(to, subject, text, senderEmail, senderName);
    }

    console.log(`📧 [${emailId}] Sending email via Gmail API (${accountKey})...`);

    // Send the email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    console.log(`✅ [${emailId}] Email sent successfully via Gmail API (${accountKey}) - ID: ${response.data.id}`);
    if (attachments && attachments.length > 0) {
      console.log(`📎 [${emailId}] ✅ ${attachments.length} attachment(s) included`);
    }

    return {
      success: true,
      messageId: response.data.id,
      threadId: response.data.threadId,
      provider: 'gmail-api',
      accountKey: accountKey,
      fromEmail: senderEmail
    };

  } catch (error) {
    console.error(`❌ [${emailId}] Gmail API send failed (${accountKey}):`, error.message);
    
    // Check if it's an invalid_grant error
    const isInvalidGrant = error.code === 400 && (
      error.message?.includes('invalid_grant') || 
      error.response?.data?.error === 'invalid_grant' ||
      error.message?.includes('Token has been expired or revoked')
    );

    if (isInvalidGrant) {
      const account = ACCOUNTS[accountKey];
      const railwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN.replace(/^https?:\/\//, '')}`
        : process.env.GMAIL_REDIRECT_URI?.replace('/api/gmail/oauth2callback', '') || 
          'https://edgetalentcrm-production.up.railway.app';
      
      const authEndpoint = accountKey === 'secondary' 
        ? `${railwayUrl}/api/gmail/auth2`
        : `${railwayUrl}/api/gmail/auth`;
      
      const tokenVar = accountKey === 'secondary' ? 'GMAIL_REFRESH_TOKEN_2' : 'GMAIL_REFRESH_TOKEN';
      
      console.error(`❌ [${emailId}] OAuth token expired for ${account.email}`);
      console.error(`❌ [${emailId}] ACTION REQUIRED: Re-authenticate at ${authEndpoint}`);
      console.error(`❌ [${emailId}] Then update ${tokenVar} in Railway environment variables`);
      
      // Note: Automatic fallback to primary account is handled in emailService.js
      // to avoid recursive calls and maintain proper error handling
      if (accountKey === 'secondary') {
        console.log(`💡 [${emailId}] Fallback to primary account will be attempted by emailService`);
      }
    }

    if (error.errors) {
      console.error(`❌ [${emailId}] Error details:`, JSON.stringify(error.errors, null, 2));
    }

    return {
      success: false,
      error: error.message,
      code: error.code,
      details: error.errors,
      accountKey: accountKey,
      isInvalidGrant: isInvalidGrant || false
    };
  }
}

/**
 * Send an HTML email using Gmail API
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML body
 * @param {Object} options - Additional options (including accountKey)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendHtmlEmail(to, subject, html, options = {}) {
  return sendEmail(to, subject, html, { ...options, isHtml: true });
}

/**
 * Get email message by ID
 * @param {string} messageId - Gmail message ID
 * @param {string} accountKey - Which account to use: 'primary' or 'secondary' (default: 'primary')
 */
async function getEmail(messageId, accountKey = 'primary') {
  try {
    const gmail = await getGmailClient(accountKey);

    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    return {
      success: true,
      message: response.data
    };

  } catch (error) {
    console.error(`❌ Failed to get email (${accountKey}):`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * List emails with optional query
 * @param {string} query - Gmail search query
 * @param {number} maxResults - Maximum results to return
 * @param {string} accountKey - Which account to use: 'primary' or 'secondary' (default: 'primary')
 */
async function listEmails(query = '', maxResults = 10, accountKey = 'primary') {
  try {
    const gmail = await getGmailClient(accountKey);

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults
    });

    return {
      success: true,
      messages: response.data.messages || [],
      resultSizeEstimate: response.data.resultSizeEstimate
    };

  } catch (error) {
    console.error(`❌ Failed to list emails (${accountKey}):`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test Gmail API connection
 * @param {string} accountKey - Which account to test: 'primary' or 'secondary' (default: 'primary')
 */
async function testConnection(accountKey = 'primary') {
  try {
    const account = ACCOUNTS[accountKey];
    const gmail = await getGmailClient(accountKey);

    const response = await gmail.users.getProfile({
      userId: 'me'
    });

    console.log(`✅ Gmail API connection successful (${accountKey})`);
    console.log(`📧 Email: ${response.data.emailAddress}`);
    console.log(`📊 Total messages: ${response.data.messagesTotal}`);

    return {
      success: true,
      profile: response.data,
      accountKey: accountKey,
      configuredEmail: account.email
    };

  } catch (error) {
    console.error(`❌ Gmail API connection failed (${accountKey}):`, error.message);
    return {
      success: false,
      error: error.message,
      accountKey: accountKey
    };
  }
}

/**
 * Get account information
 * @param {string} accountKey - 'primary' or 'secondary'
 */
function getAccountInfo(accountKey = 'primary') {
  const account = ACCOUNTS[accountKey];
  if (!account) {
    return null;
  }

  return {
    email: account.email,
    displayName: account.displayName,
    hasCredentials: !!(account.clientId && account.clientSecret && account.refreshToken)
  };
}

module.exports = {
  sendEmail,
  sendHtmlEmail,
  getEmail,
  listEmails,
  testConnection,
  getAccountInfo,
  ACCOUNTS
};
