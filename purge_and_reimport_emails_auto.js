/**
 * PURGE AND REIMPORT ALL EMAILS (AUTOMATED VERSION)
 *
 * This is the automated version that runs without confirmation prompts.
 * Use this when you're sure you want to proceed.
 */

// Load environment variables
require('dotenv').config();

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

// --- Helper Functions ---

function decodeQuotedPrintable(str) {
    if (!str) return '';
    try {
        str = str.replace(/=\r?\n/g, '');
        str = str.replace(/=([0-9A-F]{2})/gi, (match, hex) => {
            return String.fromCharCode(parseInt(hex, 16));
        });
        return str;
    } catch (error) {
        console.error('Error decoding quoted-printable:', error);
        return str;
    }
}

function htmlToText(html) {
    if (!html) return '';
    let text = html;
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<\/?(div|p|br|h[1-6]|li|tr)[^>]*>/gi, '\n');
    text = text.replace(/<\/td>/gi, '\t');
    text = text.replace(/<hr[^>]*>/gi, '\n---\n');
    text = text.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '$2 ($1)');
    text = text.replace(/<[^>]+>/g, '');
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/^\s+|\s+$/gm, '');
    return text.trim();
}

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
    };

    let result = str;
    for (const [entity, char] of Object.entries(entities)) {
        result = result.replace(new RegExp(entity, 'g'), char);
    }
    result = result.replace(/&#(\d+);/g, (match, dec) => {
        return String.fromCharCode(dec);
    });
    result = result.replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
        return String.fromCharCode(parseInt(hex, 16));
    });
    return result;
}

async function extractEmailBody(raw) {
    try {
        const parsed = await simpleParser(raw);
        let content = '';

        if (parsed.text && parsed.text.trim()) {
            content = parsed.text;
        } else if (parsed.html) {
            content = htmlToText(parsed.html);
        } else if (raw && typeof raw === 'string') {
            content = raw;
        } else if (Buffer.isBuffer(raw)) {
            content = raw.toString('utf8');
        }

        if (!content || content.trim().length === 0) {
            return 'No content available';
        }

        const base64Pattern = /----[A-Za-z0-9._]+\r?\n([A-Za-z0-9+/=\r\n]+)----[A-Za-z0-9._]+/;
        const base64Match = content.match(base64Pattern);
        if (base64Match && base64Match[1]) {
            try {
                const decoded = Buffer.from(base64Match[1].replace(/\r?\n/g, ''), 'base64').toString('utf8');
                content = decoded;
            } catch (e) {}
        }

        content = decodeHtmlEntities(content);
        content = decodeQuotedPrintable(content);
        content = content.replace(/<[^>]+>/g, ' ');

        let lines = content.split(/\r?\n/);
        let customerLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (
                line.match(/^On .+wrote:?/i) ||
                line.match(/^From:.*Sent:.*To:/i) ||
                line.match(/^----+ ?Original [Mm]essage ?----+/) ||
                line.match(/^_{5,}/) ||
                line.match(/^>+\s/) ||
                line.match(/^\d{1,2}[\s\/\-]\w+[\s\/\-]\d{2,4}/i) ||
                line.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+\d/i) ||
                line.match(/^charset=/i) ||
                line.match(/^Content-Type:/i) ||
                line.match(/^Content-Transfer-Encoding:/i)
            ) {
                break;
            }
            if (
                line.match(/^Sent from/i) ||
                line.match(/^Get Outlook/i) ||
                line.match(/^Sent from (my|the)/i) ||
                line.match(/^(Regards|Kind regards|Best regards|Thanks|Thank you|Cheers|Sincerely)[\s,]*$/i)
            ) {
                break;
            }
            if (line.length > 0) {
                customerLines.push(lines[i]);
            }
        }

        let response = customerLines.join('\n');
        response = response.replace(/^Content-Type:.*$/gm, '');
        response = response.replace(/^Content-Transfer-Encoding:.*$/gm, '');
        response = response.replace(/^Content-Disposition:.*$/gm, '');
        response = response.replace(/^--[A-Za-z0-9._-]+$/gm, '');
        response = response.replace(/^--[A-Za-z0-9._-]+--$/gm, '');
        response = response.replace(/^boundary=.*$/gm, '');
        response = response.replace(/\n{3,}/g, '\n\n');
        response = response.replace(/[ \t]+/g, ' ');
        response = response.replace(/^\s+|\s+$/gm, '');
        response = response.trim();

        if (!response || response.length < 3) {
            return 'No content available';
        }

        return response;
    } catch (error) {
        console.error('Error extracting email body:', error.message);
        return 'Error extracting email content';
    }
}

async function findLead(email) {
    if (!email) return null;
    const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .ilike('email', email.trim())
        .single();

    if (leadError && leadError.code === 'PGRST116') {
        return null;
    }
    if (leadError) {
        return null;
    }
    return leadData;
}

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

async function deleteAllEmails() {
    console.log('\n🗑️  STEP 2: Deleting all email messages from database...\n');
    try {
        const { error } = await supabase
            .from('messages')
            .delete()
            .or('type.eq.email,type.ilike.%email%');

        if (error) {
            console.error('❌ Error deleting messages:', error);
            return false;
        }
        console.log(`✅ Deleted all email messages from database`);

        console.log('\n🧹 Cleaning up email entries from booking history...\n');
        const { data: leads, error: leadsError } = await supabase
            .from('leads')
            .select('id, booking_history');

        if (!leadsError && leads) {
            let cleanedCount = 0;
            for (const lead of leads) {
                try {
                    const history = Array.isArray(lead.booking_history)
                        ? lead.booking_history
                        : (lead.booking_history ? JSON.parse(lead.booking_history) : []);
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
                } catch (e) {}
            }
            console.log(`✅ Cleaned booking history for ${cleanedCount} leads`);
        }
        return true;
    } catch (error) {
        console.error('❌ Error during deletion:', error);
        return false;
    }
}

async function reimportAllEmails(accountKey = 'primary') {
    const accountConfig = EMAIL_ACCOUNTS[accountKey];
    if (!accountConfig || !accountConfig.user || !accountConfig.pass) {
        console.log(`⚠️  Skipping ${accountKey} account - not configured`);
        return true;
    }

    console.log(`\n📥 STEP 3: Reimporting emails from ${accountConfig.name}...\n`);
    let client = null;

    try {
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
        console.log(`✅ Connected to IMAP`);
        await client.mailboxOpen('INBOX');
        console.log('✅ INBOX opened');

        const status = await client.status('INBOX', { messages: true });
        console.log(`📊 Mailbox has ${status.messages} total messages`);

        if (status.messages === 0) {
            console.log('ℹ️  No messages in mailbox');
            return true;
        }

        const range = `1:${status.messages}`;
        console.log(`📧 Fetching messages...\n`);

        const messages = [];
        for await (const message of client.fetch(range, {
            uid: true,
            envelope: true,
            internalDate: true,
            bodyParts: ['TEXT', '1']
        })) {
            messages.push(message);
        }

        console.log(`✅ Fetched ${messages.length} messages\n`);

        let processedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const message of messages) {
            const fromAddr = message.envelope?.from?.[0]?.address || 'Unknown';
            const subject = message.envelope?.subject || 'No subject';
            const uid = message.uid;

            process.stdout.write(`📧 [${processedCount + skippedCount + errorCount + 1}/${messages.length}] ${fromAddr.substring(0, 25)}... `);

            try {
                const lead = await findLead(fromAddr);
                if (!lead) {
                    console.log(`⚠️  No lead`);
                    skippedCount++;
                    continue;
                }

                let bodyContent = null;
                if (message.bodyParts && message.bodyParts.size > 0) {
                    bodyContent = message.bodyParts.get('TEXT') ||
                                  message.bodyParts.get('1') ||
                                  Array.from(message.bodyParts.values())[0];
                }

                if (!bodyContent || !Buffer.isBuffer(bodyContent)) {
                    bodyContent = Buffer.from(subject || 'No content available');
                }

                const body = await extractEmailBody(bodyContent.toString('utf8'));
                const emailReceivedDate = (message.internalDate instanceof Date && !isNaN(message.internalDate.getTime()))
                    ? message.internalDate.toISOString()
                    : new Date().toISOString();

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
                    console.log(`❌ DB error`);
                    errorCount++;
                    continue;
                }

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

                console.log(`✅ ${body.length}ch`);
                processedCount++;
            } catch (processError) {
                console.log(`❌ Error`);
                errorCount++;
            }
        }

        console.log(`\n✅ Reimport complete:`);
        console.log(`   - Processed: ${processedCount}`);
        console.log(`   - Skipped: ${skippedCount}`);
        console.log(`   - Errors: ${errorCount}`);

        stats.reimportedCount += processedCount;
        stats.skippedCount += skippedCount;
        stats.errorCount += errorCount;

        return true;
    } catch (error) {
        console.error(`❌ Error during reimport:`, error.message);
        return false;
    } finally {
        if (client) {
            try {
                await client.logout();
            } catch (e) {}
        }
    }
}

async function main() {
    console.log('\n' + '='.repeat(80));
    console.log('📧 PURGE AND REIMPORT ALL EMAILS (AUTOMATED)');
    console.log('='.repeat(80));
    console.log('\n🚀 Starting automated purge and reimport...\n');

    const backupSuccess = await backupExistingEmails();
    if (!backupSuccess) {
        console.error('\n❌ Backup failed! Aborting.');
        process.exit(1);
    }

    const deleteSuccess = await deleteAllEmails();
    if (!deleteSuccess) {
        console.error('\n❌ Deletion failed!');
        process.exit(1);
    }

    for (const accountKey of ['primary', 'secondary']) {
        await reimportAllEmails(accountKey);
    }

    const elapsedTime = ((Date.now() - stats.startTime) / 1000).toFixed(2);
    console.log('\n' + '='.repeat(80));
    console.log('✅ PURGE AND REIMPORT COMPLETE!');
    console.log('='.repeat(80));
    console.log('\n📊 Statistics:');
    console.log(`   - Backed up: ${stats.backupCount}`);
    console.log(`   - Reimported: ${stats.reimportedCount}`);
    console.log(`   - Skipped: ${stats.skippedCount}`);
    console.log(`   - Errors: ${stats.errorCount}`);
    console.log(`   - Time: ${elapsedTime}s\n`);

    process.exit(0);
}

main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
