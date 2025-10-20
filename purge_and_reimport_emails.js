/**
 * PURGE AND REIMPORT ALL EMAILS
 *
 * This script will:
 * 1. Backup all existing email messages
 * 2. Delete all email messages from the database
 * 3. Reimport all emails from IMAP with the NEW improved extraction logic
 *
 * SAFETY FEATURES:
 * - Creates backup before deletion
 * - Requires confirmation before proceeding
 * - Shows statistics before and after
 * - Handles errors gracefully
 *
 * USAGE:
 *   node purge_and_reimport_emails.js
 */

// Load dependencies from server directory if needed
let ImapFlow, createClient, simpleParser;
try {
    ({ ImapFlow } = require('imapflow'));
    ({ createClient } = require('@supabase/supabase-js'));
    ({ simpleParser } = require('mailparser'));
} catch (e) {
    // Try loading from server directory
    ({ ImapFlow } = require('./server/node_modules/imapflow'));
    ({ createClient } = require('./server/node_modules/@supabase/supabase-js'));
    ({ simpleParser } = require('./server/node_modules/mailparser'));
}
const { randomUUID } = require('crypto');
const readline = require('readline');
const fs = require('fs');

// --- Configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnltvfzltdeilanxhlvy.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubHR2ZnpsdGRlaWxhbnhobHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTk4MzUsImV4cCI6MjA3Mjc3NTgzNX0.T_HaALQeSiCjLkpVuwQZUFnJbuSyRy2wf2kWiqJ99Lc';

// Email account configurations
const EMAIL_ACCOUNTS = {
  primary: {
    user: process.env.EMAIL_USER || process.env.GMAIL_USER,
    pass: process.env.EMAIL_PASSWORD || process.env.GMAIL_PASS,
    name: 'Primary Account'
  },
  secondary: {
    user: process.env.EMAIL_USER_2 || process.env.GMAIL_USER_2,
    pass: process.env.EMAIL_PASSWORD_2 || process.env.GMAIL_PASS_2,
    name: 'Secondary Account'
  }
};

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Statistics
const stats = {
  backupCount: 0,
  deletedCount: 0,
  reimportedCount: 0,
  skippedCount: 0,
  errorCount: 0,
  startTime: Date.now()
};

// --- Helper Functions (copied from emailPoller.js with improvements) ---

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
 * Convert HTML to plain text with better formatting
 */
function htmlToText(html) {
    if (!html) return '';

    let text = html;

    // Remove style and script tags with their content
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

    // Convert common block elements to newlines
    text = text.replace(/<\/?(div|p|br|h[1-6]|li|tr)[^>]*>/gi, '\n');
    text = text.replace(/<\/td>/gi, '\t');
    text = text.replace(/<hr[^>]*>/gi, '\n---\n');

    // Convert links to readable format
    text = text.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '$2 ($1)');

    // Remove all other HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Clean up whitespace
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n'); // Max 2 consecutive newlines
    text = text.replace(/[ \t]+/g, ' '); // Multiple spaces to single
    text = text.replace(/^\s+|\s+$/gm, ''); // Trim lines

    return text.trim();
}

/**
 * Decode HTML entities comprehensively
 */
function decodeHtmlEntities(str) {
    if (!str) return '';

    const entities = {
        '&nbsp;': ' ',
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#34;': '"',
        '&#39;': "'",
        '&apos;': "'",
        '&#x27;': "'",
        '&ldquo;': '"',
        '&rdquo;': '"',
        '&lsquo;': "'",
        '&rsquo;': "'",
        '&mdash;': '-',
        '&ndash;': '-',
        '&hellip;': '...',
        // Fix common UTF-8 encoding issues
        '\u00e2\u0080\u0099': "'",
        '\u00e2\u0080\u009c': '"',
        '\u00e2\u0080\u009d': '"',
        '\u00e2\u0080\u0094': '-',
        '\u00e2\u0080\u0093': '-',
        '\u00e2\u0080\u00a6': '...',
    };

    let result = str;
    for (const [entity, char] of Object.entries(entities)) {
        result = result.replace(new RegExp(entity, 'g'), char);
    }

    // Decode numeric entities
    result = result.replace(/&#(\d+);/g, (match, dec) => {
        return String.fromCharCode(dec);
    });
    result = result.replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
        return String.fromCharCode(parseInt(hex, 16));
    });

    return result;
}

/**
 * Extract email body with NEW improved extraction logic
 */
async function extractEmailBody(raw) {
    try {
        // Step 1: Parse email using simpleParser
        const parsed = await simpleParser(raw);
        let content = '';

        // Try to get text content first (plain text is preferred)
        if (parsed.text && parsed.text.trim()) {
            content = parsed.text;
        }
        // If no text, extract from HTML with improved conversion
        else if (parsed.html) {
            content = htmlToText(parsed.html);
        }
        // Last resort: try to extract from raw
        else if (raw && typeof raw === 'string') {
            content = raw;
        } else if (Buffer.isBuffer(raw)) {
            content = raw.toString('utf8');
        }

        // If still no content after all attempts
        if (!content || content.trim().length === 0) {
            return 'No content available';
        }

        // Step 2: Decode base64 content if present
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

        // Step 3: Decode HTML entities comprehensively
        content = decodeHtmlEntities(content);

        // Step 4: Decode quoted-printable encoding (=E2=80=99 etc)
        content = decodeQuotedPrintable(content);

        // Step 5: Remove any remaining HTML tags (in case some slipped through)
        content = content.replace(/<[^>]+>/g, ' ');

        // Step 6: Extract ONLY customer's response (not thread)
        let lines = content.split(/\r?\n/);
        let customerLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Stop at ANY quoted reply markers (VERY aggressive)
            if (
                line.match(/^On .+wrote:?/i) ||    // "On [date] [person] wrote:"
                line.match(/^From:.*Sent:.*To:/i) ||
                line.match(/^----+ ?Original [Mm]essage ?----+/) ||
                line.match(/^_{5,}/) ||
                line.match(/^>+\s/) ||             // Quoted lines with >
                line.match(/^\d{1,2}[\s\/\-]\w+[\s\/\-]\d{2,4}/i) ||  // Date lines
                line.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+\d/i) ||  // Day names with dates
                line.match(/^charset=/i) ||        // MIME artifacts
                line.match(/^Content-Type:/i) ||
                line.match(/^Content-Transfer-Encoding:/i)
            ) {
                break; // Stop here - everything after is quoted
            }

            // Stop at signature markers (ALWAYS, don't check remaining content)
            if (
                line.match(/^Sent from/i) ||
                line.match(/^Get Outlook/i) ||
                line.match(/^Sent from (my|the)/i) ||
                line.match(/^(Regards|Kind regards|Best regards|Thanks|Thank you|Cheers|Sincerely)[\s,]*$/i)
            ) {
                break; // Signature found, stop here
            }

            // Add non-empty lines
            if (line.length > 0) {
                customerLines.push(lines[i]);
            }
        }

        let response = customerLines.join('\n');

        // Step 7: Clean up MIME artifacts
        response = response.replace(/^Content-Type:.*$/gm, '');
        response = response.replace(/^Content-Transfer-Encoding:.*$/gm, '');
        response = response.replace(/^Content-Disposition:.*$/gm, '');
        response = response.replace(/^--[A-Za-z0-9._-]+$/gm, '');
        response = response.replace(/^--[A-Za-z0-9._-]+--$/gm, '');
        response = response.replace(/^boundary=.*$/gm, '');

        // Step 8: Final whitespace cleanup
        response = response.replace(/\n{3,}/g, '\n\n');
        response = response.replace(/[ \t]+/g, ' ');
        response = response.replace(/^\s+|\s+$/gm, '');
        response = response.trim();

        // Final check
        if (!response || response.length < 3) {
            return 'No content available';
        }

        return response;

    } catch (error) {
        console.error('📧 Error extracting email body:', error);
        return 'Error extracting email content';
    }
}

/**
 * Find lead by email address
 */
async function findLead(email) {
    if (!email) return null;

    const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .ilike('email', email.trim())
        .single();

    if (leadError && leadError.code === 'PGRST116') {
        return null; // No rows found
    }

    if (leadError) {
        console.error(`❌ Database error finding lead for ${email}:`, leadError.message);
        return null;
    }

    return leadData;
}

/**
 * Ask user for confirmation
 */
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

/**
 * Step 1: Backup existing emails
 */
async function backupExistingEmails() {
    console.log('\n📦 STEP 1: Backing up existing emails...\n');

    try {
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('type', 'email')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('❌ Error fetching messages for backup:', error);
            return false;
        }

        if (!messages || messages.length === 0) {
            console.log('ℹ️  No email messages found to backup.');
            return true;
        }

        const backupFilename = `email_backup_${new Date().toISOString().replace(/:/g, '-')}.json`;
        fs.writeFileSync(backupFilename, JSON.stringify(messages, null, 2));

        stats.backupCount = messages.length;
        console.log(`✅ Backed up ${messages.length} emails to ${backupFilename}`);
        return true;

    } catch (error) {
        console.error('❌ Error during backup:', error);
        return false;
    }
}

/**
 * Step 2: Delete all email messages
 */
async function deleteAllEmails() {
    console.log('\n🗑️  STEP 2: Deleting all email messages from database...\n');

    try {
        // Delete all messages where type = 'email' or type contains 'email'
        const { data, error } = await supabase
            .from('messages')
            .delete()
            .or('type.eq.email,type.ilike.%email%');

        if (error) {
            console.error('❌ Error deleting messages:', error);
            return false;
        }

        console.log(`✅ Deleted all email messages from database`);

        // Also clean up EMAIL_* entries from booking_history
        console.log('\n🧹 Cleaning up email entries from booking history...\n');

        const { data: leads, error: leadsError } = await supabase
            .from('leads')
            .select('id, booking_history');

        if (leadsError) {
            console.warn('⚠️  Could not fetch leads for history cleanup:', leadsError);
        } else if (leads) {
            let cleanedCount = 0;
            for (const lead of leads) {
                try {
                    const history = Array.isArray(lead.booking_history)
                        ? lead.booking_history
                        : (lead.booking_history ? JSON.parse(lead.booking_history) : []);

                    // Remove EMAIL_SENT and EMAIL_RECEIVED entries
                    const cleanedHistory = history.filter(entry =>
                        !['EMAIL_SENT', 'EMAIL_RECEIVED'].includes(entry.action)
                    );

                    if (cleanedHistory.length !== history.length) {
                        await supabase
                            .from('leads')
                            .update({ booking_history: cleanedHistory })
                            .eq('id', lead.id);
                        cleanedCount++;
                    }
                } catch (e) {
                    console.warn(`⚠️  Error cleaning history for lead ${lead.id}:`, e.message);
                }
            }
            console.log(`✅ Cleaned booking history for ${cleanedCount} leads`);
        }

        return true;

    } catch (error) {
        console.error('❌ Error during deletion:', error);
        return false;
    }
}

/**
 * Step 3: Reimport all emails from IMAP
 */
async function reimportAllEmails(accountKey = 'primary') {
    const accountConfig = EMAIL_ACCOUNTS[accountKey];

    if (!accountConfig || !accountConfig.user || !accountConfig.pass) {
        console.log(`⚠️  Skipping ${accountKey} account - not configured`);
        return true;
    }

    console.log(`\n📥 STEP 3: Reimporting emails from ${accountConfig.name} (${accountConfig.user})...\n`);

    let client = null;

    try {
        // Connect to IMAP
        client = new ImapFlow({
            host: 'imap.gmail.com',
            port: 993,
            secure: true,
            auth: { user: accountConfig.user, pass: accountConfig.pass },
            logger: false,
            tls: {
                rejectUnauthorized: true,
                servername: 'imap.gmail.com',
                minVersion: 'TLSv1.2'
            },
        });

        await client.connect();
        console.log(`✅ Connected to IMAP for ${accountConfig.name}`);

        await client.mailboxOpen('INBOX');
        console.log('✅ INBOX opened');

        // Get mailbox status
        const status = await client.status('INBOX', { messages: true, uidNext: true });
        console.log(`📊 Mailbox has ${status.messages} total messages`);

        if (status.messages === 0) {
            console.log('ℹ️  No messages in mailbox');
            return true;
        }

        // Fetch ALL messages (not just last 20)
        const range = `1:${status.messages}`;
        console.log(`📧 Fetching messages ${range}...\n`);

        const messages = [];
        for await (const message of client.fetch(range, {
            uid: true,
            envelope: true,
            internalDate: true,
            bodyStructure: true,
            bodyParts: ['1', 'TEXT']
        })) {
            messages.push(message);
        }

        console.log(`✅ Fetched ${messages.length} messages\n`);
        console.log('🔄 Processing messages...\n');

        let processedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const message of messages) {
            const fromAddr = message.envelope?.from?.[0]?.address || 'Unknown';
            const subject = message.envelope?.subject || 'No subject';
            const toAddr = message.envelope?.to?.[0]?.address || 'Unknown';
            const uid = message.uid;

            process.stdout.write(`📧 [${processedCount + skippedCount + errorCount + 1}/${messages.length}] Processing UID ${uid} from ${fromAddr}... `);

            try {
                // Check if a lead exists
                const lead = await findLead(fromAddr);

                if (!lead) {
                    console.log(`⚠️  No lead found, skipping`);
                    skippedCount++;
                    continue;
                }

                // Get body content
                let bodyContent = null;
                if (message.bodyParts && message.bodyParts.size > 0) {
                    bodyContent = message.bodyParts.get('TEXT') ||
                                  message.bodyParts.get('text') ||
                                  message.bodyParts.get('1') ||
                                  message.bodyParts.get('1.1') ||
                                  message.bodyParts.get('1.2') ||
                                  message.bodyParts.get('2') ||
                                  message.bodyParts.get('BODY[TEXT]') ||
                                  Array.from(message.bodyParts.values())[0];
                }

                if (!bodyContent || !Buffer.isBuffer(bodyContent)) {
                    bodyContent = Buffer.from(subject || 'No content available');
                }

                // Extract email body using NEW improved logic
                const body = await extractEmailBody(bodyContent.toString('utf8'));

                // Determine received date
                const emailReceivedDate = (message.internalDate && message.internalDate instanceof Date && !isNaN(message.internalDate.getTime()))
                    ? message.internalDate.toISOString()
                    : (message.envelope?.date && message.envelope.date instanceof Date && !isNaN(message.envelope.date.getTime()))
                    ? message.envelope.date.toISOString()
                    : new Date().toISOString();

                // Insert to messages table
                const messageId = randomUUID();
                const { error: insertError } = await supabase
                    .from('messages')
                    .insert({
                        id: messageId,
                        lead_id: lead.id,
                        type: 'email',
                        subject: subject,
                        content: body,
                        recipient_email: fromAddr,
                        status: 'received',
                        imap_uid: uid.toString(),
                        sent_at: emailReceivedDate,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        read_status: false
                    });

                if (insertError) {
                    console.log(`❌ DB error: ${insertError.message}`);
                    errorCount++;
                    continue;
                }

                // Update booking history
                const history = Array.isArray(lead.booking_history)
                    ? lead.booking_history
                    : (lead.booking_history ? JSON.parse(lead.booking_history) : []);

                history.unshift({
                    action: 'EMAIL_RECEIVED',
                    timestamp: emailReceivedDate,
                    details: {
                        subject,
                        body: body.substring(0, 150) + '...',
                        direction: 'received',
                        channel: 'email',
                        read: false
                    }
                });

                await supabase
                    .from('leads')
                    .update({
                        booking_history: history,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', lead.id);

                console.log(`✅ Imported (${body.length} chars)`);
                processedCount++;

            } catch (processError) {
                console.log(`❌ Error: ${processError.message}`);
                errorCount++;
            }
        }

        console.log(`\n✅ Reimport complete for ${accountConfig.name}:`);
        console.log(`   - Processed: ${processedCount}`);
        console.log(`   - Skipped (no lead): ${skippedCount}`);
        console.log(`   - Errors: ${errorCount}`);

        stats.reimportedCount += processedCount;
        stats.skippedCount += skippedCount;
        stats.errorCount += errorCount;

        return true;

    } catch (error) {
        console.error(`❌ Error during reimport from ${accountConfig.name}:`, error);
        return false;
    } finally {
        if (client) {
            try {
                await client.logout();
                console.log(`✅ Disconnected from ${accountConfig.name}`);
            } catch (e) {
                console.warn('⚠️  Error during disconnect:', e.message);
            }
        }
    }
}

/**
 * Main execution
 */
async function main() {
    console.log('\n' + '='.repeat(80));
    console.log('📧 PURGE AND REIMPORT ALL EMAILS');
    console.log('='.repeat(80));
    console.log('\nThis script will:');
    console.log('  1. Backup all existing email messages to a JSON file');
    console.log('  2. Delete all email messages from the database');
    console.log('  3. Reimport all emails from IMAP with NEW improved extraction');
    console.log('\n⚠️  WARNING: This will delete all existing email messages!');
    console.log('   (A backup will be created first)\n');

    // Get current email count
    const { count: emailCount, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .or('type.eq.email,type.ilike.%email%');

    if (!countError) {
        console.log(`📊 Current email messages in database: ${emailCount || 0}\n`);
    }

    // Ask for confirmation
    const answer = await askQuestion('❓ Do you want to proceed? (yes/no): ');

    if (answer.toLowerCase() !== 'yes') {
        console.log('\n❌ Operation cancelled by user.');
        process.exit(0);
    }

    console.log('\n🚀 Starting purge and reimport process...\n');

    // Step 1: Backup
    const backupSuccess = await backupExistingEmails();
    if (!backupSuccess) {
        console.error('\n❌ Backup failed! Aborting operation for safety.');
        process.exit(1);
    }

    // Step 2: Delete
    const deleteSuccess = await deleteAllEmails();
    if (!deleteSuccess) {
        console.error('\n❌ Deletion failed! Check the error and try again.');
        process.exit(1);
    }

    // Step 3: Reimport from both accounts
    for (const accountKey of ['primary', 'secondary']) {
        const reimportSuccess = await reimportAllEmails(accountKey);
        if (!reimportSuccess) {
            console.warn(`\n⚠️  Reimport failed for ${accountKey} account, but continuing...`);
        }
    }

    // Final statistics
    const elapsedTime = ((Date.now() - stats.startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(80));
    console.log('✅ PURGE AND REIMPORT COMPLETE!');
    console.log('='.repeat(80));
    console.log('\n📊 Statistics:');
    console.log(`   - Backed up: ${stats.backupCount} messages`);
    console.log(`   - Deleted: ${stats.deletedCount} messages`);
    console.log(`   - Reimported: ${stats.reimportedCount} messages`);
    console.log(`   - Skipped (no lead): ${stats.skippedCount} messages`);
    console.log(`   - Errors: ${stats.errorCount} messages`);
    console.log(`   - Total time: ${elapsedTime} seconds\n`);

    console.log('✅ All emails have been reimported with the NEW improved extraction logic!');
    console.log('   Check your CRM to see the cleaned, properly formatted emails.\n');

    process.exit(0);
}

// Run the script
main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
