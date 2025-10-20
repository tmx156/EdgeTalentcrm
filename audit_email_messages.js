/**
 * Email Messages Audit Script
 * Analyzes email messages in the database to identify HTML rendering issues
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://tnltvfzltdeilanxhlvy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubHR2ZnpsdGRlaWxhbnhobHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTk4MzUsImV4cCI6MjA3Mjc3NTgzNX0.T_HaALQeSiCjLkpVuwQZUFnJbuSyRy2wf2kWiqJ99Lc';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\n' + '='.repeat(100));
console.log('📧 EMAIL MESSAGES AUDIT');
console.log('='.repeat(100) + '\n');

async function auditEmails() {
  try {
    // Fetch recent email messages
    console.log('📋 Fetching email messages from database...\n');
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('❌ Error fetching messages:', error);
      return;
    }

    console.log(`✅ Found ${messages.length} recent messages\n`);

    // Analyze message types and content
    const stats = {
      total: messages.length,
      email: 0,
      sms: 0,
      both: 0,
      hasHtml: 0,
      hasPlainText: 0,
      hasSubject: 0,
      hasRecipientEmail: 0,
      hasDuplicates: 0,
      contentIssues: []
    };

    const seenMessages = new Map(); // Track potential duplicates
    const htmlPatterns = [
      /<[^>]+>/g,  // HTML tags
      /&nbsp;/g,    // HTML entities
      /&lt;/g,
      /&gt;/g,
      /&amp;/g,
      /<!DOCTYPE/i,
      /<html/i,
      /<body/i,
      /<div/i,
      /<p/i,
      /<br/i
    ];

    console.log('📊 ANALYZING MESSAGES...\n');
    console.log('='.repeat(100));

    messages.forEach((msg, idx) => {
      // Type statistics
      if (msg.type === 'email') stats.email++;
      else if (msg.type === 'sms') stats.sms++;
      else if (msg.type === 'both') stats.both++;

      // Content statistics
      if (msg.subject) stats.hasSubject++;
      if (msg.recipient_email) stats.hasRecipientEmail++;

      const content = msg.content || '';

      // Check for HTML
      let containsHtml = false;
      htmlPatterns.forEach(pattern => {
        if (pattern.test(content)) {
          containsHtml = true;
        }
      });

      if (containsHtml) {
        stats.hasHtml++;
      } else {
        stats.hasPlainText++;
      }

      // Check for duplicates (same recipient, subject, and similar timestamp)
      const key = `${msg.recipient_email}-${msg.subject}-${new Date(msg.created_at).toDateString()}`;
      if (seenMessages.has(key)) {
        stats.hasDuplicates++;
        seenMessages.get(key).push(msg.id);
      } else {
        seenMessages.set(key, [msg.id]);
      }

      // Show first 5 messages with details
      if (idx < 5) {
        console.log(`\nMessage ${idx + 1}/${messages.length}`);
        console.log('-'.repeat(100));
        console.log(`ID: ${msg.id}`);
        console.log(`Type: ${msg.type || 'N/A'}`);
        console.log(`Direction: ${msg.direction || 'N/A'}`);
        console.log(`Status: ${msg.status || 'N/A'}`);
        console.log(`Created: ${new Date(msg.created_at).toLocaleString()}`);
        console.log(`Subject: ${msg.subject || 'N/A'}`);
        console.log(`To: ${msg.recipient_email || msg.recipient_phone || 'N/A'}`);
        console.log(`From: ${msg.sender_email || msg.sent_by_name || 'N/A'}`);
        console.log(`Contains HTML: ${containsHtml ? '⚠️ YES' : '✅ NO'}`);

        // Show content preview
        const preview = content.substring(0, 200);
        console.log(`Content Preview (first 200 chars):`);
        console.log(`"${preview}${content.length > 200 ? '...' : ''}"`);

        if (containsHtml) {
          console.log(`\n⚠️ HTML DETECTED IN CONTENT!`);
          stats.contentIssues.push({
            id: msg.id,
            subject: msg.subject,
            contentLength: content.length,
            sample: preview
          });
        }
      }
    });

    // Summary statistics
    console.log('\n' + '='.repeat(100));
    console.log('📊 STATISTICS SUMMARY');
    console.log('='.repeat(100));
    console.log(`\nTotal Messages: ${stats.total}`);
    console.log(`\nBy Type:`);
    console.log(`  Email: ${stats.email}`);
    console.log(`  SMS: ${stats.sms}`);
    console.log(`  Both: ${stats.both}`);
    console.log(`\nContent Analysis:`);
    console.log(`  Messages with HTML code: ${stats.hasHtml} ${stats.hasHtml > 0 ? '⚠️' : '✅'}`);
    console.log(`  Messages with plain text: ${stats.hasPlainText}`);
    console.log(`  Messages with subject: ${stats.hasSubject}`);
    console.log(`  Messages with recipient email: ${stats.hasRecipientEmail}`);
    console.log(`\nDuplicate Detection:`);
    console.log(`  Potential duplicates: ${stats.hasDuplicates}`);

    // Show duplicate groups
    if (stats.hasDuplicates > 0) {
      console.log(`\n⚠️ DUPLICATE GROUPS FOUND:`);
      let groupNum = 1;
      seenMessages.forEach((ids, key) => {
        if (ids.length > 1) {
          console.log(`\n  Group ${groupNum}: ${ids.length} duplicates`);
          console.log(`    Key: ${key}`);
          console.log(`    IDs: ${ids.join(', ')}`);
          groupNum++;
        }
      });
    }

    // Show HTML issues
    if (stats.contentIssues.length > 0) {
      console.log('\n' + '='.repeat(100));
      console.log('⚠️ MESSAGES WITH HTML RENDERING ISSUES');
      console.log('='.repeat(100));
      stats.contentIssues.forEach((issue, idx) => {
        console.log(`\n${idx + 1}. ID: ${issue.id}`);
        console.log(`   Subject: ${issue.subject || 'N/A'}`);
        console.log(`   Content Length: ${issue.contentLength} characters`);
        console.log(`   Sample: "${issue.sample}..."`);
      });
    }

    // Recommendations
    console.log('\n' + '='.repeat(100));
    console.log('💡 RECOMMENDATIONS');
    console.log('='.repeat(100));

    if (stats.hasHtml > 0) {
      console.log(`\n⚠️ ${stats.hasHtml} messages contain HTML code that needs proper rendering:`);
      console.log(`   ✅ Solution: Implement HTML sanitization and rendering in the UI`);
      console.log(`   ✅ Use DOMPurify to sanitize HTML`);
      console.log(`   ✅ Render as dangerouslySetInnerHTML or use a safe HTML renderer`);
    }

    if (stats.hasDuplicates > 0) {
      console.log(`\n⚠️ ${stats.hasDuplicates} potential duplicate messages found:`);
      console.log(`   ✅ Solution: Implement duplicate detection in email poller`);
      console.log(`   ✅ Use unique message IDs from email headers`);
    }

    console.log('\n' + '='.repeat(100));
    console.log('🏁 AUDIT COMPLETE');
    console.log('='.repeat(100) + '\n');

  } catch (error) {
    console.error('❌ Audit failed:', error);
  }
}

auditEmails();
