const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

(async () => {
  // Check leads table schema
  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n📋 LEADS TABLE COLUMNS:\n');
  if (leads && leads.length > 0) {
    const columns = Object.keys(leads[0]);
    columns.forEach(col => console.log('  -', col));

    if (columns.includes('templateId')) {
      console.log('\n✅ templateId column EXISTS');
    } else {
      console.log('\n❌ templateId column DOES NOT EXIST');
      console.log('   This column is not needed - templateId is only used temporarily during booking');
    }
  }

  // Check templates
  const { data: templates } = await supabase
    .from('templates')
    .select('*')
    .eq('type', 'booking_confirmation')
    .eq('is_active', true);

  console.log('\n\n📧 ACTIVE BOOKING CONFIRMATION TEMPLATES:\n');
  console.log('Total:', templates?.length || 0);
  console.log();

  templates?.forEach((t, i) => {
    console.log('='.repeat(70));
    console.log('TEMPLATE', i + 1, ':', t.name);
    console.log('='.repeat(70));
    console.log('ID:', t.id);
    console.log('Email Account:', t.email_account || 'primary (not set)');
    console.log('Send Email:', t.send_email);
    console.log('Send SMS:', t.send_sms);
    console.log('Subject:', t.subject);
    console.log();
  });
})();
