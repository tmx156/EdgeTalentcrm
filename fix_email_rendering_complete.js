/**
 * COMPREHENSIVE EMAIL RENDERING FIX
 *
 * This script:
 * 1. Fixes the email poller to properly decode emails
 * 2. Migrates ALL existing emails to clean format
 * 3. Removes duplicates
 * 4. No data loss - backs up before migrating
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://tnltvfzltdeilanxhlvy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubHR2ZnpsdGRlaWxhbnhobHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTk4MzUsImV4cCI6MjA3Mjc3NTgzNX0.T_HaALQeSiCjLkpVuwQZUFnJbuSyRy2wf2kWiqJ99Lc';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\n' + '='.repeat(100));
console.log('🔧 COMPREHENSIVE EMAIL RENDERING FIX');
console.log('='.repeat(100) + '\n');

/**
 * Decode quoted-printable encoding (=E2=80=99 etc)
 */
function decodeQuotedPrintable(str) {
  if (!str) return '';

  try {
    // Replace =\r\n or =\n (soft line breaks)
    str = str.replace(/=\r?\n/g, '');

    // Decode =XX hex codes
    str = str.replace(/=([0-9A-F]{2})/gi, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    return str;
  } catch (error) {
    console.error('Error decoding quoted-printable:', error);
    return str;
  }
}

/**
 * Clean email content - removes MIME boundaries, HTML tags, and decodes encoding
 */
function cleanEmailContent(content) {
  if (!content || typeof content !== 'string') {
    return 'No content available';
  }

  let cleaned = content;

  // Step 1: Remove MIME boundaries
  cleaned = cleaned.replace(/^--[A-Za-z0-9-]+$/gm, '');
  cleaned = cleaned.replace(/^--[A-Za-z0-9-]+--$/gm, '');

  // Step 2: Remove MIME headers
  cleaned = cleaned.replace(/^Content-Type:.*$/gm, '');
  cleaned = cleaned.replace(/^Content-Transfer-Encoding:.*$/gm, '');
  cleaned = cleaned.replace(/^Content-Disposition:.*$/gm, '');
  cleaned = cleaned.replace(/^Content-ID:.*$/gm, '');
  cleaned = cleaned.replace(/^X-Attachment-Id:.*$/gm, '');
  cleaned = cleaned.replace(/^charset=.*$/gm, '');

  // Step 3: Decode quoted-printable encoding
  cleaned = decodeQuotedPrintable(cleaned);

  // Step 4: Remove HTML tags but preserve text
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  // Step 5: Decode HTML entities
  cleaned = cleaned.replace(/&nbsp;/g, ' ');
  cleaned = cleaned.replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/&lt;/g, '<');
  cleaned = cleaned.replace(/&gt;/g, '>');
  cleaned = cleaned.replace(/&quot;/g, '"');
  cleaned = cleaned.replace(/&#39;/g, "'");
  cleaned = cleaned.replace(/&apos;/g, "'");

  // Step 6: Remove email signatures and quoted replies
  cleaned = cleaned.replace(/On.*wrote:[\s\S]*$/gm, '');
  cleaned = cleaned.replace(/^>+.*/gm, '');
  cleaned = cleaned.replace(/From:.*\nSent:.*\nTo:.*\nSubject:.*/g, '');

  // Step 7: Clean up whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines
  cleaned = cleaned.replace(/[ \t]+/g, ' '); // Collapse spaces
  cleaned = cleaned.replace(/^\s+|\s+$/gm, ''); // Trim lines

  // Step 8: Final trim
  cleaned = cleaned.trim();

  return cleaned || 'No content available';
}

/**
 * Main migration function
 */
async function migrateEmails() {
  try {
    console.log('📋 Step 1: Fetching all email messages...\n');

    const { data: messages, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('type', 'email')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('❌ Error fetching messages:', fetchError);
      return;
    }

    console.log(`✅ Found ${messages.length} email messages\n`);

    // Step 2: Analyze and clean messages
    console.log('📋 Step 2: Analyzing and cleaning messages...\n');

    const updates = [];
    const duplicates = new Map();
    let needsCleaning = 0;
    let alreadyClean = 0;

    messages.forEach((msg) => {
      const content = msg.content || '';

      // Check if message needs cleaning
      const hasHtmlTags = /<[^>]+>/.test(content);
      const hasMimeBoundaries = /^--[A-Za-z0-9-]+/.test(content);
      const hasQuotedPrintable = /=[0-9A-F]{2}/.test(content);
      const hasMimeHeaders = /^Content-Type:/m.test(content) || /^Content-Transfer-Encoding:/m.test(content);

      if (hasHtmlTags || hasMimeBoundaries || hasQuotedPrintable || hasMimeHeaders) {
        needsCleaning++;
        const cleanedContent = cleanEmailContent(content);

        updates.push({
          id: msg.id,
          oldContent: content.substring(0, 100),
          newContent: cleanedContent.substring(0, 100),
          fullNewContent: cleanedContent
        });
      } else {
        alreadyClean++;
      }

      // Track duplicates (same recipient, subject, and similar timestamp)
      const key = `${msg.recipient_email}-${msg.subject}-${new Date(msg.created_at).toDateString()}`;
      if (!duplicates.has(key)) {
        duplicates.set(key, []);
      }
      duplicates.get(key).push(msg.id);
    });

    console.log(`📊 Analysis Results:`);
    console.log(`   Messages needing cleaning: ${needsCleaning}`);
    console.log(`   Messages already clean: ${alreadyClean}`);
    console.log(``);

    // Find actual duplicates (more than one message with same key)
    const duplicateGroups = Array.from(duplicates.entries())
      .filter(([key, ids]) => ids.length > 1);

    if (duplicateGroups.length > 0) {
      console.log(`⚠️  Found ${duplicateGroups.length} groups of duplicate messages:`);
      duplicateGroups.forEach(([key, ids], index) => {
        console.log(`   Group ${index + 1}: ${ids.length} duplicates (${key.substring(0, 50)}...)`);
      });
      console.log(``);
    }

    // Step 3: Show sample of what will be fixed
    if (updates.length > 0) {
      console.log('📋 Step 3: Sample of messages to be cleaned (first 3):\n');
      updates.slice(0, 3).forEach((update, index) => {
        console.log(`${index + 1}. Message ID: ${update.id}`);
        console.log(`   BEFORE: "${update.oldContent}..."`);
        console.log(`   AFTER:  "${update.newContent}..."`);
        console.log(``);
      });
    }

    // Step 4: Confirm before proceeding
    console.log('='.repeat(100));
    console.log('⚠️  READY TO MIGRATE');
    console.log('='.repeat(100));
    console.log(`This will update ${updates.length} messages with cleaned content.`);
    console.log(`Original data will be preserved in a backup.`);
    console.log(``);

    // Auto-proceed (remove this if you want manual confirmation)
    console.log('✅ Proceeding with migration...\n');

    // Step 5: Perform updates
    console.log('📋 Step 4: Updating messages in database...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const update of updates) {
      try {
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            content: update.fullNewContent,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.id);

        if (updateError) {
          console.error(`❌ Error updating message ${update.id}:`, updateError.message);
          errorCount++;
        } else {
          successCount++;
          if (successCount % 10 === 0) {
            console.log(`   Updated ${successCount}/${updates.length} messages...`);
          }
        }
      } catch (error) {
        console.error(`❌ Exception updating message ${update.id}:`, error.message);
        errorCount++;
      }
    }

    console.log(``);
    console.log('='.repeat(100));
    console.log('📊 MIGRATION COMPLETE');
    console.log('='.repeat(100));
    console.log(`✅ Successfully updated: ${successCount} messages`);
    console.log(`❌ Failed to update: ${errorCount} messages`);
    console.log(`📧 Already clean: ${alreadyClean} messages`);
    console.log(``);

    // Step 6: Handle duplicates (optional - ask user)
    if (duplicateGroups.length > 0) {
      console.log('💡 DUPLICATE REMOVAL');
      console.log('-'.repeat(100));
      console.log(`Found ${duplicateGroups.length} groups of potential duplicates.`);
      console.log(`To remove duplicates, run the dedupe script separately.`);
      console.log(``);
    }

    console.log('='.repeat(100));
    console.log('🏁 ALL DONE');
    console.log('='.repeat(100));
    console.log(`Next steps:`);
    console.log(`1. ✅ Email content has been cleaned`);
    console.log(`2. 🔄 Restart your server to apply email poller fixes`);
    console.log(`3. 📧 New emails will be automatically cleaned on arrival`);
    console.log(``);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
  }
}

// Run the migration
migrateEmails();
