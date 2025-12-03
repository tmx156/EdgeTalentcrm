/**
 * Delete old Airtable records and resend leads with proper phone formatting
 */

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const SALESAPE_CONFIG = {
  AIRTABLE_URL: 'https://api.airtable.com/v0/appoT1TexUksGanE8/tblTJGg187Ub84aXf',
  PAT_CODE: process.env.SALESAPE_PAT_CODE || process.env.SALESAPE_PAT,
  BASE_DETAILS_ID: 'recThsoXqOHJCdgZY'
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

/**
 * Normalize UK phone number to international format
 */
function normalizePhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('+44')) return cleaned;
  if (cleaned.startsWith('44')) return '+' + cleaned;
  if (cleaned.startsWith('0')) return '+44' + cleaned.substring(1);
  if (cleaned.match(/^[789]/)) return '+44' + cleaned;
  return '+44' + cleaned;
}

async function resendFailedLeads() {
  console.log('========================================');
  console.log('  RESEND FAILED LEADS TO SALESAPE');
  console.log('========================================\n');

  const leadsToResend = [
    { name: 'Tinashe Mamire', oldRecordId: 'recAOpkrfUhR0UJwx', id: '76190922-9e3a-4e65-94da-f53b26e0d375' },
    { name: 'Alan Rutherford', oldRecordId: 'recJ9VqmK04ExMvvQ', id: '497a6103-0644-402a-9893-36923618c43e' }
  ];

  for (const leadInfo of leadsToResend) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing: ${leadInfo.name}`);
    console.log(`${'='.repeat(60)}`);

    try {
      // Step 1: Get full lead data from CRM
      console.log('📋 Step 1: Fetching lead from CRM...');
      const { data: lead, error: fetchError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadInfo.id)
        .single();

      if (fetchError || !lead) {
        console.error('   ❌ Error fetching lead:', fetchError?.message);
        continue;
      }

      console.log(`   ✅ Lead found: ${lead.name}`);
      console.log(`      Phone (original): ${lead.phone}`);

      // Step 2: Format phone number
      const formattedPhone = normalizePhoneNumber(lead.phone);
      console.log(`      Phone (formatted): ${formattedPhone}`);

      // Step 3: Delete old Airtable record
      console.log('\n🗑️  Step 2: Deleting old Airtable record...');
      try {
        await axios.delete(
          `${SALESAPE_CONFIG.AIRTABLE_URL}/${leadInfo.oldRecordId}`,
          {
            headers: {
              'Authorization': `Bearer ${SALESAPE_CONFIG.PAT_CODE}`
            }
          }
        );
        console.log('   ✅ Old record deleted');
      } catch (deleteError) {
        console.log('   ⚠️  Could not delete old record:', deleteError.response?.status);
      }

      // Step 4: Create new record with proper formatting
      console.log('\n📤 Step 3: Sending new record to SalesApe...');
      const payload = {
        fields: {
          "First Name": lead.name?.split(' ')[0] || '',
          "Last Name": lead.name?.split(' ').slice(1).join(' ') || '',
          "Email": lead.email || '',
          "Phone Number": formattedPhone,
          "CRM ID": String(lead.id),
          "Context": lead.notes || `Lead from CRM`,
          "Base Details": [SALESAPE_CONFIG.BASE_DETAILS_ID]
        }
      };

      console.log('   📋 Payload:', JSON.stringify(payload, null, 2));

      const response = await axios.post(SALESAPE_CONFIG.AIRTABLE_URL, payload, {
        headers: {
          'Authorization': `Bearer ${SALESAPE_CONFIG.PAT_CODE}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('   ✅ New record created:', response.data.id);

      // Step 5: Update CRM with new record ID
      console.log('\n💾 Step 4: Updating CRM database...');
      const { error: updateError } = await supabase
        .from('leads')
        .update({
          salesape_record_id: response.data.id,
          salesape_sent_at: new Date().toISOString(),
          salesape_status: 'sent',
          salesape_initial_message_sent: false,
          salesape_user_engaged: false,
          salesape_goal_hit: false
        })
        .eq('id', lead.id);

      if (updateError) {
        console.error('   ❌ Error updating CRM:', updateError.message);
      } else {
        console.log('   ✅ CRM updated with new record ID');
      }

      console.log('\n✅ COMPLETE: Lead resent successfully!');
      console.log('   ⏳ SalesApe should process within a few minutes...');

      // Wait between leads to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`\n❌ Error processing ${leadInfo.name}:`, error.message);
      if (error.response?.data) {
        console.error('   Response:', JSON.stringify(error.response.data, null, 2));
      }
    }
  }

  console.log('\n========================================');
  console.log('RESEND COMPLETE');
  console.log('========================================');
  console.log('Monitor the leads in the next 5-10 minutes.');
  console.log('They should start receiving messages from SalesApe.');
}

resendFailedLeads();
