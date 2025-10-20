const { query } = require('./server/config/database-pool');

(async () => {
  try {
    console.log('🔍 Checking all templates in database...\n');

    const result = await query('SELECT * FROM templates ORDER BY created_at DESC', []);
    const templates = result.rows;

    console.log(`📊 Found ${templates.length} templates:\n`);

    if (templates.length === 0) {
      console.log('❌ NO TEMPLATES FOUND IN DATABASE');
    } else {
      templates.forEach((t, idx) => {
        console.log(`${idx + 1}. ${t.name}`);
        console.log(`   ID: ${t.id}`);
        console.log(`   Type: ${t.type}`);
        console.log(`   Category: ${t.category}`);
        console.log(`   Active: ${t.is_active}`);
        console.log(`   User ID: ${t.user_id}`);
        console.log(`   Created: ${t.created_at}`);
        console.log('');
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
