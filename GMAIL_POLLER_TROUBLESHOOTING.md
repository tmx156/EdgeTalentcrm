# Gmail Poller Troubleshooting Guide

## 🚨 Your Test Email Didn't Come Through?

Here are the most common reasons and solutions:

---

## 🔴 #1: Refresh Token Expired (MOST COMMON)

**Symptoms:**
- Emails were working before, but stopped suddenly
- No new emails appearing in Dashboard
- Server logs show "invalid_grant" errors

**Cause:**
The Gmail refresh token expires or gets revoked after:
- Password change
- Account security settings updated
- Token not used for 6+ months
- Google security audit

**Fix:**

### Step 1: Re-authenticate Gmail
1. Go to your Railway app URL:
   ```
   https://edgetalentcrm-production.up.railway.app/api/gmail/auth
   ```

2. Sign in with the Gmail account (hello@edgetalent.co.uk)

3. Copy the new refresh token from the success page

### Step 2: Update Railway Environment Variables
1. Go to Railway dashboard: https://railway.app
2. Select your project
3. Go to "Variables" tab
4. Update `GMAIL_REFRESH_TOKEN` with the new token
5. Redeploy the service

### Step 3: Test
Send yourself a test email and wait 1-2 minutes.

---

## 🟡 #2: Polling Interval Too Long

**Symptoms:**
- Emails DO come through, but take 10+ minutes
- "It worked before" - actually it was just slow

**Cause:**
The default poll interval is **10 minutes** (600,000ms).

**Fix:**

### Option A: Reduce Poll Interval (Temporary)
Add environment variable in Railway:
```
GMAIL_POLL_INTERVAL_MS=60000
```
This sets it to 1 minute (60000ms).

⚠️ Warning: Very frequent polling may hit Gmail API rate limits or cause performance issues.

### Option B: Use Push Notifications (Recommended)
Enable Gmail push notifications for instant delivery:

1. Add environment variable:
   ```
   GMAIL_PUSH_ENABLED=true
   ```

2. Set up Google Cloud Pub/Sub (more complex setup)

3. Redeploy

---

## 🟠 #3: Processed Messages Deduplication

**Symptoms:**
- Sent test email but it never appears
- First email worked, second identical one doesn't

**Cause:**
The poller tracks processed message IDs to prevent duplicates. It stores them in `server/data/processed_gmail_messages_primary.json`.

**This is RARE** - each email has a unique message ID, so even identical content gets different IDs.

**Fix (if you suspect this):**

Restart the server - this clears the in-memory cache:
1. Railway dashboard → your service → "Deploy" tab
2. Click "Redeploy"

Or delete the processed messages file:
```bash
# In Railway (if you have shell access)
rm server/data/processed_gmail_messages_*.json
```

---

## 🔵 #4: Wrong Gmail Account

**Symptoms:**
- Sent email to diary@edgetalent.co.uk
- But poller is checking hello@edgetalent.co.uk

**Fix:**
Make sure you're sending to the correct email address that matches your GMAIL_EMAIL setting.

Check which accounts are configured:
```
GMAIL_EMAIL=hello@edgetalent.co.uk        # Primary
GMAIL_EMAIL_2=diary@edgetalent.co.uk     # Secondary
```

---

## 🟣 #5: Missing Environment Variables

**Symptoms:**
- Poller never starts
- Logs show "Gmail poller disabled: Account not configured"

**Fix:**
Check Railway environment variables are set:
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_EMAIL`

---

## 🔧 Quick Diagnostic Steps

### Step 1: Check Server Logs
Go to Railway dashboard → your service → "Deploy" tab → click on the latest deployment → "Logs"

Look for:
- "📧 Gmail Service: Initializing" - Should appear
- "✅ Started X Gmail poller(s)" - Should appear
- "❌" or "invalid_grant" - Indicates token issue

### Step 2: Check Environment Variables
In Railway dashboard → "Variables" tab, verify:
- All GMAIL_* variables are set
- No extra spaces or quotes
- Values are complete

### Step 3: Test Gmail API Connection
Run the diagnostic script locally:
```bash
node check-gmail-poller.js
```

Or check via the API endpoint (if available):
```
GET /api/gmail/status
```

---

## 🧪 Testing Email Reception

### Send Test Email:
1. From your personal email, send to: `hello@edgetalent.co.uk`
2. Subject: "TEST EMAIL [timestamp]" (e.g., "TEST EMAIL 2026-02-05 14:30")
3. Body: Any content

### Check Dashboard:
1. Wait up to 10 minutes (or your poll interval)
2. Check Dashboard "Tasks" section
3. Email should appear as unread message

### Force Immediate Poll (if needed):
Restart the server to trigger immediate poll:
- Railway dashboard → "Redeploy"

---

## 📊 Understanding the Polling Flow

```
You send email → Gmail server
                     ↓
            [Wait for poll interval]
                     ↓
              Gmail API Poller wakes up
                     ↓
              Checks Gmail inbox
                     ↓
              Finds new message
                     ↓
              Processes & saves to database
                     ↓
              Dashboard shows new message
```

**Key Point:** There's always a delay between sending and receiving.
- Default: up to 10 minutes
- With 1 min interval: up to 1 minute
- With push notifications: almost instant

---

## 🆘 Emergency: Force Re-poll All Emails

If you need to re-process all emails immediately, run this script on Railway:

```bash
# Delete processed messages cache
rm server/data/processed_gmail_messages_*.json

# The poller will re-check all emails on next poll
```

Then redeploy to restart the poller.

---

## 📞 Still Not Working?

Check these in order:

1. **Logs** - Look for errors in Railway logs
2. **Token** - Re-authenticate Gmail if you see "invalid_grant"
3. **Interval** - Reduce poll interval if waiting too long
4. **Variables** - Verify all env vars are set correctly
5. **Permissions** - Ensure Gmail account has API access enabled

---

## ✅ Most Likely Fix for Your Issue

Based on "worked before but now doesn't" - **your refresh token has expired**.

**Do this:**
1. Go to: https://edgetalentcrm-production.up.railway.app/api/gmail/auth
2. Sign in with hello@edgetalent.co.uk
3. Copy the new refresh token
4. Update GMAIL_REFRESH_TOKEN in Railway
5. Redeploy
6. Test again

This fixes 90% of "suddenly stopped working" issues.
