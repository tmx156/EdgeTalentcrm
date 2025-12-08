const { createClient } = require('@supabase/supabase-js');
const config = require('./index');

/**
 * Singleton Supabase Client
 *
 * This ensures only ONE Supabase client instance is created and reused
 * across the entire application, preventing connection leaks and
 * database overload.
 *
 * IMPORTANT: Use this instead of calling createClient() directly!
 */

let supabaseInstance = null;

function getSupabaseClient() {
  if (!supabaseInstance) {
    const supabaseUrl = config.supabase.url;
    const supabaseKey = config.supabase.serviceRoleKey || config.supabase.anonKey;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and Service Role Key must be configured');
    }

    console.log('🔧 Initializing singleton Supabase client...');
    console.log(`   URL: ${supabaseUrl}`);
    console.log(`   Key: ${supabaseKey.substring(0, 20)}...`);

    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'x-application-name': 'edge-talent-crm'
        }
      }
    });

    console.log('✅ Singleton Supabase client initialized');
  }

  return supabaseInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
function resetSupabaseClient() {
  supabaseInstance = null;
}

module.exports = {
  getSupabaseClient,
  resetSupabaseClient
};
