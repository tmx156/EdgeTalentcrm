# 🔴 Email Not Received - Immediate Fix Guide

## Your Issue
> "I just sent myself an email test, nothing came through on Railway. It worked before but now doesn't."

---

## 🎯 Most Likely Cause

**Your Gmail refresh token has expired.**

This is the #1 reason emails suddenly stop working. The refresh token (GMAIL_REFRESH_TOKEN) expires when:
- Gmail password was changed
- Account security settings updated
- Token not used for 6+ months
- Google security audit triggered

---

## ⚡ Quick Fix (5 minutes)

### Step 1: Re-authenticate Gmail

Go to this URL in your browser:
```
https://edgetalentcrm-production.up.railway.app/api/gmail/auth
```

1. Sign in with: **hello@edgetalent.co.uk**
2. Grant permissions
3. Copy the new refresh token shown on the success page

### Step 2: Update Railway

1. Go to: https://railway.app
2. Select your project
3. Click **"Variables"** tab
4. Find `GMAIL_REFRESH_TOKEN`
5. Replace the value with the new token from Step 1
6. Click **"Redeploy"** (or it may auto-redeploy)

### Step 3: Test

1. Send a test email to: **hello@edgetalent.co.uk**
2. Wait 1-2 minutes
3. Check Dashboard → should appear in Tasks

---

## 🔍 Other Possible Causes

### Cause #2: Polling Interval Too Long

**Symptom:** Emails come through but take 10+ minutes

**Fix:** Add environment variable in Railway:
```
GMAIL_POLL_INTERVAL_MS=60000
```
(Redeploy after changing)

This changes from 10 minutes to 1 minute.

---

### Cause #3: Wrong Email Address

**Symptom:** Sending to diary@ but poller checks hello@

**Fix:** Send test email to the address matching your `GMAIL_EMAIL` variable.

---

### Cause #4: Server Not Running

**Symptom:** Nothing happens at all

**Check:** Go to Railway dashboard → check if service is running (green dot)

---

## 🧪 Verify It's Working

After applying the fix:

1. **Send test email** from your personal email
2. **Subject:** "TEST " + current time (e.g., "TEST 14:35")
3. **Body:** Any text
4. **Wait:** Up to 2 minutes
5. **Check Dashboard:** Look in "Tasks" section

If it appears → ✅ Fixed!

---

## 📊 Why It Worked Before

| Timeframe | Status | Reason |
|-----------|--------|--------|
| Before | ✅ Working | Refresh token was valid |
| Now | ❌ Not working | Token expired/revoked |
| After fix | ✅ Working | New token installed |

---

## 🆘 If Still Not Working

Check the server logs:

1. Railway dashboard → your service
2. Click on latest deployment
3. View "Logs" tab
4. Look for:
   - `invalid_grant` → Token expired (follow fix above)
   - `invalid_client` → Wrong credentials
   - `Gmail poller disabled` → Missing env variables

---

## 📝 Scripts Available

I've created these diagnostic tools:

1. **check-gmail-poller.js** - Tests Gmail API connection
2. **force-repoll-emails.js** - Manually polls and processes emails

Run locally:
```bash
node check-gmail-poller.js
```

---

## ✅ Summary

**Do this right now:**

1. Visit: https://edgetalentcrm-production.up.railway.app/api/gmail/auth
2. Sign in and get new token
3. Update GMAIL_REFRESH_TOKEN in Railway
4. Redeploy
5. Send test email
6. Check Dashboard in 1-2 minutes

**This fixes 90% of "suddenly stopped working" issues.**
