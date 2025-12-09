/**
 * Bulk Block Monday-Thursday Calendar Dates
 * Blocks all Mon-Thu dates for 2 years to enforce Friday/Saturday/Sunday only operation
 * Special exception: Also blocks Friday January 9, 2026 (first weekend is Sat 10 + Sun 11 only)
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

// Initialize Supabase client with service role key
const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey
);

/**
 * Generate all Monday-Thursday dates within a date range
 * @param {Date} startDate - Starting date
 * @param {number} years - Number of years to generate
 * @returns {string[]} Array of YYYY-MM-DD date strings
 */
function generateMondayToThursdayDates(startDate, years = 2) {
  const dates = [];
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + years);

  let current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();

    // 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday
    if (dayOfWeek >= 1 && dayOfWeek <= 4) {
      dates.push(current.toISOString().split('T')[0]); // YYYY-MM-DD format
    }

    // Move to next day
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Main bulk blocking function
 */
async function bulkBlockWeekdays() {
  console.log('\n🚀 Bulk Blocking Monday-Thursday Dates');
  console.log('='.repeat(80));

  try {
    // Configuration
    const START_DATE = new Date('2025-12-09'); // Today
    const YEARS_AHEAD = 2;
    const BATCH_SIZE = 500;
    const REASON = 'Weekday - Monday-Thursday blocked';
    const SPECIAL_BLOCKS = ['2026-01-09']; // Friday Jan 9, 2026 (first weekend exception)

    // Step 1: Generate all Monday-Thursday dates
    console.log(`\n📅 Generating Monday-Thursday dates...`);
    console.log(`   Start: ${START_DATE.toISOString().split('T')[0]}`);
    console.log(`   End:   ${new Date(START_DATE.getFullYear() + YEARS_AHEAD, START_DATE.getMonth(), START_DATE.getDate()).toISOString().split('T')[0]}`);

    const mondayToThursdayDates = generateMondayToThursdayDates(START_DATE, YEARS_AHEAD);

    // Add special exception dates (Friday Jan 9, 2026)
    const allDatesToBlock = [...mondayToThursdayDates, ...SPECIAL_BLOCKS];

    console.log(`\n📊 Generated ${mondayToThursdayDates.length} Monday-Thursday dates`);
    console.log(`   Special additions: ${SPECIAL_BLOCKS.join(', ')}`);
    console.log(`   Total dates to block: ${allDatesToBlock.length}`);

    // Step 2: Check for existing blocks to avoid duplicates
    console.log(`\n🔍 Checking for existing blocks...`);

    const { data: existingBlocks, error: fetchError } = await supabase
      .from('blocked_slots')
      .select('date')
      .in('date', allDatesToBlock)
      .is('time_slot', null)
      .is('slot_number', null);

    if (fetchError) throw fetchError;

    const existingDates = new Set((existingBlocks || []).map(b => b.date));
    const newDatesToBlock = allDatesToBlock.filter(d => !existingDates.has(d));

    console.log(`   Found ${existingDates.size} existing blocks`);
    console.log(`   New blocks to insert: ${newDatesToBlock.length}`);

    if (newDatesToBlock.length === 0) {
      console.log('\n✅ All dates already blocked! Nothing to do.\n');
      return;
    }

    // Step 3: Batch insert new blocks
    console.log(`\n📝 Inserting in batches of ${BATCH_SIZE}...`);

    let totalInserted = 0;

    for (let i = 0; i < newDatesToBlock.length; i += BATCH_SIZE) {
      const batch = newDatesToBlock.slice(i, i + BATCH_SIZE);

      // Transform dates into blocked_slots records
      const records = batch.map(date => ({
        date,
        time_slot: null,  // Full day block
        slot_number: null, // Both slots blocked
        reason: SPECIAL_BLOCKS.includes(date)
          ? 'Special closure - First weekend (Sat 10 + Sun 11 only)'
          : REASON,
        created_by: null  // System-generated
      }));

      const { error: insertError } = await supabase
        .from('blocked_slots')
        .insert(records);

      if (insertError) {
        console.error(`\n❌ Error inserting batch at position ${i}:`, insertError);
        throw insertError;
      }

      totalInserted += batch.length;
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      console.log(`   ✅ Batch ${batchNumber}: Inserted ${batch.length} records (Total: ${totalInserted}/${newDatesToBlock.length})`);
    }

    console.log(`\n✅ Successfully inserted ${totalInserted} blocked slots!`);

    // Step 4: Verification
    console.log(`\n🔍 Verifying insertion...`);

    const { count: totalBlockedCount, error: countError } = await supabase
      .from('blocked_slots')
      .select('*', { count: 'exact', head: true })
      .is('time_slot', null)
      .is('slot_number', null);

    if (countError) throw countError;

    console.log(`   Total full-day blocks in database: ${totalBlockedCount}`);

    // Verify special date (Friday Jan 9, 2026)
    const { data: jan9Block, error: jan9Error } = await supabase
      .from('blocked_slots')
      .select('*')
      .eq('date', '2026-01-09')
      .is('time_slot', null)
      .is('slot_number', null)
      .single();

    if (jan9Error && jan9Error.code !== 'PGRST116') {
      console.warn(`   ⚠️  Could not verify Friday Jan 9, 2026: ${jan9Error.message}`);
    } else if (jan9Block) {
      console.log(`   ✅ Verified: Friday January 9, 2026 is blocked`);
    }

    // Sample check for January 2026
    const { data: jan2026Sample, error: sampleError } = await supabase
      .from('blocked_slots')
      .select('date')
      .gte('date', '2026-01-01')
      .lte('date', '2026-01-31')
      .is('time_slot', null)
      .order('date');

    if (!sampleError && jan2026Sample) {
      console.log(`\n📅 January 2026 blocked dates sample:`);
      const sample = jan2026Sample.slice(0, 10);
      sample.forEach(b => {
        const d = new Date(b.date + 'T00:00:00');
        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
        console.log(`      ${b.date} (${dayName})`);
      });
      if (jan2026Sample.length > 10) {
        console.log(`      ... and ${jan2026Sample.length - 10} more dates`);
      }
    }

    // Final summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('🎉 COMPLETE\n');
    console.log('Summary:');
    console.log(`   📊 Total dates generated: ${allDatesToBlock.length}`);
    console.log(`   ➕ New blocks inserted: ${totalInserted}`);
    console.log(`   💾 Total blocks in DB: ${totalBlockedCount}`);
    console.log(`   📅 Date range: ${START_DATE.toISOString().split('T')[0]} to ${new Date(START_DATE.getFullYear() + YEARS_AHEAD, START_DATE.getMonth(), START_DATE.getDate()).toISOString().split('T')[0]}`);
    console.log(`\n✅ Calendar now operates Friday/Saturday/Sunday only!`);
    console.log(`   (Exception: Friday Jan 9, 2026 is blocked)\n`);

  } catch (error) {
    console.error('\n❌ Bulk blocking failed:', error);
    console.error('Details:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  const startTime = Date.now();

  bulkBlockWeekdays()
    .then(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`⏱️  Completed in ${elapsed}s\n`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Bulk blocking failed:', error);
      process.exit(1);
    });
}

module.exports = { bulkBlockWeekdays };
