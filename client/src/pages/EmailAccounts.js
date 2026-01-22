import React, { useState, useEffect } from 'react';
import { FiSearch, FiEdit, FiTrash2, FiPlus, FiX, FiMail, FiKey, FiCheck, FiStar, FiRefreshCw, FiDownload } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const EmailAccounts = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Create account modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    client_id: '',
    client_secret: '',
    refresh_token: '',
    redirect_uri: '',
    display_name: 'Edge Talent',
    is_default: false
  });
  const [formErrors, setFormErrors] = useState({});

  // State for edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editAccountData, setEditAccountData] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  // State for delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteAccountId, setDeleteAccountId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // State for testing
  const [testingAccountId, setTestingAccountId] = useState(null);

  // State for connection status per account (tracks last test result)
  const [connectionStatus, setConnectionStatus] = useState({});

  // State for importing from env
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchAccounts();
    }
  }, [user]);

  const fetchAccounts = async () => {
    try {
      const response = await axios.get('/api/email-accounts');
      setAccounts(response.data);
    } catch (error) {
      console.error('Error fetching email accounts:', error);
    }
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid';
    }

    return errors;
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setCreateLoading(true);
    setFormErrors({});

    try {
      const response = await axios.post('/api/email-accounts', formData);

      setAccounts(prev => [response.data.account, ...prev]);

      setFormData({
        name: '',
        email: '',
        client_id: '',
        client_secret: '',
        refresh_token: '',
        redirect_uri: '',
        display_name: 'Edge Talent',
        is_default: false
      });
      setShowCreateModal(false);

      alert('Email account created successfully!');

    } catch (error) {
      console.error('Error creating email account:', error);
      const errorMessage = error.response?.data?.message || 'Failed to create email account';
      setFormErrors({ submit: errorMessage });
    }

    setCreateLoading(false);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setFormData({
      name: '',
      email: '',
      client_id: '',
      client_secret: '',
      refresh_token: '',
      redirect_uri: '',
      display_name: 'Edge Talent',
      is_default: false
    });
    setFormErrors({});
  };

  const handleEditAccount = async (e) => {
    e.preventDefault();

    setEditLoading(true);

    try {
      const response = await axios.put(`/api/email-accounts/${editAccountData.id}`, editAccountData);

      // Refresh the accounts list to get updated data
      await fetchAccounts();

      setShowEditModal(false);
      setEditAccountData(null);

      alert('Email account updated successfully!');
    } catch (error) {
      console.error('Error updating email account:', error);
      alert(error.response?.data?.message || 'Failed to update email account');
    }

    setEditLoading(false);
  };

  const handleDeleteAccount = async () => {
    if (!deleteAccountId) return;

    setDeleteLoading(true);

    try {
      await axios.delete(`/api/email-accounts/${deleteAccountId}`);

      setAccounts(prev => prev.filter(account => account.id !== deleteAccountId));

      setShowDeleteConfirm(false);
      setDeleteAccountId(null);

      alert('Email account deleted successfully!');
    } catch (error) {
      console.error('Error deleting email account:', error);
      alert(error.response?.data?.message || 'Failed to delete email account');
    }

    setDeleteLoading(false);
  };

  const handleTestConnection = async (accountId) => {
    setTestingAccountId(accountId);

    try {
      const response = await axios.post(`/api/email-accounts/${accountId}/test`);

      if (response.data.success) {
        // Update connection status to success
        setConnectionStatus(prev => ({
          ...prev,
          [accountId]: { success: true, testedAt: new Date().toISOString() }
        }));
        alert(`Connection successful!\nEmail: ${response.data.email}\nMessages: ${response.data.messagesTotal}`);
      } else {
        // Update connection status to failed
        setConnectionStatus(prev => ({
          ...prev,
          [accountId]: {
            success: false,
            error: response.data.error,
            needsReauth: response.data.needsReauth,
            testedAt: new Date().toISOString()
          }
        }));
        alert(`Connection failed: ${response.data.error}`);
      }
    } catch (error) {
      console.error('Error testing email account:', error);
      // Update connection status to failed
      setConnectionStatus(prev => ({
        ...prev,
        [accountId]: {
          success: false,
          error: error.response?.data?.error || 'Failed to test connection',
          testedAt: new Date().toISOString()
        }
      }));
      alert(error.response?.data?.error || 'Failed to test connection');
    }

    setTestingAccountId(null);
  };

  const handleSetDefault = async (accountId) => {
    try {
      await axios.post(`/api/email-accounts/${accountId}/set-default`);

      // Refresh accounts to show updated default status
      await fetchAccounts();

      alert('Default email account updated!');
    } catch (error) {
      console.error('Error setting default account:', error);
      alert(error.response?.data?.message || 'Failed to set default account');
    }
  };

  const openEditModal = (accountData) => {
    setEditAccountData({
      id: accountData.id,
      name: accountData.name,
      email: accountData.email,
      client_id: '', // Don't populate - only update if new value provided
      client_secret: '',
      refresh_token: '',
      redirect_uri: accountData.redirect_uri || '',
      display_name: accountData.display_name || 'Edge Talent',
      is_active: accountData.is_active,
      is_default: accountData.is_default
    });
    setShowEditModal(true);
  };

  const openDeleteConfirm = (accountId) => {
    setDeleteAccountId(accountId);
    setShowDeleteConfirm(true);
  };

  // State for import preview modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const handleShowImportModal = async () => {
    setLoadingPreview(true);
    setShowImportModal(true);

    try {
      const response = await axios.get('/api/email-accounts/preview-env');
      setImportPreview(response.data);
    } catch (error) {
      console.error('Error loading preview:', error);
      setImportPreview({ error: error.response?.data?.message || 'Failed to load preview' });
    }

    setLoadingPreview(false);
  };

  const handleImportFromEnv = async () => {
    setImporting(true);

    try {
      const response = await axios.post('/api/email-accounts/import-from-env');

      let message = response.data.message;

      if (response.data.imported?.length > 0) {
        message += '\n\nImported:\n' + response.data.imported.map(a => `- ${a.email}`).join('\n');
      }

      if (response.data.skipped?.length > 0) {
        message += '\n\nSkipped (already exist):\n' + response.data.skipped.map(a => `- ${a.email}`).join('\n');
      }

      if (response.data.errors?.length > 0) {
        message += '\n\nErrors:\n' + response.data.errors.map(a => `- ${a.email}: ${a.error}`).join('\n');
      }

      alert(message);
      setShowImportModal(false);

      // Refresh the accounts list
      await fetchAccounts();
    } catch (error) {
      console.error('Error importing from env:', error);
      alert(error.response?.data?.message || 'Failed to import accounts');
    }

    setImporting(false);
  };

  const filteredAccounts = accounts.filter(account =>
    account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (user?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Email Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">Manage email accounts for sending messages</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleShowImportModal}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors flex items-center space-x-2"
            title="Import accounts from server environment variables"
          >
            <FiDownload className="h-4 w-4" />
            <span>Import from Env</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <FiPlus className="h-4 w-4" />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search accounts..."
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Email Accounts Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="table-header">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Credentials
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAccounts.map((account) => (
                <tr key={account.id} className="table-row">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                        <FiMail className="h-4 w-4 text-white" />
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900 flex items-center">
                          {account.name}
                          {account.is_default && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              <FiStar className="h-3 w-3 mr-1" />
                              Default
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {account.display_name || 'Edge Talent'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{account.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`status-badge ${account.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {account.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${account.hasClientId ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          ID {account.hasClientId ? <FiCheck className="ml-1 h-3 w-3" /> : <FiX className="ml-1 h-3 w-3" />}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${account.hasClientSecret ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          Secret {account.hasClientSecret ? <FiCheck className="ml-1 h-3 w-3" /> : <FiX className="ml-1 h-3 w-3" />}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${account.hasRefreshToken ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          Token {account.hasRefreshToken ? <FiCheck className="ml-1 h-3 w-3" /> : <FiX className="ml-1 h-3 w-3" />}
                        </span>
                      </div>
                      {/* Connection status indicator */}
                      <div className="flex items-center">
                        {connectionStatus[account.id] ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                            connectionStatus[account.id].success
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {connectionStatus[account.id].success ? (
                              <>Connected <FiCheck className="ml-1 h-3 w-3" /></>
                            ) : (
                              <>
                                {connectionStatus[account.id].needsReauth ? 'Token Expired' : 'Failed'}
                                <FiX className="ml-1 h-3 w-3" />
                              </>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                            Not tested
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleTestConnection(account.id)}
                        disabled={testingAccountId === account.id}
                        className="text-green-600 hover:text-green-900 disabled:opacity-50"
                        title="Test Connection"
                      >
                        {testingAccountId === account.id ? (
                          <FiRefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <FiRefreshCw className="h-4 w-4" />
                        )}
                      </button>
                      {!account.is_default && (
                        <button
                          onClick={() => handleSetDefault(account.id)}
                          className="text-yellow-600 hover:text-yellow-900"
                          title="Set as Default"
                        >
                          <FiStar className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(account)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit"
                      >
                        <FiEdit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openDeleteConfirm(account.id)}
                        className={`${account.is_default ? 'text-gray-300 cursor-not-allowed' : 'text-red-600 hover:text-red-900'}`}
                        title={account.is_default ? "Cannot delete default account" : "Delete"}
                        disabled={account.is_default}
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAccounts.length === 0 && (
          <div className="text-center py-12">
            <FiMail className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-500">No email accounts found</p>
            <p className="text-sm text-gray-400">Add an email account to get started</p>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="text-center">
            <div className="text-2xl font-semibold text-gray-900">{accounts.length}</div>
            <div className="text-sm text-gray-500">Total Accounts</div>
          </div>
        </div>
        <div className="card">
          <div className="text-center">
            <div className="text-2xl font-semibold text-green-600">
              {accounts.filter(a => a.is_active).length}
            </div>
            <div className="text-sm text-gray-500">Active Accounts</div>
          </div>
        </div>
        <div className="card">
          <div className="text-center">
            <div className="text-2xl font-semibold text-blue-600">
              {accounts.filter(a => a.hasRefreshToken).length}
            </div>
            <div className="text-sm text-gray-500">Configured Accounts</div>
          </div>
        </div>
      </div>

      {/* Create Account Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Add Email Account</h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              {/* Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    formErrors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Hello Account, Diary Account"
                />
                {formErrors.name && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>
                )}
              </div>

              {/* Email Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FiMail className="inline h-4 w-4 mr-2" />
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    formErrors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="hello@edgetalent.co.uk"
                />
                {formErrors.email && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>
                )}
              </div>

              {/* Display Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  name="display_name"
                  value={formData.display_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Edge Talent"
                />
              </div>

              <hr className="my-4" />
              <h3 className="text-sm font-medium text-gray-700">OAuth Credentials (Optional)</h3>
              <p className="text-xs text-gray-500 mb-4">
                Configure these settings to enable sending emails from this account.
              </p>

              {/* Client ID Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FiKey className="inline h-4 w-4 mr-2" />
                  Google Client ID
                </label>
                <input
                  type="text"
                  name="client_id"
                  value={formData.client_id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="xxx.apps.googleusercontent.com"
                />
              </div>

              {/* Client Secret Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Secret
                </label>
                <input
                  type="password"
                  name="client_secret"
                  value={formData.client_secret}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter client secret"
                />
              </div>

              {/* Refresh Token Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Refresh Token
                </label>
                <input
                  type="password"
                  name="refresh_token"
                  value={formData.refresh_token}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter refresh token"
                />
              </div>

              {/* Redirect URI Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Redirect URI
                </label>
                <input
                  type="text"
                  name="redirect_uri"
                  value={formData.redirect_uri}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://your-domain/api/gmail/oauth2callback"
                />
              </div>

              {/* Is Default Checkbox */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="is_default"
                  id="is_default"
                  checked={formData.is_default}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_default" className="ml-2 block text-sm text-gray-700">
                  Set as default email account
                </label>
              </div>

              {/* Submit Error */}
              {formErrors.submit && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-red-600 text-sm">{formErrors.submit}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {createLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <FiPlus className="h-4 w-4" />
                      <span>Create Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Edit Email Account</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleEditAccount} className="space-y-4">
              {/* Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={editAccountData.name}
                  onChange={(e) => setEditAccountData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Email Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={editAccountData.email}
                  onChange={(e) => setEditAccountData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Display Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  name="display_name"
                  value={editAccountData.display_name}
                  onChange={(e) => setEditAccountData(prev => ({ ...prev, display_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <hr className="my-4" />
              <h3 className="text-sm font-medium text-gray-700">Update OAuth Credentials</h3>
              <p className="text-xs text-gray-500 mb-2">
                Credentials are hidden for security. Leave blank to keep existing.
              </p>
              <div className="flex items-center space-x-2 mb-4 text-xs">
                <span className="text-gray-600">Currently saved:</span>
                <span className={accounts.find(a => a.id === editAccountData?.id)?.hasClientId ? 'text-green-600' : 'text-red-600'}>
                  ID {accounts.find(a => a.id === editAccountData?.id)?.hasClientId ? '✓' : '✗'}
                </span>
                <span className={accounts.find(a => a.id === editAccountData?.id)?.hasClientSecret ? 'text-green-600' : 'text-red-600'}>
                  Secret {accounts.find(a => a.id === editAccountData?.id)?.hasClientSecret ? '✓' : '✗'}
                </span>
                <span className={accounts.find(a => a.id === editAccountData?.id)?.hasRefreshToken ? 'text-green-600' : 'text-red-600'}>
                  Token {accounts.find(a => a.id === editAccountData?.id)?.hasRefreshToken ? '✓' : '✗'}
                </span>
              </div>

              {/* Client ID Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Google Client ID
                </label>
                <input
                  type="text"
                  name="client_id"
                  value={editAccountData.client_id}
                  onChange={(e) => setEditAccountData(prev => ({ ...prev, client_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Leave blank to keep existing"
                />
              </div>

              {/* Client Secret Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Secret
                </label>
                <input
                  type="password"
                  name="client_secret"
                  value={editAccountData.client_secret}
                  onChange={(e) => setEditAccountData(prev => ({ ...prev, client_secret: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Leave blank to keep existing"
                />
              </div>

              {/* Refresh Token Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Refresh Token
                </label>
                <input
                  type="password"
                  name="refresh_token"
                  value={editAccountData.refresh_token}
                  onChange={(e) => setEditAccountData(prev => ({ ...prev, refresh_token: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Leave blank to keep existing"
                />
              </div>

              {/* Redirect URI Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Redirect URI
                </label>
                <input
                  type="text"
                  name="redirect_uri"
                  value={editAccountData.redirect_uri}
                  onChange={(e) => setEditAccountData(prev => ({ ...prev, redirect_uri: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Is Active Checkbox */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="is_active"
                  id="edit_is_active"
                  checked={editAccountData.is_active}
                  onChange={(e) => setEditAccountData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="edit_is_active" className="ml-2 block text-sm text-gray-700">
                  Account is active
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {editLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Account</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <FiTrash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mt-4">
                Delete Email Account
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete this email account? Users assigned to this account will be unassigned.
                </p>
              </div>
            </div>
            <div className="mt-5 sm:mt-6 flex justify-center space-x-4">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {deleteLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Account</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import from Environment Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Import Email Accounts from Environment</h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>

            {loadingPreview ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : importPreview?.error ? (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-red-600">{importPreview.error}</p>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-sm text-gray-600">
                  The following email accounts were found in your server environment variables and will be imported with their credentials:
                </p>

                {/* Primary Account */}
                {importPreview?.primary && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                      <FiMail className="h-5 w-5 mr-2 text-blue-500" />
                      Primary Account
                      {importPreview.primary.exists && (
                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Already exists</span>
                      )}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Email:</span>
                        <span className="ml-2 font-mono">{importPreview.primary.email || 'Not configured'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Google Client ID:</span>
                        <span className={`ml-2 ${importPreview.primary.hasClientId ? 'text-green-600' : 'text-red-600'}`}>
                          {importPreview.primary.hasClientId ? <FiCheck className="inline h-4 w-4" /> : <FiX className="inline h-4 w-4" />}
                          {importPreview.primary.hasClientId ? ' Configured' : ' Missing'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Client Secret:</span>
                        <span className={`ml-2 ${importPreview.primary.hasClientSecret ? 'text-green-600' : 'text-red-600'}`}>
                          {importPreview.primary.hasClientSecret ? <FiCheck className="inline h-4 w-4" /> : <FiX className="inline h-4 w-4" />}
                          {importPreview.primary.hasClientSecret ? ' Configured' : ' Missing'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Refresh Token:</span>
                        <span className={`ml-2 ${importPreview.primary.hasRefreshToken ? 'text-green-600' : 'text-red-600'}`}>
                          {importPreview.primary.hasRefreshToken ? <FiCheck className="inline h-4 w-4" /> : <FiX className="inline h-4 w-4" />}
                          {importPreview.primary.hasRefreshToken ? ' Configured' : ' Missing'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Secondary Account */}
                {importPreview?.secondary && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                      <FiMail className="h-5 w-5 mr-2 text-purple-500" />
                      Secondary Account
                      {importPreview.secondary.exists && (
                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Already exists</span>
                      )}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Email:</span>
                        <span className="ml-2 font-mono">{importPreview.secondary.email || 'Not configured'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Google Client ID:</span>
                        <span className={`ml-2 ${importPreview.secondary.hasClientId ? 'text-green-600' : 'text-red-600'}`}>
                          {importPreview.secondary.hasClientId ? <FiCheck className="inline h-4 w-4" /> : <FiX className="inline h-4 w-4" />}
                          {importPreview.secondary.hasClientId ? ' Configured' : ' Missing'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Client Secret:</span>
                        <span className={`ml-2 ${importPreview.secondary.hasClientSecret ? 'text-green-600' : 'text-red-600'}`}>
                          {importPreview.secondary.hasClientSecret ? <FiCheck className="inline h-4 w-4" /> : <FiX className="inline h-4 w-4" />}
                          {importPreview.secondary.hasClientSecret ? ' Configured' : ' Missing'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Refresh Token:</span>
                        <span className={`ml-2 ${importPreview.secondary.hasRefreshToken ? 'text-green-600' : 'text-red-600'}`}>
                          {importPreview.secondary.hasRefreshToken ? <FiCheck className="inline h-4 w-4" /> : <FiX className="inline h-4 w-4" />}
                          {importPreview.secondary.hasRefreshToken ? ' Configured' : ' Missing'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {!importPreview?.primary?.email && !importPreview?.secondary?.email && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                    <p className="text-yellow-800">No email accounts found in environment variables.</p>
                  </div>
                )}

                {/* Auth URLs Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Need to Re-authenticate?</h4>
                  <p className="text-sm text-blue-800 mb-2">If tokens are expired, visit these URLs to get new refresh tokens:</p>
                  <div className="text-sm font-mono space-y-1">
                    <div><span className="text-blue-600">Primary:</span> /api/gmail/auth</div>
                    <div><span className="text-blue-600">Secondary:</span> /api/gmail/auth2</div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-6 mt-6 border-t">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportFromEnv}
                disabled={importing || loadingPreview || (!importPreview?.primary?.email && !importPreview?.secondary?.email)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {importing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <FiDownload className="h-4 w-4" />
                    <span>Import Accounts</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailAccounts;
