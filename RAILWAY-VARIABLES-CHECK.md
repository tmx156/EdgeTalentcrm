# Railway Variables Check - Gmail OAuth Status

## ✅ **Railway Variables - ALL SET!**

I've checked your Railway environment variables and **everything is correctly configured**:

### Gmail OAuth Variables (Primary Account - hello@edgetalent.co.uk)

✅ **GMAIL_CLIENT_ID**: `[REDACTED - Set in Railway]`
✅ **GMAIL_CLIENT_SECRET**: `[REDACTED - Set in Railway]`
✅ **GMAIL_EMAIL**: `hello@edgetalent.co.uk`
✅ **GMAIL_REDIRECT_URI**: `https://edgetalentcrm-production.up.railway.app/api/gmail/oauth2callback`
✅ **GMAIL_REFRESH_TOKEN**: Set (token present)

### Gmail OAuth Variables (Secondary Account - diary@edgetalent.co.uk)

✅ **GMAIL_CLIENT_ID_2**: `[REDACTED - Set in Railway]`
✅ **GMAIL_CLIENT_SECRET_2**: `[REDACTED - Set in Railway]`
✅ **GMAIL_EMAIL_2**: `diary@edgetalent.co.uk`
✅ **GMAIL_REDIRECT_URI_2**: `https://edgetalentcrm-production.up.railway.app/api/gmail/oauth2callback2`
✅ **GMAIL_REFRESH_TOKEN_2**: Set (token present)

---

## 🔍 **The Problem**

Since all Railway variables are correctly set, the issue is **in Google Cloud Console**. 

You need to add the following to your OAuth 2.0 Client ID settings:

### 1. Authorised JavaScript Origins

Add this URI:
```
https://edgetalentcrm-production.up.railway.app
```

**Note:** This is what you're currently looking at in Google Cloud Console.

### 2. Authorised Redirect URIs

Add this URI:
```
https://edgetalentcrm-production.up.railway.app/api/gmail/oauth2callback
```

**Important:** 
- The redirect URI must include the full path `/api/gmail/oauth2callback`
- This must match exactly what's in Railway (`GMAIL_REDIRECT_URI`)

---

## 📋 **Quick Action Items**

### In Google Cloud Console (Right Now):

1. **Authorised JavaScript origins** section:
   - Click "+ ADD URI"
   - Add: `https://edgetalentcrm-production.up.railway.app`
   - Click "SAVE"

2. **Authorised redirect URIs** section:
   - Click "+ ADD URI"  
   - Add: `https://edgetalentcrm-production.up.railway.app/api/gmail/oauth2callback`
   - Click "SAVE"

### For Secondary Account (diary@edgetalent.co.uk):

If you have a separate OAuth Client ID for the secondary account, also add:
```
https://edgetalentcrm-production.up.railway.app/api/gmail/oauth2callback2
```

---

## ✅ **Verification**

After adding the URIs in Google Cloud Console:

1. **Test the OAuth flow:**
   ```
   https://edgetalentcrm-production.up.railway.app/api/gmail/auth
   ```

2. **Check Gmail API status:**
   ```
   https://edgetalentcrm-production.up.railway.app/api/gmail/status
   ```

3. **Check Railway logs** to see if Gmail poller starts successfully

---

## 🎯 **Summary**

- ✅ Railway variables: **All correctly set**
- ❌ Google Cloud Console: **Missing redirect URIs** (this is what needs to be fixed)
- ✅ Code: **Updated to use correct redirect URI**

**Next Step:** Add the redirect URIs in Google Cloud Console as shown above.

---

**Last Checked:** Via Railway CLI
**Railway Project:** EdgeTalentcrm (production)
**Railway Domain:** `https://edgetalentcrm-production.up.railway.app`

