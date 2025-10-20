const axios = require('axios');

(async () => {
  try {
    console.log('🧪 SIMULATING CHICKO BOOKING (without auth)\n');
    console.log('='.repeat(70));

    const chickoId = '74a8366d-971d-4df7-aee7-895a0e603f04';

    // Check current state before booking
    console.log('\n📊 BEFORE: Checking existing bookings from today...\n');

    const beforeResponse = await axios.get('http://localhost:5000/api/leads/public?limit=5000');
    const allLeadsBefore = beforeResponse.data.leads;
    const today = new Date().toISOString().split('T')[0];
    const todaysBookingsBefore = allLeadsBefore.filter(l =>
      l.booked_at && l.booked_at.startsWith(today)
    );

    console.log(`Found ${todaysBookingsBefore.length} bookings for ${today}`);
    todaysBookingsBefore.forEach((b, i) => {
      console.log(`${i + 1}. ${b.name} | ever_booked: ${b.ever_booked} | booker_id: ${b.booker_id}`);
    });

    // Simulate booking creation via Calendar/LeadDetail update
    console.log('\n📝 SIMULATING: Updating an existing lead to Booked status (like Calendar does)...\n');

    // Find a lead assigned to Chicko that's not booked yet
    const chickoLeads = allLeadsBefore.filter(l =>
      l.booker_id === chickoId &&
      l.status !== 'Booked' &&
      !l.booked_at
    );

    if (chickoLeads.length === 0) {
      console.log('❌ No unbooked leads found for Chicko to test with.');
      console.log('   Creating a new lead instead...\n');

      // Create a test lead
      const newLead = {
        name: 'TEST CHICKO ' + Date.now(),
        phone: '07700900000',
        email: 'testchicko@test.com',
        postcode: 'TEST1',
        status: 'New'
      };

      console.log('Creating new lead:', newLead.name);

      const createRes = await axios.post('http://localhost:5000/api/leads', newLead);
      const createdLead = createRes.data.lead || createRes.data;

      console.log('✅ Created lead ID:', createdLead.id);
      console.log('\nNow we need to book this lead via the UI...');
      console.log('\n⚠️ This test requires authentication to proceed further.');
      console.log('\nTo manually test:');
      console.log('1. Log in as Chicko (chicko@crm.com)');
      console.log('2. Open the Calendar');
      console.log('3. Book the lead:', newLead.name);
      console.log('4. Check if it appears in Daily Activities immediately\n');

      process.exit(0);
    }

    const testLead = chickoLeads[0];
    console.log('Found test lead:', testLead.name, '(ID:', testLead.id + ')');
    console.log('Current status:', testLead.status);
    console.log('Current booker_id:', testLead.booker_id);
    console.log('Current ever_booked:', testLead.ever_booked);

    console.log('\n⚠️ To complete this test, we need authentication.');
    console.log('\nMANUAL TEST STEPS:');
    console.log('1. Log in as Chicko');
    console.log(`2. Book the lead: ${testLead.name} (ID: ${testLead.id})`);
    console.log('3. Set date to: Tomorrow at 2:00 PM');
    console.log('4. Save the booking');
    console.log('5. Check Daily Activities - should appear immediately\n');

    console.log('After manual booking, run this to verify:');
    console.log(`node -e "const axios=require('axios'); axios.get('http://localhost:5000/api/leads/public?limit=5000').then(r=>{const lead=r.data.leads.find(l=>l.id==='${testLead.id}'); console.log('Status:',lead.status); console.log('ever_booked:',lead.ever_booked); console.log('booked_at:',lead.booked_at); console.log('Shows in Dashboard:',lead.ever_booked?'YES':'NO');});"`);

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    process.exit(1);
  }
})();
