/**
 * REPOLL ALL EMAILS - AUTO-RUN (NO CONFIRMATION)
 * Deletes all emails and lets Gmail poller re-import with HTML extraction
 */

require('dotenv').config({ path: './server/.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backupEmails() {
  console.log('📦 Creating backup...');
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
    
    console.log(`✅ Backup created: ${messages.length} emails → ${backupFile}`);
    return { success: true, count: messages.length, file: backupFile };
  } catch (error) {
    console.error('❌ Backup error:', error.message);
    return { success: false };
  }
}

async function deleteAllEmails() {
  console.log('🗑️  Deleting all emails...');
  try {
    const { data, error } = await supabase
      .from('messages')
      .delete()
      .eq('type', 'email')
      .select();

    if (error) throw error;
    console.log(`✅ Deleted ${data?.length || 0} emails`);
    return { success: true, deleted: data?.length || 0 };
  } catch (error) {
    console.error('❌ Delete error:', error.message);
    return { success: false };
  }
}

async function clearProcessedCache() {
  console.log('🧹 Clearing processed messages cache...');
  try {
    const cacheFiles = [
      path.join(__dirname, 'server/utils/processed_gmail_messages_primary.json'),
      path.join(__dirname, 'server/utils/processed_gmail_messages_secondary.json')
    ];
    
    for (const cacheFile of cacheFiles) {
      if (fs.existsSync(cacheFile)) {
        fs.writeFileSync(cacheFile, JSON.stringify({}, null, 2));
        console.log(`✅ Cleared ${path.basename(cacheFile)}`);
      }
    }
  } catch (error) {
    console.warn('⚠️ Cache clear warning:', error.message);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔄 REPOLLING ALL EMAILS WITH HTML EXTRACTION');
  console.log('═══════════════════════════════════════════════════════════\n');

  const backup = await backupEmails();
  if (!backup.success) {
    console.error('❌ Backup failed. Aborting.');
    process.exit(1);
  }

  const deleted = await deleteAllEmails();
  if (!deleted.success) {
    console.error('❌ Deletion failed. Aborting.');
    process.exit(1);
  }

  await clearProcessedCache();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ COMPLETE!');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('📧 Gmail poller will now re-import all emails with HTML extraction');
  console.log(`📦 Backup: ${backup.file}\n`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

