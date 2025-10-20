/**
 * FIX DUPLICATE AND CORRUPTED EMAILS
 *
 * This script will:
 * 1. Find and delete duplicate messages (keeping the first one)
 * 2. Fix corrupted/encoded email content
 * 3. Add unique constraint to prevent future duplicates
 * 4. Re-extract content for "No content available" messages
 */

require('dotenv').config();

const { createClient } = require('./server/node_modules/@supabase/supabase-js');
const { simpleParser } = require('./server/node_modules/mailparser');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnltvfzltdeilanxhlvy.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubHR2ZnpsdGRlaWxhbnhobHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc