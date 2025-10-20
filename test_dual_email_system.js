/**
 * Test Script: Dual Email Account System
 *
 * This script tests:
 * 1. Template fetching from API
 * 2. Email account configuration
 * 3. Template email_account field
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://tnltvfzltdeilanxhlvy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubHR2ZnpsdGRlaWxhbnhobHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTk4MzUsImV4cCI6MjA3Mjc3NTgzNX0.T_HaALQeSiCjLkpVuwQZUFnJbuSyRy2wf2kWiqJ99Lc';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\n' + '='.repeat(80));
console.log('🧪 DUAL EMAIL ACCOUNT SYSTEM TEST');
console.log('='.repeat(80) + '\n');

async function runTests() {
  try {
    // Test 1: Check environment variables
    console.log('📋 Test 1: Email Account Configuration');
    console.log('-'.repeat(80));
    console.log('Primary Account (EMAIL_USER):', process.env.EMAIL_USER ? '✅ Set' : '❌ NOT SET');
    console.log('Primary Password (EMAIL_PASSWORD):', process.env.EMAIL_PASSWORD ? '✅ Set' : '❌ NOT SET');
    console.log('Secondary Account (EMAIL_USER_2):', process.env.EMAIL_USER_2 ? '✅ Set' : '❌ NOT SET');
    console.log('Secondary Password (EMAIL_PASSWORD_2):', process.env.EMAIL_PASSWORD_2 ? '✅ Set' : '❌ NOT SET');

    if (process.env.EMAIL_USER) {
      console.log('  Primary Email:', process.env.EMAIL_USER);
    }
    if (process.env.EMAIL_USER_2) {
      console.log('  Secondary Email:', process.env.EMAIL_USER_2);
    }
    console.log('');

    // Test 2: Fetch all templates
    console.log('📋 Test 2: Fetch All Templates from Database');
    console.log('-'.repeat(80));
    const { data: allTemplates, error: allError } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (allError) {
      console.error('❌ Error fetching templates:', allError);
    } else {
      console.log(`✅ Total templates in database: ${allTemplates.length}`);

      if (allTemplates.length > 0) {
        console.log('\nTemplate breakdown:');
        const byType = {};
        const byStatus = { active: 0, inactive: 0 };
        const byEmailAccount = { primary: 0, secondary: 0, undefined: 0 };

        allTemplates.forEach(t => {
          byType[t.type] = (byType[t.type] || 0) + 1;
          if (t.is_active) byStatus.active++;
          else byStatus.inactive++;

          if (t.email_account === 'secondary') byEmailAccount.secondary++;
          else if (t.email_account === 'primary') byEmailAccount.primary++;
          else byEmailAccount.undefined++;
        });

        console.log('  By Type:', byType);
        console.log('  By Status:', byStatus);
        console.log('  By Email Account:', byEmailAccount);
      }
    }
    console.log('');

    // Test 3: Fetch booking confirmation templates (active only)
    console.log('📋 Test 3: Fetch Active Booking Confirmation Templates');
    console.log('-'.repeat(80));
    const { data: bookingTemplates, error: bookingError } = await supabase
      .from('templates')
      .select('*')
      .eq('type', 'booking_confirmation')
      .eq('is_active', true);

    if (bookingError) {
      console.error('❌ Error fetching booking templates:', bookingError);
    } else {
      console.log(`✅ Active booking confirmation templates: ${bookingTemplates.length}`);

      if (bookingTemplates.length === 0) {
        console.log('⚠️  WARNING: No active booking confirmation templates found!');
        console.log('   The Calendar page will show a warning message.');
        console.log('   Please create at least one active booking_confirmation template.');
      } else {
        console.log('\nBooking Confirmation Templates:');
        bookingTemplates.forEach((t, idx) => {
          console.log(`\n  ${idx + 1}. ${t.name}`);
          console.log(`     ID: ${t.id}`);
          console.log(`     Type: ${t.type}`);
          console.log(`     Active: ${t.is_active ? '✅ Yes' : '❌ No'}`);
          console.log(`     Email Account: ${t.email_account || 'primary (default)'} ${t.email_account === 'secondary' ? '(Camry)' : '(Avensis)'}`);
          console.log(`     Send Email: ${t.send_email ? '✅' : '❌'}`);
          console.log(`     Send SMS: ${t.send_sms ? '✅' : '❌'}`);
          console.log(`     Created: ${new Date(t.created_at).toLocaleDateString()}`);
        });
      }
    }
    console.log('');

    // Test 4: Check if email service can access both accounts
    console.log('📋 Test 4: Email Service Configuration');
    console.log('-'.repeat(80));
    const emailService = require('./server/utils/emailService');
    console.log('Email Accounts Configuration:');
    console.log('  Primary Account:');
    console.log('    User:', emailService.EMAIL_ACCOUNTS?.primary?.user || 'NOT SET');
    console.log('    Password:', emailService.EMAIL_ACCOUNTS?.primary?.pass ? '✅ Set' : '❌ NOT SET');
    console.log('  Secondary Account:');
    console.log('    User:', emailService.EMAIL_ACCOUNTS?.secondary?.user || 'NOT SET');
    console.log('    Password:', emailService.EMAIL_ACCOUNTS?.secondary?.pass ? '✅ Set' : '❌ NOT SET');
    console.log('');

    // Summary
    console.log('='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));

    const results = [];

    // Check 1: Email accounts configured
    if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      results.push('✅ Primary email account configured');
    } else {
      results.push('❌ Primary email account NOT configured');
    }

    if (process.env.EMAIL_USER_2 && process.env.EMAIL_PASSWORD_2) {
      results.push('✅ Secondary email account configured');
    } else {
      results.push('❌ Secondary email account NOT configured');
    }

    // Check 2: Templates exist
    if (bookingTemplates && bookingTemplates.length > 0) {
      results.push(`✅ ${bookingTemplates.length} active booking confirmation template(s) found`);
    } else {
      results.push('❌ No active booking confirmation templates found');
    }

    // Check 3: Email service accessible
    if (emailService.EMAIL_ACCOUNTS) {
      results.push('✅ Email service configuration accessible');
    } else {
      results.push('❌ Email service configuration NOT accessible');
    }

    results.forEach(r => console.log(r));
    console.log('');

    // Recommendations
    console.log('💡 RECOMMENDATIONS');
    console.log('-'.repeat(80));
    if (!bookingTemplates || bookingTemplates.length === 0) {
      console.log('⚠️  Create at least one active booking confirmation template:');
      console.log('   1. Go to Templates page');
      console.log('   2. Click "Create Template"');
      console.log('   3. Set Type = "booking_confirmation"');
      console.log('   4. Toggle Active = ON');
      console.log('   5. Select Email Account (Primary or Secondary)');
      console.log('   6. Save');
    } else {
      console.log('✅ System is ready to use!');
      console.log('   - Templates will appear in Calendar booking modals');
      console.log('   - Each template will show which email account it uses');
      console.log('   - Emails will be sent from the correct account');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }

  console.log('\n' + '='.repeat(80));
  console.log('🏁 TEST COMPLETE');
  console.log('='.repeat(80) + '\n');
}

runTests();
