/**
 * COMPREHENSIVE EMAIL FIX SCRIPT
 * Fixes duplicates, corrupted content, and prevents future issues
 */

require('dotenv').config();
const { createClient } = require('./server/node_modules/@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnltvfzltdeilanxhlvy.supabase.co';
const SUPABASE_KEY
