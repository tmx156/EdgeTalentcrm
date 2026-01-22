/**
 * Email Accounts API Routes
 * Admin-only endpoints for managing email account pool
 */

const express = require('express');
const { auth, adminAuth } = require('../middleware/auth');
const emailAccountService = require('../utils/emailAccountService');
const gmailService = require('../utils/gmailService');

const router = express.Router();

/**
 * @route   GET /api/email-accounts
 * @desc    Get all email accounts
 * @access  Private (Admin only)
 */
router.get('/', auth, async (req, res) => {
  try {
    // Check admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized: Admin access required' });
    }

    const accounts = await emailAccountService.getAllAccounts();
    res.json(accounts);
  } catch (error) {
    console.error('Error getting email accounts:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/email-accounts/dropdown
 * @desc    Get email accounts for dropdown selection (simplified)
 * @access  Private (All authenticated users can see list for assignment UI)
 */
router.get('/dropdown', auth, async (req, res) => {
  try {
    const accounts = await emailAccountService.getAllAccounts();

    // Return simplified list for dropdowns
    const dropdown = accounts
      .filter(a => a.is_active)
      .map(a => ({
        id: a.id,
        name: a.name,
        email: a.email,
        is_default: a.is_default
      }));

    res.json(dropdown);
  } catch (error) {
    console.error('Error getting email accounts dropdown:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/email-accounts/preview-env
 * @desc    Preview email accounts available in environment variables before importing
 * @access  Private (Admin only)
 */
router.get('/preview-env', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized: Admin access required' });
    }

    const { ACCOUNTS } = gmailService;
    const existingAccounts = await emailAccountService.getAllAccounts();

    const result = {};

    // Check primary account
    if (ACCOUNTS.primary) {
      const primary = ACCOUNTS.primary;
      const exists = existingAccounts.some(a => a.email?.toLowerCase() === primary.email?.toLowerCase());
      result.primary = {
        email: primary.email,
        hasClientId: !!primary.clientId,
        hasClientSecret: !!primary.clientSecret,
        hasRefreshToken: !!primary.refreshToken,
        redirectUri: primary.redirectUri,
        displayName: primary.displayName,
        exists: exists
      };
    }

    // Check secondary account
    if (ACCOUNTS.secondary) {
      const secondary = ACCOUNTS.secondary;
      const exists = existingAccounts.some(a => a.email?.toLowerCase() === secondary.email?.toLowerCase());
      result.secondary = {
        email: secondary.email,
        hasClientId: !!secondary.clientId,
        hasClientSecret: !!secondary.clientSecret,
        hasRefreshToken: !!secondary.refreshToken,
        redirectUri: secondary.redirectUri,
        displayName: secondary.displayName,
        exists: exists
      };
    }

    res.json(result);
  } catch (error) {
    console.error('Error previewing env accounts:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/email-accounts/import-from-env
 * @desc    Import existing email accounts from environment variables
 * @access  Private (Admin only)
 * NOTE: This route MUST be defined BEFORE /:id routes to avoid matching "import-from-env" as an ID
 */
router.post('/import-from-env', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized: Admin access required' });
    }

    const imported = [];
    const skipped = [];
    const errors = [];

    // Get existing accounts from gmailService
    const { ACCOUNTS } = gmailService;

    // Import primary account
    if (ACCOUNTS.primary && ACCOUNTS.primary.email) {
      const primary = ACCOUNTS.primary;
      try {
        // Check if account already exists
        const existingAccounts = await emailAccountService.getAllAccounts();
        const exists = existingAccounts.some(a => a.email.toLowerCase() === primary.email.toLowerCase());

        if (exists) {
          skipped.push({ email: primary.email, reason: 'Already exists in database' });
        } else {
          const account = await emailAccountService.createAccount({
            name: 'Primary Email Account',
            email: primary.email,
            client_id: primary.clientId,
            client_secret: primary.clientSecret,
            refresh_token: primary.refreshToken,
            redirect_uri: primary.redirectUri,
            display_name: primary.displayName || 'Edge Talent',
            is_default: true
          });
          imported.push({ email: primary.email, id: account.id });
        }
      } catch (err) {
        errors.push({ email: primary.email, error: err.message });
      }
    }

    // Import secondary account
    if (ACCOUNTS.secondary && ACCOUNTS.secondary.email) {
      const secondary = ACCOUNTS.secondary;
      try {
        // Check if account already exists
        const existingAccounts = await emailAccountService.getAllAccounts();
        const exists = existingAccounts.some(a => a.email.toLowerCase() === secondary.email.toLowerCase());

        if (exists) {
          skipped.push({ email: secondary.email, reason: 'Already exists in database' });
        } else {
          const account = await emailAccountService.createAccount({
            name: 'Secondary Email Account',
            email: secondary.email,
            client_id: secondary.clientId,
            client_secret: secondary.clientSecret,
            refresh_token: secondary.refreshToken,
            redirect_uri: secondary.redirectUri,
            display_name: secondary.displayName || 'Edge Talent',
            is_default: false
          });
          imported.push({ email: secondary.email, id: account.id });
        }
      } catch (err) {
        errors.push({ email: secondary.email, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `Imported ${imported.length} account(s), skipped ${skipped.length}, ${errors.length} error(s)`,
      imported,
      skipped,
      errors
    });
  } catch (error) {
    console.error('Error importing email accounts from env:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/email-accounts/:id
 * @desc    Get single email account (without decrypted credentials)
 * @access  Private (Admin only)
 */
router.get('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized: Admin access required' });
    }

    const { id } = req.params;

    // Get account without decrypted credentials
    const accounts = await emailAccountService.getAllAccounts();
    const account = accounts.find(a => a.id === id);

    if (!account) {
      return res.status(404).json({ message: 'Email account not found' });
    }

    res.json(account);
  } catch (error) {
    console.error('Error getting email account:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/email-accounts
 * @desc    Create new email account
 * @access  Private (Admin only)
 */
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized: Admin access required' });
    }

    const { name, email, client_id, client_secret, refresh_token, redirect_uri, display_name, is_default } = req.body;

    console.log('📥 POST /api/email-accounts - Received data:', {
      name,
      email,
      hasClientId: !!client_id,
      clientIdLength: client_id?.length || 0,
      hasClientSecret: !!client_secret,
      clientSecretLength: client_secret?.length || 0,
      hasRefreshToken: !!refresh_token,
      refreshTokenLength: refresh_token?.length || 0,
      redirect_uri,
      display_name,
      is_default
    });

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    const newAccount = await emailAccountService.createAccount({
      name,
      email,
      client_id,
      client_secret,
      refresh_token,
      redirect_uri,
      display_name,
      is_default
    });

    res.status(201).json({
      message: 'Email account created successfully',
      account: newAccount
    });
  } catch (error) {
    console.error('Error creating email account:', error);

    if (error.message.includes('already exists')) {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   PUT /api/email-accounts/:id
 * @desc    Update email account
 * @access  Private (Admin only)
 */
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized: Admin access required' });
    }

    const { id } = req.params;
    const { name, email, client_id, client_secret, refresh_token, redirect_uri, display_name, is_active, is_default } = req.body;

    console.log(`📥 PUT /api/email-accounts/${id} - Received data:`, {
      name,
      email,
      hasClientId: !!client_id,
      clientIdLength: client_id?.length || 0,
      clientIdValue: client_id ? client_id.substring(0, 20) + '...' : 'empty',
      hasClientSecret: !!client_secret,
      clientSecretLength: client_secret?.length || 0,
      hasRefreshToken: !!refresh_token,
      refreshTokenLength: refresh_token?.length || 0,
      redirect_uri,
      display_name,
      is_active,
      is_default
    });

    const updatedAccount = await emailAccountService.updateAccount(id, {
      name,
      email,
      client_id,
      client_secret,
      refresh_token,
      redirect_uri,
      display_name,
      is_active,
      is_default
    });

    res.json({
      message: 'Email account updated successfully',
      account: updatedAccount
    });
  } catch (error) {
    console.error('Error updating email account:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    if (error.message.includes('already exists')) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message.includes('Cannot deactivate')) {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   DELETE /api/email-accounts/:id
 * @desc    Delete (deactivate) email account
 * @access  Private (Admin only)
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized: Admin access required' });
    }

    const { id } = req.params;
    const result = await emailAccountService.deleteAccount(id);

    res.json(result);
  } catch (error) {
    console.error('Error deleting email account:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    if (error.message.includes('Cannot delete')) {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/email-accounts/:id/test
 * @desc    Test email account connection
 * @access  Private (Admin only)
 */
router.post('/:id/test', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized: Admin access required' });
    }

    const { id } = req.params;
    const result = await emailAccountService.testAccount(id);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error testing email account:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test connection'
    });
  }
});

/**
 * @route   POST /api/email-accounts/:id/set-default
 * @desc    Set email account as the default
 * @access  Private (Admin only)
 */
router.post('/:id/set-default', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized: Admin access required' });
    }

    const { id } = req.params;

    // Update to set as default (updateAccount handles unsetting others)
    const updatedAccount = await emailAccountService.updateAccount(id, {
      is_default: true
    });

    res.json({
      message: 'Default email account updated successfully',
      account: updatedAccount
    });
  } catch (error) {
    console.error('Error setting default email account:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }

    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
