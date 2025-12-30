/**
 * Backup all templates from database to JSON file
 * Run this BEFORE making any template changes
 */

const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Add server/node_modules to module paths
module.paths.push(path.join(__dirname, 'server', 'node_modules'));

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function backupTemplates() {
  console.log('═'.repeat(70));
  console.log('📦 Templates Backup Script');
  console.log('═'.repeat(70));
  console.log('');

  try {
    // Fetch ALL templates from database
    const { data: templates, error } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching templates:', error);
      process.exit(1);
    }

    console.log(`✅ Found ${templates.length} templates in database`);
    console.log('');

    // Create backup object with metadata
    const backup = {
      backup_date: new Date().toISOString(),
      total_templates: templates.length,
      templates: templates
    };

    // Ensure .claude directory exists
    const claudeDir = path.join(__dirname, '.claude');
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }

    // Write backup file
    const backupPath = path.join(claudeDir, 'templates_backup.json');
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

    console.log(`✅ Backup saved to: ${backupPath}`);
    console.log('');

    // Summary by type
    const typeCount = {};
    templates.forEach(t => {
      typeCount[t.type] = (typeCount[t.type] || 0) + 1;
    });

    console.log('📊 Templates by type:');
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}`);
    });

    console.log('');
    console.log('✅ Backup complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

backupTemplates();
