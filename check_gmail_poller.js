/**
 * Gmail Poller Diagnostic Script
 * Checks if Gmail API polling is configured and working correctly
 */

const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const TOKEN_PATH = path.join(__dirname, 'server/config/gmail-token.json');

async function checkGmailPoller() {
  console.log('🔍 Gmail Poller Diagnostic Check\n');
  console.log('=' .repeat(60));

  const results = {
    supabase: false,
    gmailAuth: false,
    gmailConnection: false,
    messagesTable: false,
    pollerRunning: false,
    issues: []
  };

  // 1. Check Supabase connection
  console.log('\n1️⃣ Checking Supabase connection...');
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      results.issues.push('❌ Missing Supabase credentials (SUPABASE_URL or SUPABASE_KEY)');
      console.log('❌ Missing Supabase credentials');
    } else {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      const { data, error } = await supabase.from('leads').select('id').limit(1);
      if (error) {
        results.issues.push(`❌ Supabase connection error: ${error.message}`);
        console.log(`❌ Supabase connection error: ${error.message}`);
      } else {
        results.supabase = true;
        console.log('✅ Supabase connected successfully');
      }
    }
  } catch (error) {
    results.issues.push(`❌ Supabase check failed: ${error.message}`);
    console.log(`❌ Supabase check failed: ${error.message}`);
  }

  // 2. Check Gmail API credentials
  console.log('\n2️⃣ Checking Gmail API credentials...');
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret) {
    results.issues.push('❌ Missing Gmail OAuth2 credentials (GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET)');
    console.log('❌ Missing Gmail OAuth2 credentials');
    console.log('   Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env');
  } else {
    console.log('✅ Gmail OAuth2 credentials found');
    results.gmailAuth = true;

    // 3. Check Gmail API connection
    console.log('\n3️⃣ Testing Gmail API connection...');
    try {
      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        process.env.GMAIL_REDIRECT_URI || 'http://localhost:5000/api/gmail/oauth2callback'
      );

      if (refreshToken) {
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        const profile = await gmail.users.getProfile({ userId: 'me' });
        results.gmailConnection = true;
        console.log(`✅ Gmail API connected successfully`);
        console.log(`   Email: ${profile.data.emailAddress}`);
        console.log(`   Total messages: ${profile.data.messagesTotal}`);
      } else {
        // Try token file
        try {
          const fs = require('fs');
          if (fs.existsSync(TOKEN_PATH)) {
            const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
            if (tokens.refresh_token) {
              oauth2Client.setCredentials(tokens);
              const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
              const profile = await gmail.users.getProfile({ userId: 'me' });
              results.gmailConnection = true;
              console.log(`✅ Gmail API connected via token file`);
              console.log(`   Email: ${profile.data.emailAddress}`);
            } else {
              results.issues.push('❌ No refresh token found. Run /api/gmail/auth to authenticate.');
              console.log('❌ No refresh token found in token file');
            }
          } else {
            results.issues.push('❌ No refresh token found. Set GMAIL_REFRESH_TOKEN or run /api/gmail/auth');
            console.log('❌ No refresh token found');
            console.log('   Set GMAIL_REFRESH_TOKEN in .env or run /api/gmail/auth');
          }
        } catch (error) {
          results.issues.push(`❌ Token file error: ${error.message}`);
          console.log(`❌ Token file error: ${error.message}`);
        }
      }
    } catch (error) {
      results.issues.push(`❌ Gmail API connection failed: ${error.message}`);
      console.log(`❌ Gmail API connection failed: ${error.message}`);
    }
  }

  // 4. Check messages table schema
  console.log('\n4️⃣ Checking messages table schema...');
  try {
    if (results.supabase) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      
      // Check if gmail_message_id column exists
      const { data: testInsert, error: schemaError } = await supabase
        .from('messages')
        .select('gmail_message_id, gmail_account_key')
        .limit(1);

      if (schemaError && schemaError.message.includes('gmail_message_id')) {
        results.issues.push('❌ messages table missing gmail_message_id column. Run migration: enable_gmail_deduplication.sql');
        console.log('❌ messages table missing gmail_message_id column');
      } else {
        results.messagesTable = true;
        console.log('✅ messages table has required columns (gmail_message_id, gmail_account_key)');
      }
    }
  } catch (error) {
    results.issues.push(`❌ Schema check failed: ${error.message}`);
    console.log(`❌ Schema check failed: ${error.message}`);
  }

  // 5. Check if poller is running (check server logs)
  console.log('\n5️⃣ Checking poller status...');
  console.log('   (Check server logs for: "✅ [Gmail] Poller started successfully")');
  console.log('   (Check server logs for: "📧 [Gmail] Scanning for new messages...")');

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DIAGNOSTIC SUMMARY\n');

  const allChecks = [
    { name: 'Supabase Connection', status: results.supabase },
    { name: 'Gmail OAuth2 Credentials', status: results.gmailAuth },
    { name: 'Gmail API Connection', status: results.gmailConnection },
    { name: 'Messages Table Schema', status: results.messagesTable }
  ];

  allChecks.forEach(check => {
    console.log(`${check.status ? '✅' : '❌'} ${check.name}`);
  });

  if (results.issues.length > 0) {
    console.log('\n⚠️  ISSUES FOUND:\n');
    results.issues.forEach(issue => console.log(`   ${issue}`));
  } else {
    console.log('\n✅ All checks passed! Gmail poller should be working.');
  }

  console.log('\n💡 Next steps:');
  console.log('   1. Check server logs for poller startup messages');
  console.log('   2. Verify GMAIL_PUSH_ENABLED is not set to "true" (or poller won\'t start)');
  console.log('   3. Check server logs every 60 seconds for polling activity');
  console.log('   4. Test by sending an email to your Gmail account');

  return results;
}

// Run diagnostic
if (require.main === module) {
  checkGmailPoller()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('\n❌ Diagnostic failed:', error);
      process.exit(1);
    });
}

module.exports = { checkGmailPoller };

