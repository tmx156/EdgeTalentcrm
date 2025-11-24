/**
 * Migration Script: Assign booking slots to existing bookings
 * 
 * This script migrates existing bookings to the new slot-based system by:
 * 1. Adding the booking_slot column to the leads table
 * 2. Assigning existing bookings to slot 1 or 2 based on their time
 * 3. Ensuring time_booked is properly formatted
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateBookings() {
  console.log('🚀 Starting booking slot migration...\n');

  try {
    // Step 1: Fetch all bookings with date_booked
    console.log('📊 Fetching existing bookings...');
    const { data: bookings, error: fetchError } = await supabase
      .from('leads')
      .select('id, name, date_booked, time_booked, booking_slot, created_at')
      .not('date_booked', 'is', null)
      .is('deleted_at', null);

    if (fetchError) {
      throw new Error(`Failed to fetch bookings: ${fetchError.message}`);
    }

    console.log(`✅ Found ${bookings.length} bookings to process\n`);

    if (bookings.length === 0) {
      console.log('✨ No bookings to migrate. Exiting.');
      return;
    }

    // Step 2: Process each booking
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const booking of bookings) {
      try {
        // Skip if already has a booking_slot
        if (booking.booking_slot) {
          skipped++;
          continue;
        }

        // Determine slot based on time_booked or round-robin
        let slot = 1;
        
        if (booking.time_booked) {
          // Extract hour from time_booked (format: "HH:MM" or "HH:MM:SS")
          const timeParts = booking.time_booked.split(':');
          const hour = parseInt(timeParts[0]);
          
          // Even hours -> Slot 1, Odd hours -> Slot 2
          slot = hour % 2 === 0 ? 1 : 2;
        } else {
          // No time_booked, use round-robin based on created_at
          const createdDate = new Date(booking.created_at);
          slot = createdDate.getTime() % 2 === 0 ? 1 : 2;
        }

        // Ensure time_booked is properly formatted
        let timeBooked = booking.time_booked;
        if (!timeBooked && booking.date_booked) {
          // Extract time from date_booked if time_booked is missing
          const bookingDate = new Date(booking.date_booked);
          const hours = bookingDate.getHours().toString().padStart(2, '0');
          const minutes = bookingDate.getMinutes().toString().padStart(2, '0');
          timeBooked = `${hours}:${minutes}`;
        }

        // Update the booking
        const { error: updateError } = await supabase
          .from('leads')
          .update({
            booking_slot: slot,
            time_booked: timeBooked || '10:00' // Default to 10:00 if no time available
          })
          .eq('id', booking.id);

        if (updateError) {
          console.error(`❌ Error updating booking ${booking.id}:`, updateError.message);
          errors++;
        } else {
          updated++;
          console.log(`✅ Updated: ${booking.name} -> Slot ${slot} at ${timeBooked || '10:00'}`);
        }
      } catch (err) {
        console.error(`❌ Error processing booking ${booking.id}:`, err.message);
        errors++;
      }
    }

    // Step 3: Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total bookings found:     ${bookings.length}`);
    console.log(`Successfully updated:     ${updated}`);
    console.log(`Skipped (already set):    ${skipped}`);
    console.log(`Errors:                   ${errors}`);
    console.log('='.repeat(60));

    // Step 4: Verify migration
    console.log('\n🔍 Verifying migration...');
    const { data: verification, error: verifyError } = await supabase
      .from('leads')
      .select('booking_slot, count')
      .not('date_booked', 'is', null)
      .is('deleted_at', null);

    if (!verifyError) {
      const { data: slot1Count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('booking_slot', 1)
        .not('date_booked', 'is', null)
        .is('deleted_at', null);

      const { data: slot2Count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('booking_slot', 2)
        .not('date_booked', 'is', null)
        .is('deleted_at', null);

      console.log('\n📊 Slot Distribution:');
      console.log(`  Slot 1: ${slot1Count?.length || 0} bookings`);
      console.log(`  Slot 2: ${slot2Count?.length || 0} bookings`);
    }

    console.log('\n✨ Migration completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
migrateBookings()
  .then(() => {
    console.log('\n👋 Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  });

