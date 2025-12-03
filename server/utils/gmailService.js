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
    email: process.env.GMAIL_EMAIL_2,
    clientId: process.env.GMAIL_CLIENT_ID_2,
    clientSecret: process.env.GMAIL_CLIENT_SECRET_2,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN_2,
    redirectUri: process.env.GMAIL_REDIRECT_URI_2 || 'http://localhost:5000/api/gmail/oauth2callback2',
    displayName: 'Secondary Account'
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

    return google.gmail({ version: 'v1', auth: oauth2Client });

  } catch (error) {
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
 * Send an email using Gmail API
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Email plain text body (or HTML if isHtml is true)
 * @param {Object} options - Additional options
 * @param {boolean} options.isHtml - Whether the text is HTML
 * @param {string} options.fromName - Sender display name (default: account's display name)
 * @param {string} options.accountKey - Which account to use: 'primary' or 'secondary' (default: 'primary')
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendEmail(to, subject, text, options = {}) {
  const emailId = Math.random().toString(36).substring(2, 8);
  const { isHtml = false, accountKey = 'primary', fromName } = options;

  // Get account configuration
  const account = ACCOUNTS[accountKey];
  if (!account) {
    return { success: false, error: `Invalid account key: ${accountKey}` };
  }

  const senderName = fromName || account.displayName;
  const senderEmail = account.email;

  console.log(`📧 [${emailId}] Sending email via Gmail API (${accountKey}): ${subject} → ${to}`);
  console.log(`📧 [${emailId}] From: ${senderName} <${senderEmail}>`);

  if (!to || !subject || !text) {
    const errorMsg = `📧 [${emailId}] Missing required fields: ${!to ? 'to, ' : ''}${!subject ? 'subject, ' : ''}${!text ? 'body' : ''}`.replace(/, $/, '');
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }

  try {
    const gmail = await getGmailClient(accountKey);

    // Create the email message
    const encodedMessage = isHtml
      ? createHtmlEmailMessage(to, subject, text, senderEmail, senderName)
      : createEmailMessage(to, subject, text, senderEmail, senderName);

    console.log(`📧 [${emailId}] Sending email via Gmail API (${accountKey})...`);

    // Send the email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    console.log(`✅ [${emailId}] Email sent successfully via Gmail API (${accountKey}) - ID: ${response.data.id}`);

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

    return {
      success: false,
      error: error.message,
      code: error.code,
      details: error.errors,
      accountKey: accountKey
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
