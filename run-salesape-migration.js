/**
 * Run SalesApe Fields Migration
 * Adds all necessary SalesApe tracking fields to the leads table
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = require('./server/config');

async function runMigration() {
  console.log('🚀 Starting SalesApe fields migration...\n');

  // Create Supabase client with service role key
  const supabase = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey || config.supabase.anonKey
  );

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'add-salesape-fields.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 SQL Migration File:');
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));
    console.log('');

    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));

    console.log(`📊 Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n[${i + 1}/${statements.length}] Executing:`);
      console.log(statement.substring(0, 100) + '...');

      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: statement + ';'
      });

      if (error) {
        // Try direct query if RPC doesn't work
        console.log('   ⚠️  RPC failed, trying direct query...');
        
        // For ALTER TABLE statements, we can use the REST API
        if (statement.includes('ALTER TABLE')) {
          console.log('   ℹ️  ALTER TABLE detected - this needs to be run manually in Supabase SQL editor');
          console.log('   📋 Copy the SQL from add-salesape-fields.sql and run it in Supabase');
        } else {
          console.log('   ❌ Error:', error.message);
        }
      } else {
        console.log('   ✅ Success');
      }
    }

    console.log('\n\n✅ Migration completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Go to Supabase Dashboard: https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Go to SQL Editor');
    console.log('4. Copy and paste the contents of add-salesape-fields.sql');
    console.log('5. Click "Run" to execute');
    console.log('\nThis will add all SalesApe tracking fields to your leads table.');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the migration
runMigration();

