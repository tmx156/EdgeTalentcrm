/**
 * Test Template Email Routing
 * Verify templates send from correct email account
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testTemplates() {
  console.log('\n📧 TEMPLATE EMAIL ROUTING TEST\n');
  console.log('='.repeat(70));

  // Get all active booking confirmation templates
  const { data: templates } = await supabase
    .from('templates')
    .select('*')
    .eq('type', 'booking_confirmation')
    .eq('is_active', true);

  if (!templates || templates.length === 0) {
    console.log('❌ No active booking confirmation templates found!');
    return;
  }

  console.log(`Found ${templates.length} active booking confirmation templates:\n`);

  templates.forEach((template, i) => {
    console.log(`\n${i + 1}. ${template.name}`);
    console.log('   ' + '-'.repeat(65));
    console.log('   ID:', template.id);
    console.log('   Email Account:', template.email_account || 'NOT SET (will use primary)');
    console.log('   Send Email:', template.send_email ? '✅' : '❌');
    console.log('   Send SMS:', template.send_sms ? '✅' : '❌');
    console.log('   Subject:', template.subject);

    // Verify email account value
    if (template.email_account === 'primary') {
      console.log('   ✅ Will send from: avensismodels.co.uk.crm.bookings@gmail.com');
    } else if (template.email_account === 'secondary') {
      console.log('   ✅ Will send from: camrymodels.co.uk.crm.bookings@gmail.com');
    } else {
      console.log('   ⚠️  Email account not set - will default to PRIMARY');
      console.log('      Will send from: avensismodels.co.uk.crm.bookings@gmail.com');
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log('\n✅ Template audit complete!\n');
  console.log('To test booking:');
  console.log('1. Go to Calendar page');
  console.log('2. Create a new booking');
  console.log('3. Select a template from the dropdown');
  console.log('4. Check server logs to verify correct email account is used\n');
}

testTemplates().catch(console.error);
