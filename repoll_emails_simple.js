/**
 * SIMPLE REPOLL ALL EMAILS WITH HTML EXTRACTION
 * 
 * This script deletes all emails and triggers the Gmail poller to re-import them
 * with the new HTML extraction settings.
 * 
 * USAGE:
 *   node repoll_emails_simple.js
 */

require('dotenv').config({ path: './server/.env' });
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * Backup all email messages
 */
async function backupEmails() {
  console.log('📦 Creating backup of existing emails...');
  
  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('type', 'email')
      .order('created_at', { ascending: true });

    if (error) throw error;

    const backupDir = path.join(__dirname, 'email_backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `email_backup_${timestamp}.json`);

    fs.writeFileSync(backupFile, JSON.stringify(messages, null, 2));
    
    console.log(`✅ Backup created: ${backupFile}`);
    console.log(`   Backed up ${messages.length} email messages`);
    
    return { success: true, count: messages.length, file: backupFile };
  } catch (error) {
    console.error('❌ Error creating backup:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Delete all email messages
 */
async function deleteAllEmails() {
  console.log('🗑️  Deleting all email messages from database...');
  
  try {
    const { data, error } = await supabase
      .from('messages')
      .delete()
      .eq('type', 'email')
      .select();

    if (error) throw error;

    console.log(`✅ Deleted ${data?.length || 0} email messages`);
    return { success: true, deleted: data?.length || 0 };
  } catch (error) {
    console.error('❌ Error deleting emails:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Clear processed messages cache so poller will re-process
 */
async function clearProcessedCache() {
  console.log('🧹 Clearing processed messages cache...');
  
  try {
    const cacheFile = path.join(__dirname, 'server/utils/processed_gmail_messages_primary.json');
    const cacheFile2 = path.join(__dirname, 'server/utils/processed_gmail_messages_secondary.json');
    
    if (fs.existsSync(cacheFile)) {
      fs.writeFileSync(cacheFile, JSON.stringify({}, null, 2));
      console.log('✅ Cleared primary account cache');
    }
    
    if (fs.existsSync(cacheFile2)) {
      fs.writeFileSync(cacheFile2, JSON.stringify({}, null, 2));
      console.log('✅ Cleared secondary account cache');
    }
    
    return { success: true };
  } catch (error) {
    console.warn('⚠️ Error clearing cache (not critical):', error.message);
    return { success: false };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔄 REPOLL ALL EMAILS WITH HTML EXTRACTION');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('This script will:');
  console.log('  1. Backup all existing emails');
  console.log('  2. Delete all emails from database');
  console.log('  3. Clear processed messages cache');
  console.log('  4. The Gmail poller will then re-import them with HTML extraction\n');

  // Confirm action
  const confirm = await askQuestion('⚠️  Continue? (yes/no): ');
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ Cancelled by user');
    rl.close();
    return;
  }

  // Step 1: Backup
  console.log('\n📦 Step 1: Creating backup...');
  const backupResult = await backupEmails();
  if (!backupResult.success) {
    console.error('❌ Backup failed. Aborting.');
    rl.close();
    return;
  }

  // Step 2: Delete all emails
  console.log('\n🗑️  Step 2: Deleting all emails...');
  const deleteResult = await deleteAllEmails();
  if (!deleteResult.success) {
    console.error('❌ Deletion failed. Aborting.');
    rl.close();
    return;
  }

  // Step 3: Clear cache
  console.log('\n🧹 Step 3: Clearing processed messages cache...');
  await clearProcessedCache();

  // Final instructions
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ SETUP COMPLETE!');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('📧 Next steps:');
  console.log('  1. The Gmail poller will automatically start re-importing emails');
  console.log('  2. New emails will be imported with HTML content and embedded images');
  console.log('  3. Check the poller logs to see progress\n');
  
  console.log(`📦 Backup saved to: ${backupResult.file}`);
  console.log('\n✨ All set! The Gmail poller will now re-import emails with HTML extraction.');

  rl.close();
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  rl.close();
  process.exit(1);
});

