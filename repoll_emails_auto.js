/**
 * AUTO REPOLL ALL EMAILS - NO CONFIRMATION
 * Immediately fetches and imports all emails with HTML extraction
 */

require('dotenv').config({ path: './server/.env' });
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const gmailService = require('./server/utils/gmailService');
const GmailEmailExtractor = require('./server/utils/gmailEmailExtractor');
const supabaseStorage = require('./server/utils/supabaseStorage');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function extractRegularAttachments(message, messageId, gmail, accountKey, supabaseStorage, embeddedImages) {
  const attachments = [];
  const embeddedAttachmentIds = new Set(embeddedImages.map(img => img.gmail_attachment_id).filter(Boolean));
  
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
        
        // Skip embedded images
        if (embeddedAttachmentIds.has(attachmentId) || contentId) {
          continue;
        }
        
        // Only regular attachments
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
        // Skip attachment errors
      }
    }
  } catch (error) {
    // Skip attachment extraction errors
  }
  
  return attachments;
}

async function repollAccount(accountKey) {
  console.log(`\n📧 Processing ${accountKey} account...`);
  
  try {
    const gmail = gmailService.getGmailClient(accountKey);
    const accountInfo = gmailService.getAccountInfo(accountKey);
    
    if (!gmail) {
      console.error(`❌ Failed to get Gmail client for ${accountKey}`);
      return { success: false, processed: 0, skipped: 0, errors: 0 };
    }

    console.log(`✅ Connected to: ${accountInfo.email}`);

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
        console.log(`   📄 Page ${pageCount}: ${allMessageIds.length} messages so far...`);
      } catch (error) {
        console.error(`❌ Error fetching message list:`, error.message);
        break;
      }
    } while (nextPageToken);

    console.log(`📬 Total messages in inbox: ${allMessageIds.length}`);

    // Process messages
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
        const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        const from = getHeader('From');
        const to = getHeader('To');
        const subject = getHeader('Subject') || '(No Subject)';
        const date = getHeader('Date');

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
          continue;
        }

        // Extract email content with HTML
        const emailContent = await extractor.extractEmailContent(message, messageId);
        const bodyText = emailContent.text || extractor.cleanEmailBody(emailContent.text || '', false);
        const htmlBody = emailContent.html || null;
        const embeddedImages = emailContent.embeddedImages || [];

        // Extract regular attachments
        const regularAttachments = await extractRegularAttachments(message, messageId, gmail, accountKey, supabaseStorage, embeddedImages);
        
        // Combine
        const embeddedImagesMetadata = embeddedImages.map(img => ({
          ...img,
          is_embedded: true
        }));
        const combinedAttachments = [...regularAttachments, ...embeddedImagesMetadata];

        // Check for duplicates
        const { data: existing } = await supabase
          .from('messages')
          .select('id')
          .eq('gmail_message_id', messageId)
          .limit(1);

        if (existing && existing.length > 0) {
          skipped++;
          continue;
        }

        // Store in database
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
            email_body: htmlBody || null,
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
            skipped++;
          } else {
            throw insertError;
          }
        } else {
          processed++;
        }

        // Progress
        if ((i + 1) % 10 === 0 || (i + 1) === allMessageIds.length) {
          console.log(`   ⏳ ${i + 1}/${allMessageIds.length}: ${processed} processed, ${skipped} skipped, ${errors} errors`);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        errors++;
        if (errors <= 5) {
          console.error(`❌ Error processing message:`, error.message);
        }
      }
    }

    console.log(`\n✅ ${accountKey} complete: ${processed} processed, ${skipped} skipped, ${errors} errors`);
    return { success: true, processed, skipped, errors };

  } catch (error) {
    console.error(`❌ Error repolling ${accountKey}:`, error.message);
    return { success: false, processed: 0, skipped: 0, errors: 0 };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔄 REPOLLING ALL EMAILS WITH HTML EXTRACTION');
  console.log('═══════════════════════════════════════════════════════════\n');

  const accounts = ['primary', 'secondary'];
  const results = {};

  for (const accountKey of accounts) {
    results[accountKey] = await repollAccount(accountKey);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ REPOLL COMPLETE!');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  let totalProcessed = 0;
  for (const accountKey of accounts) {
    const result = results[accountKey];
    console.log(`${accountKey.toUpperCase()}:`);
    console.log(`  ✅ Processed: ${result.processed}`);
    console.log(`  ⏭️  Skipped: ${result.skipped}`);
    console.log(`  ❌ Errors: ${result.errors}\n`);
    totalProcessed += result.processed || 0;
  }

  console.log(`✨ Total: ${totalProcessed} emails imported with HTML extraction!\n`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

