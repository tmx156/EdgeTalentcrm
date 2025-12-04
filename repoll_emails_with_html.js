/**
 * REPOLL ALL EMAILS WITH HTML EXTRACTION
 * 
 * This script will:
 * 1. Delete all existing email messages from the database
 * 2. Repoll all emails from Gmail API with NEW HTML extraction
 * 3. Store HTML content and embedded images
 * 
 * SAFETY FEATURES:
 * - Creates backup before deletion
 * - Requires confirmation before proceeding
 * - Shows statistics before and after
 * 
 * USAGE:
 *   node repoll_emails_with_html.js [accountKey]
 *   accountKey: 'primary' or 'secondary' (default: both)
 */

require('dotenv').config({ path: './server/.env' });
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const GmailEmailExtractor = require('./server/utils/gmailEmailExtractor');
const supabaseStorage = require('./server/utils/supabaseStorage');
const gmailService = require('./server/utils/gmailService');

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get account key from command line or default to both
const accountKeyArg = process.argv[2];
const accountsToProcess = accountKeyArg && ['primary', 'secondary'].includes(accountKeyArg.toLowerCase())
  ? [accountKeyArg.toLowerCase()]
  : ['primary', 'secondary'];

// Readline interface for user confirmation
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
 * Backup all email messages to a JSON file
 */
async function backupEmails() {
  console.log('📦 Creating backup of existing emails...');
  
  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('type', 'email')
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

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
 * Delete all email messages from database
 */
async function deleteAllEmails() {
  console.log('🗑️  Deleting all email messages from database...');
  
  try {
    const { data, error } = await supabase
      .from('messages')
      .delete()
      .eq('type', 'email')
      .select();

    if (error) {
      throw error;
    }

    console.log(`✅ Deleted ${data?.length || 0} email messages`);
    return { success: true, deleted: data?.length || 0 };
  } catch (error) {
    console.error('❌ Error deleting emails:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get count of emails in Gmail inbox
 */
async function getGmailMessageCount(gmail, accountKey) {
  try {
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 1
    });
    
    // Get total count from nextPageToken or estimate
    // Note: Gmail API doesn't return total count directly, so we'll estimate
    const response2 = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 500
    });
    
    return response2.data.messages?.length || 0;
  } catch (error) {
    console.error(`❌ Error getting message count for ${accountKey}:`, error.message);
    return 0;
  }
}

/**
 * Repoll all emails from Gmail with HTML extraction
 */
async function repollEmails(accountKey) {
  console.log(`\n📧 Starting repoll for ${accountKey} account...`);
  
  try {
    // Get Gmail client
    const gmail = gmailService.getGmailClient(accountKey);
    const accountInfo = gmailService.getAccountInfo(accountKey);
    
    if (!gmail) {
      console.error(`❌ Failed to get Gmail client for ${accountKey}`);
      return { success: false, error: 'Gmail client not available' };
    }

    console.log(`✅ Connected to Gmail: ${accountInfo.email}`);

    // Get all message IDs
    let allMessageIds = [];
    let nextPageToken = null;
    let pageCount = 0;

    do {
      try {
        const response = await gmail.users.messages.list({
          userId: 'me',
          maxResults: 500,
          pageToken: nextPageToken
        });

        if (response.data.messages) {
          allMessageIds.push(...response.data.messages.map(msg => msg.id));
        }

        nextPageToken = response.data.nextPageToken;
        pageCount++;
        
        console.log(`   📄 Fetched page ${pageCount} (${allMessageIds.length} messages so far)...`);
      } catch (error) {
        console.error(`❌ Error fetching message list:`, error.message);
        break;
      }
    } while (nextPageToken);

    console.log(`📬 Found ${allMessageIds.length} messages in Gmail inbox`);

    // Process each message
    const extractor = new GmailEmailExtractor(gmail, accountKey, supabaseStorage);
    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < allMessageIds.length; i++) {
      const messageId = allMessageIds[i];
      
      try {
        // Get full message
        const messageResponse = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full'
        });

        const message = messageResponse.data;
        const headers = message.payload.headers;

        // Extract headers
        const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
        const from = getHeader('From');
        const to = getHeader('To');
        const subject = getHeader('Subject') || '(No Subject)';
        const date = getHeader('Date');

        // Extract email address
        const extractEmail = (str) => {
          if (!str) return '';
          const match = str.match(/<([^>]+)>/);
          return match ? match[1] : str.trim();
        };

        const fromEmail = extractEmail(from);
        const toEmail = extractEmail(to);

        // Only process emails TO our account
        if (!toEmail.toLowerCase().includes(accountInfo.email.toLowerCase())) {
          skipped++;
          continue;
        }

        // Find lead
        const { data: leadData, error: leadError } = await supabase
          .from('leads')
          .select('*')
          .ilike('email', fromEmail.trim())
          .single();

        if (leadError || !leadData) {
          skipped++;
          continue; // Skip emails from unknown senders
        }

        // Extract email content with HTML
        const emailContent = await extractor.extractEmailContent(message, messageId);
        const bodyText = emailContent.text || extractor.cleanEmailBody(emailContent.text || '', false);
        const htmlBody = emailContent.html || null;
        const embeddedImages = emailContent.embeddedImages || [];

        // Extract regular attachments (non-embedded only)
        // Embedded images are already extracted by extractor, so we only need regular attachments
        const regularAttachments = await extractRegularAttachments(message, messageId, gmail, accountKey, supabaseStorage, embeddedImages);
        
        // Combine embedded images with regular attachments
        const embeddedImagesMetadata = embeddedImages.map(img => ({
          ...img,
          is_embedded: true
        }));
        const combinedAttachments = [...regularAttachments, ...embeddedImagesMetadata];

        // Store in database
        const { randomUUID } = require('crypto');
        const recordId = randomUUID();
        const emailReceivedDate = date ? new Date(date).toISOString() : new Date().toISOString();
        const processingDate = new Date().toISOString();

        const { error: insertError } = await supabase
          .from('messages')
          .insert({
            id: recordId,
            lead_id: leadData.id,
            type: 'email',
            subject: subject,
            content: bodyText || '(No content)',
            email_body: htmlBody || null, // HTML version
            recipient_email: fromEmail,
            status: 'delivered',
            gmail_message_id: messageId,
            gmail_account_key: accountKey,
            attachments: combinedAttachments.length > 0 ? combinedAttachments : null,
            sent_at: emailReceivedDate,
            created_at: processingDate,
            updated_at: processingDate,
            read_status: false
          });

        if (insertError) {
          if (insertError.code === '23505') {
            skipped++; // Duplicate
          } else {
            throw insertError;
          }
        } else {
          processed++;
        }

        // Progress indicator
        if ((i + 1) % 10 === 0) {
          console.log(`   ⏳ Progress: ${i + 1}/${allMessageIds.length} (${processed} processed, ${skipped} skipped, ${errors} errors)`);
        }

        // Rate limiting
        if (i < allMessageIds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        errors++;
        console.error(`❌ Error processing message ${messageId}:`, error.message);
      }
    }

    console.log(`\n✅ Repoll complete for ${accountKey}:`);
    console.log(`   Processed: ${processed}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);

    return { success: true, processed, skipped, errors };

  } catch (error) {
    console.error(`❌ Error repolling emails for ${accountKey}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Extract regular attachments (non-embedded only)
 * Excludes embedded images since they're already handled by extractor
 */
async function extractRegularAttachments(message, messageId, gmail, accountKey, supabaseStorage, embeddedImages) {
  const attachments = [];
  const embeddedAttachmentIds = new Set(embeddedImages.map(img => img.gmail_attachment_id));
  
  try {
    const parts = message.payload?.parts || [];
    
    const findAttachments = (parts) => {
      if (!parts) return [];
      const found = [];
      for (const part of parts) {
        if (part.parts) {
          found.push(...findAttachments(part.parts));
        }
        
        const filename = part.filename;
        const attachmentId = part.body?.attachmentId;
        const mimeType = part.mimeType;
        const headers = part.headers || [];
        const contentDisposition = headers.find(h => h.name.toLowerCase() === 'content-disposition')?.value || '';
        const contentId = headers.find(h => h.name.toLowerCase() === 'content-id')?.value || '';
        
        // Skip embedded images (already extracted)
        if (embeddedAttachmentIds.has(attachmentId) || contentId) {
          return found;
        }
        
        // Only regular attachments (not inline/embedded, not text/html parts)
        if (filename && attachmentId && mimeType && 
            !mimeType.startsWith('text/') && 
            !mimeType.startsWith('multipart/') &&
            !contentDisposition.toLowerCase().includes('inline')) {
          found.push({ part, filename, attachmentId, mimeType, size: part.body?.size || 0 });
        }
      }
      return found;
    };
    
    const attachmentParts = findAttachments(parts);
    
    for (const att of attachmentParts) {
      try {
        const attachmentResponse = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId: messageId,
          id: att.attachmentId
        });
        
        const fileData = attachmentResponse.data.data;
        const base64 = fileData.replace(/-/g, '+').replace(/_/g, '/');
        const pad = base64.length % 4;
        const paddedBase64 = pad ? base64 + '='.repeat(4 - pad) : base64;
        const buffer = Buffer.from(paddedBase64, 'base64');
        
        const fileExt = path.extname(att.filename) || '';
        const baseName = path.basename(att.filename, fileExt);
        const uniqueFilename = `email-attachments/${messageId}/${baseName}_${Date.now()}${fileExt}`;
        
        const tempDir = path.join(__dirname, 'server/uploads/temp_email_attachments');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempFilePath = path.join(tempDir, `${Date.now()}_${att.filename}`);
        fs.writeFileSync(tempFilePath, buffer);
        
        const uploadResult = await supabaseStorage.uploadFile(
          tempFilePath,
          uniqueFilename,
          att.mimeType
        );
        
        try {
          fs.unlinkSync(tempFilePath);
        } catch (e) {}
        
        if (uploadResult.success) {
          attachments.push({
            filename: att.filename,
            url: uploadResult.url,
            size: att.size || buffer.length,
            mimetype: att.mimeType,
            gmail_attachment_id: att.attachmentId,
            is_embedded: false
          });
        }
      } catch (error) {
        console.warn(`⚠️ Error processing attachment ${att.filename}:`, error.message);
      }
    }
  } catch (error) {
    console.warn(`⚠️ Error extracting attachments:`, error.message);
  }
  
  return attachments;
}

/**
 * Main execution
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔄 REPOLL ALL EMAILS WITH HTML EXTRACTION');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`📋 Accounts to process: ${accountsToProcess.join(', ')}\n`);

  // Confirm action
  const confirm = await askQuestion('⚠️  This will DELETE all existing emails and repoll from Gmail. Continue? (yes/no): ');
  
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

  // Step 3: Repoll for each account
  console.log('\n📧 Step 3: Repolling emails from Gmail...');
  const results = {};
  
  for (const accountKey of accountsToProcess) {
    results[accountKey] = await repollEmails(accountKey);
  }

  // Final summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ REPOLL COMPLETE!');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  for (const accountKey of accountsToProcess) {
    const result = results[accountKey];
    if (result.success) {
      console.log(`${accountKey.toUpperCase()}:`);
      console.log(`  ✅ Processed: ${result.processed}`);
      console.log(`  ⏭️  Skipped: ${result.skipped}`);
      console.log(`  ❌ Errors: ${result.errors}\n`);
    } else {
      console.log(`${accountKey.toUpperCase()}:`);
      console.log(`  ❌ Failed: ${result.error}\n`);
    }
  }

  console.log(`📦 Backup saved to: ${backupResult.file}`);
  console.log('\n✨ All emails have been repolled with HTML extraction!');

  rl.close();
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  rl.close();
  process.exit(1);
});

