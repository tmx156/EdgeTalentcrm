# Supabase Database Setup Guide

This guide will help you set up your new Supabase database for the CRM system.

## Prerequisites

- A Supabase account (sign up at [supabase.com](https://supabase.com))
- A new Supabase project created

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for the project to be fully provisioned

## Step 2: Run the Schema SQL

1. In your Supabase project dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `supabase-schema.sql`
4. Paste it into the SQL editor
5. Click **Run** (or press Ctrl+Enter)

The schema will create:
- ✅ `users` table - System users (admins, bookers, closers)
- ✅ `leads` table - CRM leads with status tracking
- ✅ `sales` table - Sales transactions
- ✅ `templates` table - Email/SMS templates
- ✅ `messages` table - Message history
- ✅ All indexes for performance
- ✅ Foreign key relationships
- ✅ Row Level Security (RLS) policies
- ✅ Auto-update triggers for `updated_at` timestamps

## Step 3: Get Your Supabase Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (your `SUPABASE_URL`)
   - **anon/public key** (your `SUPABASE_ANON_KEY`)
   - **service_role key** (your `SUPABASE_SERVICE_ROLE_KEY`)

## Step 4: Update Environment Variables

Update your `.env` file with the new Supabase credentials:

```env
# Supabase Configuration (NEW DATABASE)
SUPABASE_URL=your_new_supabase_project_url
SUPABASE_ANON_KEY=your_new_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_new_supabase_service_role_key

# JWT Secret (keep existing or generate new)
JWT_SECRET=your_jwt_secret_key

# Email Configuration (optional - keep existing if needed)
EMAIL_USER=your_email@domain.com
EMAIL_PASS=your_email_password

# SMS Configuration (optional - keep existing if needed)
BULKSMS_USERNAME=your_bulksms_username
BULKSMS_PASSWORD=your_bulksms_password
```

## Step 5: Verify the Schema

Run this query in Supabase SQL Editor to verify all tables were created:

```sql
SELECT 
    table_name,
    (SELECT COUNT(*) 
     FROM information_schema.columns 
     WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'leads', 'sales', 'templates', 'messages')
ORDER BY table_name;
```

You should see 5 tables with their column counts.

## Step 6: Create Your First Admin User

You can create your first admin user through the API or directly in Supabase:

### Option A: Via SQL (Direct Insert)
```sql
INSERT INTO users (name, email, password, role)
VALUES ('Admin User', 'admin@example.com', 'hashed_password_here', 'admin');
```

**Note:** Make sure to hash the password using bcrypt before inserting.

### Option B: Via API (Recommended)
Once your app is running with the new credentials, register through the app's registration endpoint.

## Database Schema Overview

### Tables

1. **users**
   - System users (admin, booker, closer, viewer roles)
   - Authentication and authorization

2. **leads**
   - Core CRM data (contacts, appointments, status)
   - Tracks booking history and conversions
   - Soft delete support (`deleted_at`)

3. **sales**
   - Sales transactions linked to leads
   - Payment tracking and status

4. **templates**
   - Email and SMS message templates
   - Supports variables and attachments

5. **messages**
   - Complete message history (email/SMS)
   - Links to leads, templates, and users

### Key Features

- **UUIDs** for all primary keys
- **Soft deletes** on leads table (`deleted_at`)
- **Timestamps** (created_at, updated_at) on all tables
- **Indexes** for optimal query performance
- **Foreign keys** with proper CASCADE rules
- **Row Level Security (RLS)** enabled
- **Auto-update triggers** for `updated_at` fields

### Important Columns

**Leads Table:**
- `date_booked` - When appointment is scheduled (future date)
- `booked_at` - When booking action was made (conversion tracking)
- `assigned_at` - When lead was assigned to booker
- `ever_booked` - Tracks if lead was ever booked (persists after cancellation)
- `booking_history` - JSON array of booking changes

**Messages Table:**
- `type` - 'email', 'sms', or 'both'
- `read` - Whether recipient read the message
- `sent_at` - Actual send timestamp

## Troubleshooting

### Schema Already Exists
If you get "relation already exists" errors, you can either:
1. Drop the existing tables first (⚠️ **WARNING: This deletes data**)
2. Use `CREATE TABLE IF NOT EXISTS` (already included in schema)

### RLS Policy Issues
If you have permission errors, check:
1. RLS is enabled but policies allow service role access
2. You're using the correct API key (service_role for admin operations)
3. Row Level Security policies in Supabase dashboard

### Foreign Key Errors
All foreign keys are set up with appropriate CASCADE/SET NULL rules:
- Leads → Users: SET NULL on delete
- Sales → Leads: CASCADE on delete
- Messages → Leads: CASCADE on delete

## Next Steps

1. ✅ Run the schema SQL
2. ✅ Update environment variables
3. ✅ Restart your application
4. ✅ Test database connectivity
5. ✅ Create first admin user
6. ✅ Verify tables are accessible

## Support

If you encounter any issues:
1. Check Supabase project logs
2. Verify credentials in `.env`
3. Check Row Level Security policies
4. Review table relationships and constraints

---

**Schema Version:** 1.0  
**Created:** For new Supabase database setup  
**Compatible with:** Current CRM application

