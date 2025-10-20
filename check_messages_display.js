const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

(async () => {
  console.log('\n📧 CHECKING MESSAGE DISPLAY ISSUES...\n');

  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, content, sender_email, created_at')
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`Found ${messages.length} recent inbound messages\n`);

  messages.forEach((msg, i) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`MESSAGE ${i + 1}`);
    console.log(`${'='.repeat(80)}`);
    console.log('From:', msg.sender_email);
    console.log('Date:', msg.created_at);
    console.log('\nFULL CONTENT:');
    console.log('-'.repeat(80));
    console.log(msg.content);
    console.log('-'.repeat(80));
  });

  console.log('\n\n📊 ANALYSIS:\n');

  messages.forEach((msg, i) => {
    const issues = [];

    if (msg.content.includes('On ') && msg.content.includes(' wrote:')) {
      issues.push('Contains email thread (On...wrote:)');
    }
    if (msg.content.match(/^>/m)) {
      issues.push('Contains quoted lines (>)');
    }
    if (msg.content.includes('Content-Type:')) {
      issues.push('Contains MIME headers');
    }
    if (msg.content.match(/--[A-Za-z0-9-]+/)) {
      issues.push('Contains MIME boundaries');
    }
    if (msg.content.match(/=[0-9A-F]{2}/)) {
      issues.push('Contains quoted-printable encoding');
    }
    if (msg.content.includes('<') && msg.content.includes('>')) {
      issues.push('May contain HTML tags');
    }

    console.log(`Message ${i + 1}: ${issues.length > 0 ? '❌ ' + issues.join(', ') : '✅ Clean'}`);
  });

  console.log('\n✅ Check complete\n');
})();
