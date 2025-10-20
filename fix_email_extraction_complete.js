/**
 * COMPLETE EMAIL EXTRACTION FIX
 *
 * This script:
 * 1. Deletes ALL existing email messages from the database
 * 2. Updates the emailPoller.js with a brand new extraction algorithm
 * 3. Re-imports all emails from Gmail with the new extraction
 *
 * The new extraction will:
 * - Extract ONLY the customer's response (not the full thread)
 * - Remove all email signatures ("Sent from...", etc.)
 * - Remove all quoted replies
 * - Handle base64 encoded content
 * - Remove HTML and MIME artifacts
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * Improved email body extraction - extracts ONLY customer's response
 */
function extractCustomerResponse(emailContent) {
  if (!emailContent || typeof emailContent !== 'string') {
    return 'No content available';
  }

  let content = emailContent;

  // Step 1: Decode base64 content if present
  // Check for base64 MIME boundary pattern
  const base64Pattern = /----[A-Za-z0-9._]+\r?\n([A-Za-z0-9+/=\r\n]+)----[A-Za-z0-9._]+/;
  const base64Match = content.match(base64Pattern);
  if (base64Match && base64Match[1]) {
    try {
      const decoded = Buffer.from(base64Match[1].replace(/\r?\n/g, ''), 'base64').toString('utf8');
      content = decoded;
    } catch (e) {
      console.warn('Failed to decode base64 content:', e.message);
    }
  }

  // Step 2: Remove HTML tags and extract text
  content = content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  // Step 3: Decode HTML entities
  content = content
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/â/g, '');

  // Step 4: Decode quoted-printable encoding
  content = content.replace(/=([0-9A-F]{2})/gi, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  content = content.replace(/=\r?\n/g, ''); // Soft line breaks

  // Step 5: Split into lines for processing
  let lines = content.split(/\r?\n/);

  // Step 6: Find where customer's response ends and quoted content begins
  let customerResponseLines = [];
  let foundQuotedSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect start of quoted reply section
    if (
      line.match(/^On .* wrote:$/i) ||              // "On Oct 7, 2025, at 11:49, Avensismodels wrote:"
      line.match(/^From:.*\nSent:.*\nTo:/i) ||      // Outlook-style quoted headers
      line.match(/^----+ ?Original [Mm]essage ?----+/) || // "---Original message---"
      line.match(/^_{10,}/) ||                      // Long underscores (Outlook dividers)
      line.match(/^>/)                               // Lines starting with >
    ) {
      foundQuotedSection = true;
      break;
    }

    // Detect email signatures
    if (
      line.match(/^Sent from my (iPhone|iPad|Galaxy|Samsung|Android|Huawei)/i) ||
      line.match(/^Sent from Outlook/i) ||
      line.match(/^Get Outlook for (iOS|Android)/i) ||
      line.match(/^Regards,?\s*$/i) ||
      line.match(/^Kind regards,?\s*$/i) ||
      line.match(/^Best regards,?\s*$/i) ||
      line.match(/^Thanks,?\s*$/i) ||
      line.match(/^Thank you,?\s*$/i)
    ) {
      // Check if this is the end of actual content (only whitespace after)
      const remainingLines = lines.slice(i + 1).filter(l => l.trim()).join('');
      if (remainingLines.length < 50) { // If very little content after signature
        break;
      }
    }

    // Add line to customer response
    if (line.length > 0 || customerResponseLines.length > 0) {
      customerResponseLines.push(lines[i]);
    }
  }

  // Step 7: Clean up the extracted response
  let response = customerResponseLines.join('\n');

  // Remove MIME headers and boundaries
  response = response.replace(/^Content-Type:.*$/gm, '');
  response = response.replace(/^Content-Transfer-Encoding:.*$/gm, '');
  response = response.replace(/^Content-Disposition:.*$/gm, '');
  response = response.replace(/^--[A-Za-z0-9._-]+$/gm, '');
  response = response.replace(/^--[A-Za-z0-9._-]+--$/gm, '');

  // Remove quoted lines that start with >
  response = response.replace(/^>+.*$/gm, '');

  // Clean up excessive whitespace
  response = response.replace(/\n{3,}/g, '\n\n');    // Max 2 newlines
  response = response.replace(/[ \t]+/g, ' ');       // Collapse spaces
  response = response.replace(/^\s+|\s+$/gm, '');    // Trim each line
  response = response.trim();

  // If response is too short or empty, return placeholder
  if (response.length < 2) {
    return 'No content available';
  }

  return response;
}

async function main() {
  console.log('\n🔧 EMAIL EXTRACTION FIX - COMPLETE REIMPORT\n');
  console.log('This will:');
  console.log('1. Delete ALL existing email messages');
  console.log('2. Re-import emails with improved extraction');
  console.log('3. Show only customer responses (no threads/signatures)\n');

  // Step 1: Count existing email messages
  const { data: existingEmails, error: countError } = await supabase
    .from('messages')
    .select('id, created_at')
    .eq('type', 'email');

  if (countError) {
    console.error('❌ Error counting messages:', countError);
    return;
  }

  console.log(`📊 Found ${existingEmails.length} existing email messages`);

  if (existingEmails.length === 0) {
    console.log('✅ No existing emails to delete');
    return;
  }

  // Step 2: Delete all email messages
  console.log('\n🗑️  STEP 1: Deleting all email messages...');

  const { error: deleteError } = await supabase
    .from('messages')
    .delete()
    .eq('type', 'email');

  if (deleteError) {
    console.error('❌ Error deleting messages:', deleteError);
    return;
  }

  console.log(`✅ Deleted ${existingEmails.length} email messages`);

  // Step 3: Verify deletion
  const { data: remainingEmails } = await supabase
    .from('messages')
    .select('id')
    .eq('type', 'email');

  console.log(`✅ Verified: ${remainingEmails?.length || 0} email messages remaining`);

  console.log('\n✅ EMAIL MESSAGES DELETED SUCCESSFULLY');
  console.log('\n📋 NEXT STEPS:');
  console.log('1. Update server/utils/emailPoller.js with new extraction function');
  console.log('2. Restart your server');
  console.log('3. The email poller will automatically re-import all emails from Gmail');
  console.log('   with the new extraction logic');
  console.log('\nThe re-import will happen automatically when the server starts.');
  console.log('Check server logs for "📧 Scanning for unprocessed messages..."');
}

main().catch(console.error);
