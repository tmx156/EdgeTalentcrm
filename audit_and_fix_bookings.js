const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    console.log('🔍 AUDIT: Checking all bookings made today...\n');

    const today = new Date().toISOString().split('T')[0];
    console.log('📅 Today:', today);

    // Get all leads booked today
    const { data: bookings, error } = await supabase
      .from('leads')
      .select('*')
      .gte('booked_at', `${today}T00:00:00`)
      .lte('booked_at', `${today}T23:59:59`)
      .order('booked_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching bookings:', error);
      process.exit(1);
    }

    console.log(`\n📊 Found ${bookings.length} bookings made today:\n`);

    if (bookings.length === 0) {
      console.log('❌ NO BOOKINGS FOUND FOR TODAY');
      process.exit(0);
    }

    // Check and fix each booking
    for (const booking of bookings) {
      console.log(`\n${booking.name}:`);
      console.log(`  ID: ${booking.id}`);
      console.log(`  Status: ${booking.status}`);
      console.log(`  Booked At: ${booking.booked_at}`);
      console.log(`  Date Booked: ${booking.date_booked}`);
      console.log(`  Ever Booked: ${booking.ever_booked}`);
      console.log(`  Booker ID: ${booking.booker_id}`);

      // Fix if ever_booked is false but should be true
      if (booking.status === 'Booked' && !booking.ever_booked) {
        console.log('  ⚠️ ISSUE: ever_booked is FALSE but status is Booked');
        console.log('  🔧 Fixing...');

        const { data: updated, error: updateError } = await supabase
          .from('leads')
          .update({ ever_booked: true })
          .eq('id', booking.id)
          .select()
          .single();

        if (updateError) {
          console.log('  ❌ Failed to fix:', updateError.message);
        } else {
          console.log('  ✅ Fixed! ever_booked is now:', updated.ever_booked);
        }
      } else {
        console.log('  ✅ OK - ever_booked is correct');
      }
    }

    console.log('\n✅ Audit complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
})();
