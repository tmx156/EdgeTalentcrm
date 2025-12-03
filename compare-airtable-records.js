/**
 * Compare Airtable records in detail
 * Find what's different between Sandra (working) and others (not working)
 */

require('dotenv').config();
const axios = require('axios');

const SALESAPE_CONFIG = {
  AIRTABLE_URL: 'https://api.airtable.com/v0/appoT1TexUksGanE8/tblTJGg187Ub84aXf',
  PAT_CODE: process.env.SALESAPE_PAT_CODE || process.env.SALESAPE_PAT
};

async function compareRecords() {
  const records = [
    { name: 'Sandra Poon', id: 'recm2dNzUzXRSbcej', working: true },
    { name: 'Tinashe Mamire', id: 'recAOpkrfUhR0UJwx', working: false },
    { name: 'Alan Rutherford', id: 'recJ9VqmK04ExMvvQ', working: false }
  ];

  console.log('========================================');
  console.log('  DETAILED AIRTABLE COMPARISON');
  console.log('========================================\n');

  const allRecords = [];

  for (const record of records) {
    try {
      const response = await axios.get(
        `${SALESAPE_CONFIG.AIRTABLE_URL}/${record.id}`,
        {
          headers: {
            'Authorization': `Bearer ${SALESAPE_CONFIG.PAT_CODE}`
          }
        }
      );

      allRecords.push({
        name: record.name,
        working: record.working,
        fields: response.data.fields,
        createdTime: response.data.createdTime
      });

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error fetching ${record.name}:`, error.message);
    }
  }

  // Compare key fields
  const keyFields = [
    'First Name',
    'Last Name',
    'Phone Number',
    'Email',
    'CRM ID',
    'Context',
    'Base Details',
    'Go No Go',
    'Email + Phone + Country Code',
    'Django Agent ID',
    'Django Client ID',
    'Action Webhook',
    'Pipedream Endpoint',
    'WhatsApp URL',
    'Follow Up Flow',
    'Channels',
    'Country Code',
    'Is Recent',
    'Overloaded?',
    'Follow Up?',
    'Created',
    'Initial Message Sent Date'
  ];

  console.log('FIELD COMPARISON:');
  console.log('='.repeat(100));

  for (const field of keyFields) {
    const sandraValue = JSON.stringify(allRecords[0].fields[field]);
    const tinasheValue = JSON.stringify(allRecords[1].fields[field]);
    const alanValue = JSON.stringify(allRecords[2].fields[field]);

    const allSame = sandraValue === tinasheValue && sandraValue === alanValue;

    if (!allSame) {
      console.log(`\n⚠️  DIFFERENCE FOUND: ${field}`);
      console.log(`   Sandra (✅ working):  ${sandraValue}`);
      console.log(`   Tinashe (❌ not working): ${tinasheValue}`);
      console.log(`   Alan (❌ not working):    ${alanValue}`);
    }
  }

  console.log('\n\n========================================');
  console.log('FULL RECORD DETAILS');
  console.log('========================================\n');

  for (const record of allRecords) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${record.name} - ${record.working ? '✅ WORKING' : '❌ NOT WORKING'}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Created: ${record.createdTime}`);
    console.log(`\nKey Automation Fields:`);
    console.log(`   - Django Agent ID: ${record.fields['Django Agent ID']}`);
    console.log(`   - Django Client ID: ${record.fields['Django Client ID']}`);
    console.log(`   - Action Webhook: ${record.fields['Action Webhook']}`);
    console.log(`   - Pipedream Endpoint: ${record.fields['Pipedream Endpoint']}`);
    console.log(`   - WhatsApp URL: ${record.fields['WhatsApp URL']}`);
    console.log(`   - Follow Up Flow: ${record.fields['Follow Up Flow']}`);
    console.log(`   - Is Recent: ${record.fields['Is Recent']}`);
    console.log(`   - Overloaded?: ${record.fields['Overloaded?']}`);
    console.log(`   - Initial Message Sent Date: ${record.fields['Initial Message Sent Date']}`);
  }

  console.log('\n\n========================================');
  console.log('DIAGNOSIS');
  console.log('========================================');

  const workingRecord = allRecords[0];
  const notWorkingRecords = allRecords.slice(1);

  console.log('\n🔍 Looking for what prevents automation...\n');

  // Check if all have same automation endpoints
  const allHaveSameEndpoints = notWorkingRecords.every(record =>
    JSON.stringify(record.fields['Action Webhook']) === JSON.stringify(workingRecord.fields['Action Webhook'])
  );

  if (!allHaveSameEndpoints) {
    console.log('❌ Problem: Records have different Action Webhooks!');
  }

  // Check if all have Django IDs
  const allHaveDjangoIDs = notWorkingRecords.every(record =>
    record.fields['Django Agent ID'] && record.fields['Django Client ID']
  );

  if (!allHaveDjangoIDs) {
    console.log('❌ Problem: Some records missing Django Agent/Client IDs!');
  } else {
    console.log('✅ All records have Django IDs');
  }

  // Check time difference
  const sandraCreated = new Date(workingRecord.createdTime);
  for (const record of notWorkingRecords) {
    const recordCreated = new Date(record.createdTime);
    const diffMinutes = (recordCreated - sandraCreated) / 1000 / 60;
    console.log(`⏰ ${record.name} created ${diffMinutes.toFixed(1)} minutes after Sandra`);
  }
}

compareRecords();
