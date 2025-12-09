#!/usr/bin/env node

/**
 * Check if gender column exists in the database
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('./server/config');

const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey || config.supabase.anonKey
);

async function checkGenderColumn() {
  console.log('🔍 Checking if gender column exists...\n');
  
  try {
    // Try to query the gender column directly
    const { data, error } = await supabase
      .from('leads')
      .select('gender')
      .limit(1);
    
    if (error) {
      if (error.message && error.message.includes('gender')) {
        console.error('❌ Gender column does NOT exist in the database!');
        console.error('   Error:', error.message);
        console.error('\n📋 Please run the migration:');
        console.error('   server/migrations/add_gender_column.sql');
        process.exit(1);
      } else {
        console.error('❌ Error:', error.message);
        process.exit(1);
      }
    } else {
      console.log('✅ Gender column EXISTS in the database!');
      console.log('   Sample data:', data);
      console.log('\n✅ The column is ready to use.');
    }
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

checkGenderColumn();

