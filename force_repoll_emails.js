/**
 * FORCE REPOLL - Immediately fetch and import all emails
 */

require('dotenv').config({ path: './server/.env' });

async function main() {
  console.log('🔄 Starting Gmail poller scan to repoll all emails...');
  
  // Import the GmailPoller class
  const GmailPoller = require('./server/utils/gmailPoller');
  
  // Get socket.io instance if available (optional)
  let io = null;
  try {
    // Try to get io from server if it's running
    // If not available, that's okay - poller will still work
  } catch (e) {
    console.log('⚠️ Socket.IO not available (not critical)');
  }

  // Create poller instances for both accounts
  const primaryPoller = new GmailPoller(io, 'primary');
  const secondaryPoller = new GmailPoller(io, 'secondary');

  console.log('📧 Starting scan for primary account...');
  await primaryPoller.scanUnprocessedMessages();
  
  console.log('📧 Starting scan for secondary account...');
  await secondaryPoller.scanUnprocessedMessages();

  console.log('\n✅ Scan complete! Emails are being processed...');
  console.log('   Check your messages page - emails will appear as they\'re imported.');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

