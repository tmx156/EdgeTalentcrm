#!/usr/bin/env node
/**
 * Force Re-poll Gmail Emails
 * 
 * This script:
 * 1. Clears the processed messages cache
 * 2. Triggers an immediate poll of Gmail
 * 3. Processes any new emails found
 * 
 * Usage: node force-repoll-emails.js
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { getSupabaseClient } = require('./server/config/supabase-client');
const GmailEmailExtractor = require('./server/utils/gmailEmailExtractor');

const DATA_DIR = path.join(__dirname, 'server/data');

console.log('='.repeat(80));
console.log('📧 FORCE EMAIL RE-POLL');
console.log('='.repeat(80));
console.log();

// Clear processed messages cache
console.log('🧹 Clearing processed messages cache...');
const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('processed_gmail_messages_'));
if (files.length > 0) {
  files.forEach(file => {
    fs.unlinkSync(path.join(DATA_DIR, file));
    console.log(`   ✅ Deleted: ${file}`);
  });
} else {
  console.log('   ℹ️ No processed messages cache found');
}
console.log();

// Check environment
const requiredEnv = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'];
const missing = requiredEnv.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('❌ Missing environment variables:', missing.join(', '));
  process.exit(1);
}

// Poll Gmail account
async function pollGmailAccount(accountKey, accountConfig) {
  console.log(`📧 Polling ${accountConfig.displayName} (${accountConfig.email})...`);
  console.log('-'.repeat(80));

  try {
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      accountConfig.clientId,
      accountConfig.clientSecret,
      accountConfig.redirectUri
    );

    oauth2Client.setCredentials({ refresh_token: accountConfig.refreshToken });

    // Create Gmail client
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Test connection
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log(`✅ Connected to: ${profile.data.emailAddress}`);
    console.log();

    // Get recent messages from inbox
    console.log('🔍 Checking for messages in inbox...');
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 20,
      q: 'in:inbox is:unread',  // Only unread inbox messages
      labelIds: ['INBOX']
    });

    const messages = response.data.messages || [];
    console.log(`📨 Found ${messages.length} unread messages in inbox`);
    console.log();

    if (messages.length === 0) {
      console.log('ℹ️ No new messages to process');
      return { processed: 0, errors: 0 };
    }

    // Get Supabase client
    const supabase = getSupabaseClient();
    let processed = 0;
    let errors = 0;

    // Process each message
    for (const message of messages) {
      try {
        console.log(`📧 Processing message: ${message.id}`);

        // Get full message details
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });

        const headers = fullMessage.data.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
        const to = headers.find(h => h.name === 'To')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value;

        console.log(`   From: ${from}`);
        console.log(`   Subject: ${subject}`);
        console.log(`   Date: ${date}`);

        // Extract email content
        const extractor = new GmailEmailExtractor();
        const emailContent = await extractor.extractEmailContent(fullMessage.data);
        
        console.log(`   Body length: ${emailContent.text?.length || 0} chars (text)`);
        console.log(`   HTML length: ${emailContent.html?.length || 0} chars (html)`);

        // Check if message already exists in database
        const { data: existingMessage } = await supabase
          .from('messages')
          .select('id')
          .eq('provider_message_id', message.id)
          .maybeSingle();

        if (existingMessage) {
          console.log(`   ⚠️ Already exists in database, skipping`);
          console.log();
          continue;
        }

        // Find lead by email
        const fromEmail = from.match(/<([^>]+)>/)?.[1] || from;
        const { data: leads } = await supabase
          .from('leads')
          .select('*')
          .eq('email', fromEmail)
          .limit(1);

        let lead = leads?.[0];

        if (!lead) {
          console.log(`   ⚠️ No lead found for ${fromEmail}`);
          console.log();
          continue;
        }

        console.log(`   ✅ Matched to lead: ${lead.name} (ID: ${lead.id})`);

        // Save message to database
        const { error: insertError } = await supabase.from('messages').insert({
          id: crypto.randomUUID(),
          lead_id: lead.id,
          type: 'email',
          direction: 'received',
          subject: subject,
          content: emailContent.text || '(No content)',
          email_body: emailContent.html || null,
          recipient_email: to,
          status: 'delivered',
          read_status: false,
          provider_message_id: message.id,
          created_at: new Date(parseInt(fullMessage.data.internalDate)).toISOString(),
          sent_at: new Date(parseInt(fullMessage.data.internalDate)).toISOString()
        });

        if (insertError) {
          console.error(`   ❌ Database error: ${insertError.message}`);
          errors++;
        } else {
          console.log(`   ✅ Saved to database`);
          processed++;
        }

        console.log();

      } catch (err) {
        console.error(`   ❌ Error processing message: ${err.message}`);
        errors++;
      }
    }

    return { processed, errors };

  } catch (error) {
    console.error(`❌ Failed to poll ${accountKey}:`, error.message);
    if (error.message?.includes('invalid_grant')) {
      console.error('🔴 Refresh token expired! You need to re-authenticate.');
    }
    return { processed: 0, errors: 1 };
  }
}

// Main execution
async function main() {
  const results = {
    primary: { processed: 0, errors: 0 },
    secondary: { processed: 0, errors: 0 }
  };

  // Poll primary account
  if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_REFRESH_TOKEN) {
    results.primary = await pollGmailAccount('primary', {
      email: process.env.GMAIL_EMAIL || 'hello@edgetalent.co.uk',
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:5000/api/gmail/oauth2callback',
      displayName: 'Primary Account'
    });
  } else {
    console.log('⚠️ Primary account not configured');
  }

  console.log();

  // Poll secondary account
  if (process.env.GMAIL_CLIENT_ID_2 && process.env.GMAIL_REFRESH_TOKEN_2) {
    results.secondary = await pollGmailAccount('secondary', {
      email: process.env.GMAIL_EMAIL_2 || 'diary@edgetalent.co.uk',
      clientId: process.env.GMAIL_CLIENT_ID_2,
      clientSecret: process.env.GMAIL_CLIENT_SECRET_2,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN_2,
      redirectUri: process.env.GMAIL_REDIRECT_URI_2 || 'http://localhost:5000/api/gmail/oauth2callback2',
      displayName: 'Secondary Account'
    });
  } else {
    console.log('⚠️ Secondary account not configured');
  }

  // Summary
  console.log('='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Primary Account: ${results.primary.processed} processed, ${results.primary.errors} errors`);
  console.log(`Secondary Account: ${results.secondary.processed} processed, ${results.secondary.errors} errors`);
  console.log();
  console.log('✅ Done! Check your Dashboard for new messages.');
  console.log('='.repeat(80));
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
