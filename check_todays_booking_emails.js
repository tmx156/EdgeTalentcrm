require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

(async () => {
  try {
    // UK timezone - get today's date
    const ukTz = 'Europe/London';
    const now = new Date();
    const todayUK = now.toISOString().split('T')[0];

    console.log('🔍 Checking bookings and email confirmations for UK date:', todayUK);
    console.log('');

    // Get ALL leads booked today (using booked_at timestamp)
    const { data: bookings, error: bookingsError } = await supabase
      .from('leads')
      .select('*')
      .gte('booked_at', `${todayUK}T00:00:00`)
      .lt('booked_at', `${todayUK}T23:59:59`)
      .order('booked_at', { ascending: false });

    if (bookingsError) {
      console.error('❌ Error fetching bookings:', bookingsError);
      process.exit(1);
    }

    console.log(`\n📊 Found ${bookings ? bookings.length : 0} bookings made TODAY (${todayUK}):\n`);

    if (!bookings || bookings.length === 0) {
      console.log('❌ NO BOOKINGS FOUND FOR TODAY');
      process.exit(0);
    }

    // For each booking, check for booking confirmation emails
    for (let idx = 0; idx < bookings.length; idx++) {
      const booking = bookings[idx];
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`\n${idx + 1}. 📋 BOOKING: ${booking.name}`);
      console.log(`   Email: ${booking.email}`);
      console.log(`   Status: ${booking.status}`);
      console.log(`   Ever Booked: ${booking.ever_booked}`);
      console.log(`   Booker ID: ${booking.booker_id}`);
      console.log(`   Date Booked: ${booking.date_booked}`);
      console.log(`   Booked At: ${booking.booked_at}`);
      console.log(`   Created: ${booking.created_at}`);
      console.log(`   Updated: ${booking.updated_at}`);

      // Get booking confirmation emails for this lead
      const { data: emails, error: emailsError } = await supabase
        .from('messages')
        .select('*')
        .eq('lead_id', booking.id)
        .in('type', ['email', 'both'])
        .gte('sent_at', `${todayUK}T00:00:00`)
        .lt('sent_at', `${todayUK}T23:59:59`)
        .order('sent_at', { ascending: false });

      if (emailsError) {
        console.log(`\n   ⚠️  Error fetching emails: ${emailsError.message}`);
        continue;
      }

      if (emails.length === 0) {
        console.log(`\n   ⚠️  NO BOOKING CONFIRMATION EMAIL FOUND FOR THIS BOOKING`);
      } else {
        console.log(`\n   📧 EMAIL CONFIRMATIONS SENT (${emails.length}):`);
        
        for (let emailIdx = 0; emailIdx < emails.length; emailIdx++) {
          const email = emails[emailIdx];
          
          console.log(`\n   ${emailIdx + 1}. Email ID: ${email.id}`);
          console.log(`      Type: ${email.type}`);
          console.log(`      Status: ${email.status}`);
          console.log(`      Email Status: ${email.email_status || 'N/A'}`);
          console.log(`      Subject: ${email.subject || 'N/A'}`);
          console.log(`      Recipient: ${email.recipient_email || 'N/A'}`);
          console.log(`      Sent By: ${email.sent_by_name || 'System'} (ID: ${email.sent_by || 'N/A'})`);
          console.log(`      Sent At: ${email.sent_at}`);
          console.log(`      Created At: ${email.created_at}`);
          
          // Check if we can determine which email account was used
          // This would be in the booking_history if available
          const { data: historyData, error: historyError } = await supabase
            .from('booking_history')
            .select('*')
            .eq('lead_id', booking.id)
            .eq('action', 'BOOKING_CONFIRMATION_SENT')
            .gte('created_at', `${todayUK}T00:00:00`)
            .lt('created_at', `${todayUK}T23:59:59`)
            .order('created_at', { ascending: false });
          
          if (!historyError && historyData && historyData.length > 0) {
            console.log(`\n      📋 Booking History:`);
            historyData.forEach((history, hIdx) => {
              console.log(`\n      ${hIdx + 1}. Action: ${history.action}`);
              console.log(`         Time: ${history.created_at}`);
              if (history.details) {
                try {
                  const details = typeof history.details === 'string' 
                    ? JSON.parse(history.details) 
                    : history.details;
                  console.log(`         Details:`, JSON.stringify(details, null, 10));
                } catch (e) {
                  console.log(`         Details: ${history.details}`);
                }
              }
            });
          }
        }
      }
    }

    console.log(`\n${'='.repeat(80)}\n`);
    console.log('📧 EMAIL SERVICE INFO:');
    console.log('   System uses: Gmail SMTP via nodemailer');
    console.log('   Primary Account: process.env.EMAIL_USER (Avensis Models)');
    console.log('   Secondary Account: process.env.EMAIL_USER_2 (Camry Models)');
    console.log('   SMTP Host: smtp.gmail.com');
    console.log('   SMTP Ports: 465 (SSL) or 587 (STARTTLS)');
    console.log('');
    console.log('💡 Note: The system does NOT use Mailgun, SendGrid, or Resend.');
    console.log('   It uses standard Gmail SMTP with nodemailer library.');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();

