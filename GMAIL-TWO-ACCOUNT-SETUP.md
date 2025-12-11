# Gmail Two-Account Setup & Token Invalidation

## Overview

The CRM uses **two separate Gmail accounts** for sending emails:
- **Primary Account**: `hello@edgetalent.co.uk`
- **Secondary Account**: `diary@edgetalent.co.uk`

## Account Configuration

### Primary Account
- **Environment Variables**:
  - `GMAIL_CLIENT_ID`
  - `GMAIL_CLIENT_SECRET`
  - `GMAIL_REFRESH_TOKEN`
  - `GMAIL_EMAIL=hello@edgetalent.co.uk`

### Secondary Account
- **Environment Variables**:
  - `GMAIL_CLIENT_ID_2`
  - `GMAIL_CLIENT_SECRET_2`
  - `GMAIL_REFRESH_TOKEN_2`
  - `GMAIL_EMAIL_2=diary@edgetalent.co.uk`

## Does Having 2 Accounts Cause Token Invalidation?

### ✅ **No, having 2 accounts does NOT inherently cause token invalidation**

**Why it's safe:**
1. **Separate OAuth Apps**: Each account uses its own OAuth client credentials (`GMAIL_CLIENT_ID` vs `GMAIL_CLIENT_ID_2`). This is the **correct and recommended approach**.
2. **Independent Tokens**: Each account has its own refresh token, so they operate independently.
3. **Google's Design**: Google OAuth is designed to support multiple accounts and applications.

### ⚠️ **However, token invalidation CAN occur due to:**

1. **User Actions**:
   - User revokes access in their Google Account settings
   - User changes their Google account password
   - User enables 2FA and doesn't update the app password

2. **Security Events**:
   - Google detects suspicious activity
   - Account security changes
   - OAuth app credentials are compromised

3. **Token Expiration** (Normal):
   - Refresh tokens can expire if not used for 6 months
   - Access tokens expire after 1 hour (but are auto-refreshed)

4. **Configuration Issues**:
   - Incorrect redirect URIs
   - OAuth app settings changed in Google Cloud Console
   - Client ID/Secret mismatch

5. **Rate Limiting** (Rare):
   - Excessive token refresh requests
   - Too many API calls in a short period

## Automatic Fallback Mechanism

The system now includes **automatic fallback** to prevent email sending failures:

### How It Works:

1. **When sending an email with secondary account**:
   - System attempts to send via `diary@edgetalent.co.uk`
   - If token is invalid (`invalid_grant` error):
     - ✅ Automatically falls back to primary account (`hello@edgetalent.co.uk`)
     - ✅ Email is sent successfully
     - ✅ Logs indicate fallback was used

2. **Implementation Layers**:
   - `gmailService.js`: Detects `invalid_grant` errors
   - `emailService.js`: Handles automatic fallback
   - `messagingService.js`: Additional fallback layer

### Benefits:

- ✅ **Zero downtime**: Emails continue to send even if one token expires
- ✅ **Automatic recovery**: No manual intervention needed
- ✅ **Clear logging**: Logs show when fallback is used
- ✅ **User transparency**: System continues working seamlessly

## Best Practices to Prevent Token Invalidation

### 1. **Use Separate OAuth Apps** ✅ (Already Implemented)
   - Each account has its own `CLIENT_ID` and `CLIENT_SECRET`
   - This is the correct approach and prevents conflicts

### 2. **Monitor Token Health**
   - Check logs regularly for `invalid_grant` errors
   - Set up alerts for authentication failures

### 3. **Regular Token Refresh**
   - Tokens are automatically refreshed when used
   - Ensure both accounts are used regularly (at least once every 6 months)

### 4. **Secure Storage**
   - Store tokens securely in Railway environment variables
   - Never commit tokens to Git
   - Rotate tokens if compromised

### 5. **Proper Redirect URIs**
   - Ensure redirect URIs match in:
     - Google Cloud Console OAuth app settings
     - Railway environment variables
     - Application code

## Re-authenticating When Token Expires

If a token becomes invalid, follow these steps:

### For Primary Account (`hello@edgetalent.co.uk`):

1. Visit: `https://edgetalentcrm-production.up.railway.app/api/gmail/auth`
2. Sign in with `hello@edgetalent.co.uk`
3. Authorize the application
4. Copy the new refresh token from the response
5. Update in Railway: `GMAIL_REFRESH_TOKEN=<new-token>`

### For Secondary Account (`diary@edgetalent.co.uk`):

1. Visit: `https://edgetalentcrm-production.up.railway.app/api/gmail/auth2`
2. Sign in with `diary@edgetalent.co.uk`
3. Authorize the application
4. Copy the new refresh token from the response
5. Update in Railway: `GMAIL_REFRESH_TOKEN_2=<new-token>`

## Troubleshooting

### Issue: "invalid_grant" error for one account

**Solution:**
1. The system will automatically fall back to the other account
2. Re-authenticate the failed account using the steps above
3. Update the refresh token in Railway

### Issue: Both accounts failing

**Solution:**
1. Check Google Cloud Console for OAuth app status
2. Verify redirect URIs are correct
3. Check if accounts have been locked or suspended
4. Re-authenticate both accounts

### Issue: Frequent token invalidations

**Possible Causes:**
- Security settings changed on Google accounts
- OAuth app settings changed
- Account password changed
- 2FA enabled without updating app password

**Solution:**
- Review Google account security settings
- Check OAuth app configuration in Google Cloud Console
- Ensure redirect URIs match exactly

## Summary

✅ **Two accounts are safe** - Using separate OAuth apps prevents conflicts  
✅ **Automatic fallback** - System continues working if one token expires  
✅ **Best practices** - Follow the guidelines above to minimize issues  
⚠️ **Monitor regularly** - Check logs for authentication errors  
🔄 **Re-authenticate** - When tokens expire, use the provided steps

The fallback mechanism ensures your email system remains operational even if one account's token expires, providing high availability and reliability.

