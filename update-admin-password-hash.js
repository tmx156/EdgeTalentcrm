/**
 * Update Admin User Password Hash
 * Ensures the admin user has password_hash set for proper authentication
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const config = require('./server/config');

async function updateAdminPasswordHash() {
  console.log('🔐 Updating Admin User Password Hash...\n');
  
  const supabaseUrl = config.supabase.url;
  const supabaseServiceKey = config.supabase.serviceRoleKey || config.supabase.anonKey;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const adminEmail = 'admin@crm.com';
  const adminPassword = 'admin123';
  
  try {
    // Find admin user (only select columns that exist)
    const { data: users, error: findError } = await supabase
      .from('users')
      .select('id, email, password')
      .eq('email', adminEmail.toLowerCase())
      .eq('role', 'admin');
    
    if (findError) {
      console.error('❌ ERROR finding user:', findError.message);
      process.exit(1);
    }
    
    if (!users || users.length === 0) {
      console.error('❌ Admin user not found!');
      process.exit(1);
    }
    
    const adminUser = users[0];
    console.log('👤 Found admin user:', adminUser.id);
    
    // Hash password (use existing if already hashed, otherwise hash the plain password)
    let hashedPassword;
    if (adminUser.password && adminUser.password.startsWith('$2')) {
      // Already bcrypt hashed
      hashedPassword = adminUser.password;
    } else {
      // Hash the plain password
      hashedPassword = await bcrypt.hash(adminPassword, 10);
    }
    
    // First, try to update with password_hash (column might not exist yet)
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: hashedPassword,
        password: hashedPassword, // Also update password column for compatibility
        updated_at: new Date().toISOString()
      })
      .eq('id', adminUser.id)
      .select();
    
    if (updateError) {
      if (updateError.message.includes('password_hash') || updateError.message.includes('column')) {
        console.log('\n⚠️  password_hash column does not exist yet!');
        console.log('💡 Please run this SQL in Supabase SQL Editor first:');
        console.log('   ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;');
        console.log('\n📄 Or run the SQL file: add-password-hash-column.sql');
        console.log('\n🔧 For now, updating password column only...');
        
        // Try with just password column
        const { data: fallbackUser, error: fallbackError } = await supabase
          .from('users')
          .update({
            password: hashedPassword,
            updated_at: new Date().toISOString()
          })
          .eq('id', adminUser.id)
          .select();
        
        if (fallbackError) {
          console.error('❌ ERROR updating password:', fallbackError.message);
          process.exit(1);
        }
        
        console.log('✅ Admin user password updated (password column)!');
        console.log('⚠️  Note: You still need to add password_hash column for full compatibility.');
        console.log('\n📋 Updated User:');
        console.log(`   ID: ${fallbackUser[0].id}`);
        console.log(`   Email: ${fallbackUser[0].email}`);
        console.log(`   Has password: ${!!fallbackUser[0].password}`);
        console.log('\n✅ You can now login with these credentials:');
        console.log(`   Email: ${adminEmail}`);
        console.log(`   Password: ${adminPassword}`);
        process.exit(0);
      } else {
        console.error('❌ ERROR updating password_hash:', updateError.message);
        process.exit(1);
      }
    }
    
    console.log('✅ Admin user password_hash updated successfully!');
    console.log('\n📋 Updated User:');
    console.log(`   ID: ${updatedUser[0].id}`);
    console.log(`   Email: ${updatedUser[0].email}`);
    console.log(`   Has password_hash: ${!!updatedUser[0].password_hash}`);
    console.log('\n✅ You can now login with these credentials:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    process.exit(1);
  }
}

updateAdminPasswordHash();

