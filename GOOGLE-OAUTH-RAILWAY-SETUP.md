# Google OAuth Setup for Railway Deployment

## 🔐 Complete Setup Guide for hello@edgetalent.co.uk

This guide will help you configure Google OAuth2 authentication for the Gmail API on your Railway deployment.

---

## 📋 Prerequisites

1. **Google Cloud Console Access**
   - Access to the Google Cloud project for `hello@edgetalent.co.uk`
   - Admin access to configure OAuth credentials

2. **Railway Deployment**
   - Your app deployed at: `https://edgetalentcrm-production.up.railway.app`
   - Access to Railway dashboard to set environment variables

---

## 🚀 Step-by-Step Setup

### Step 1: Configure Google Cloud Console

#### 1.1 Navigate to OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project (or create one for Edge Talent CRM)
3. Navigate to: **APIs & Services** → **Credentials**
4. Find your OAuth 2.0 Client ID (or create a new one)

#### 1.2 Add Authorized JavaScript Origins

In the OAuth 2.0 Client ID settings, under **"Authorised JavaScript origins"**:

Click **"+ ADD URI"** and add:
```
https://edgetalentcrm-production.up.railway.app
```

**Important:** 
- Use `https://` (not `http://`)
- No trailing slash
- This is the domain where your app is hosted

#### 1.3 Add Authorized Redirect URIs

Under **"Authorised redirect URIs"**, click **"+ ADD URI"** and add:

**For Production (Railway):**
```
https://edgetalentcrm-production.up.railway.app/api/gmail/oauth2callback
```

**For Local Development (optional, for testing):**
```
http://localhost:5000/api/gmail/oauth2callback
```

**Important:**
- The redirect URI must match **exactly** (including the path `/api/gmail/oauth2callback`)
- Both production and localhost can be added if you want to test locally

#### 1.4 Configure OAuth Consent Screen (if not already done)

1. Go to: **APIs & Services** → **OAuth consent screen**
2. Ensure these scopes are added:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.modify`

3. Add test users (if app is in testing mode):
   - `hello@edgetalent.co.uk`

#### 1.5 Get Your Credentials

1. In **Credentials** → Your OAuth 2.0 Client ID
2. Copy:
   - **Client ID** (looks like: `123456789-abc...xyz.apps.googleusercontent.com`)
   - **Client Secret** (click "Show" to reveal)

---

### Step 2: Set Railway Environment Variables

In your Railway dashboard:

1. Go to your project → **Settings** → **Variables**
2. Add these environment variables:

```env
# Gmail OAuth2 Credentials
GMAIL_CLIENT_ID=your-client-id-from-google-cloud-console
GMAIL_CLIENT_SECRET=your-client-secret-from-google-cloud-console
GMAIL_EMAIL=hello@edgetalent.co.uk
GMAIL_REDIRECT_URI=https://edgetalentcrm-production.up.railway.app/api/gmail/oauth2callback
```

**⚠️ Important:** 
- Replace `your-client-id-from-google-cloud-console` with your actual Client ID
- Replace `your-client-secret-from-google-cloud-console` with your actual Client Secret
- The `GMAIL_REDIRECT_URI` must match exactly what you added in Google Cloud Console

---

### Step 3: Get Refresh Token

After setting the environment variables, you need to complete the OAuth flow to get a refresh token:

1. **Deploy/Redeploy** your Railway app (to pick up the new environment variables)

2. **Visit the OAuth endpoint** in your browser:
   ```
   https://edgetalentcrm-production.up.railway.app/api/gmail/auth
   ```

3. **Authorize the app:**
   - You'll be redirected to Google's consent screen
   - Sign in with `hello@edgetalent.co.uk`
   - Click "Allow" to grant permissions

4. **Get the refresh token:**
   - After authorization, you'll be redirected back to your app
   - The page will display your **Refresh Token**
   - Copy this token

5. **Add refresh token to Railway:**
   - Go back to Railway → **Settings** → **Variables**
   - Add:
     ```env
     GMAIL_REFRESH_TOKEN=your-refresh-token-from-step-4
     ```

6. **Redeploy** your Railway app

---

## ✅ Verification

### Check Gmail API Status

Visit:
```
https://edgetalentcrm-production.up.railway.app/api/gmail/status
```

You should see:
```json
{
  "success": true,
  "configured": true,
  "status": {
    "credentials": {
      "clientId": "✅ Set",
      "clientSecret": "✅ Set",
      "refreshToken": "✅ Set",
      "email": "hello@edgetalent.co.uk"
    }
  }
}
```

### Test Gmail API

The Gmail poller should automatically start and begin checking for emails. Check your Railway logs to verify:

```bash
# In Railway dashboard → Deployments → View Logs
# Look for messages like:
✅ Gmail API authenticated successfully
✅ Gmail poller started for hello@edgetalent.co.uk
```

---

## 🔧 Troubleshooting

### Error: "redirect_uri_mismatch"

**Problem:** The redirect URI in your code doesn't match Google Cloud Console.

**Solution:**
1. Verify `GMAIL_REDIRECT_URI` in Railway matches exactly:
   ```
   https://edgetalentcrm-production.up.railway.app/api/gmail/oauth2callback
   ```
2. Verify it's added in Google Cloud Console → OAuth Credentials → Authorized redirect URIs
3. Ensure no trailing slashes or typos

### Error: "invalid_client"

**Problem:** Client ID or Client Secret is incorrect.

**Solution:**
1. Double-check `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` in Railway
2. Ensure no extra spaces or quotes
3. Verify credentials in Google Cloud Console

### Error: "invalid_grant" or "Token expired"

**Problem:** Refresh token is invalid or expired.

**Solution:**
1. Revoke access at: https://myaccount.google.com/permissions
2. Re-run the OAuth flow: `https://edgetalentcrm-production.up.railway.app/api/gmail/auth`
3. Get a new refresh token and update `GMAIL_REFRESH_TOKEN` in Railway

### OAuth flow redirects to localhost

**Problem:** The redirect URI is still set to localhost.

**Solution:**
1. Ensure `GMAIL_REDIRECT_URI` is set in Railway environment variables
2. Redeploy the app after setting the variable
3. Check that the config is using the Railway URL (see `server/config/index.js`)

---

## 📝 Summary Checklist

- [ ] Added `https://edgetalentcrm-production.up.railway.app` to **Authorised JavaScript origins** in Google Cloud Console
- [ ] Added `https://edgetalentcrm-production.up.railway.app/api/gmail/oauth2callback` to **Authorised redirect URIs** in Google Cloud Console
- [ ] Configured OAuth consent screen with required Gmail scopes
- [ ] Added test user `hello@edgetalent.co.uk` (if app is in testing mode)
- [ ] Set `GMAIL_CLIENT_ID` in Railway environment variables
- [ ] Set `GMAIL_CLIENT_SECRET` in Railway environment variables
- [ ] Set `GMAIL_EMAIL=hello@edgetalent.co.uk` in Railway environment variables
- [ ] Set `GMAIL_REDIRECT_URI=https://edgetalentcrm-production.up.railway.app/api/gmail/oauth2callback` in Railway
- [ ] Completed OAuth flow and obtained refresh token
- [ ] Set `GMAIL_REFRESH_TOKEN` in Railway environment variables
- [ ] Verified status at `/api/gmail/status` endpoint
- [ ] Confirmed Gmail poller is running in Railway logs

---

## 🔗 Quick Links

- **Google Cloud Console:** https://console.cloud.google.com
- **OAuth Credentials:** https://console.cloud.google.com/apis/credentials
- **OAuth Consent Screen:** https://console.cloud.google.com/apis/credentials/consent
- **Google Account Permissions:** https://myaccount.google.com/permissions
- **Railway Dashboard:** https://railway.app

---

## 📞 Need Help?

If you encounter issues:

1. Check Railway logs for specific error messages
2. Verify all environment variables are set correctly
3. Ensure the redirect URI matches exactly in both places
4. Try revoking and re-authorizing the OAuth connection

---

**Last Updated:** For Railway deployment at `https://edgetalentcrm-production.up.railway.app`

