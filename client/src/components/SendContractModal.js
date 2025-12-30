import React, { useState, useEffect } from 'react';
import { X, Send, FileText, Mail, Copy, Check, Loader, AlertTriangle, ExternalLink, Clock, CheckCircle, Edit2, Eye, ChevronRight, ChevronLeft, User, MapPin, Phone, CreditCard, Package, PoundSterling } from 'lucide-react';

/**
 * SendContractModal - Modal for creating and sending contracts to customers
 * Includes pre-screen form to edit all contract details before sending
 */
const SendContractModal = ({
  isOpen,
  onClose,
  lead,
  packageData,
  invoiceData,
  onContractSent
}) => {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [contract, setContract] = useState(null);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);

  // Current step: 'edit' | 'review' | 'send'
  const [step, setStep] = useState('edit');

  // Editable contract details
  const [contractDetails, setContractDetails] = useState({
    // Customer details
    customerName: '',
    clientNameIfDifferent: '',
    address: '',
    postcode: '',
    phone: '',
    email: '',
    isVip: false,

    // Studio info
    studioNumber: '',
    photographer: '',
    invoiceNumber: '',

    // Order details
    digitalImages: true,
    digitalImagesQty: '',
    digitalZCard: false,
    efolio: false,
    efolioUrl: '',
    projectInfluencer: false,
    influencerLogin: '',
    influencerPassword: '',

    // Permissions
    allowImageUse: true,

    // Notes
    notes: '',

    // Payment
    subtotal: 0,
    vatAmount: 0,
    total: 0,
    paymentMethod: 'card',
    authCode: ''
  });

  // Initialize contract details from lead and package data
  useEffect(() => {
    if (isOpen && lead) {
      const price = packageData?.price || 0;
      const subtotal = invoiceData?.subtotal || price;
      const vatAmount = invoiceData?.vatAmount || (price * 0.2);
      const total = invoiceData?.total || (price * 1.2);

      setContractDetails({
        // Customer details from lead
        customerName: lead.name || '',
        clientNameIfDifferent: lead.parent_name || '',
        address: lead.address || '',
        postcode: lead.postcode || '',
        phone: lead.phone || '',
        email: lead.email || '',
        isVip: lead.is_vip || false,

        // Studio info
        studioNumber: invoiceData?.studioNumber || '',
        photographer: invoiceData?.photographer || '',
        invoiceNumber: invoiceData?.invoiceNumber || `INV-${Date.now().toString().slice(-8)}`,

        // Order details - detect from package
        digitalImages: true,
        digitalImagesQty: packageData?.imageCount || packageData?.image_count || 'All',
        digitalZCard: packageData?.includes?.some(i => i.toLowerCase().includes('z-card')) || false,
        efolio: packageData?.includes?.some(i => i.toLowerCase().includes('efolio') || i.toLowerCase().includes('e-folio')) || false,
        efolioUrl: '',
        projectInfluencer: packageData?.includes?.some(i => i.toLowerCase().includes('influencer')) || false,
        influencerLogin: '',
        influencerPassword: '',

        // Permissions
        allowImageUse: true,

        // Notes
        notes: `Package: ${packageData?.name || 'Standard Package'}`,

        // Payment
        subtotal: subtotal,
        vatAmount: vatAmount,
        total: total,
        paymentMethod: invoiceData?.paymentMethod || 'card',
        authCode: invoiceData?.authCode || ''
      });

      setContract(null);
      setEmailSent(false);
      setError(null);
      setCopied(false);
      setStep('edit');
    }
  }, [isOpen, lead, packageData, invoiceData]);

  // Update a single field
  const updateField = (field, value) => {
    setContractDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Recalculate totals when subtotal changes
  const updateSubtotal = (value) => {
    const subtotal = parseFloat(value) || 0;
    const vatAmount = subtotal * 0.2;
    const total = subtotal + vatAmount;
    setContractDetails(prev => ({
      ...prev,
      subtotal,
      vatAmount,
      total
    }));
  };

  // Create contract with edited details
  const createContract = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/contracts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          leadId: lead.id,
          packageId: packageData?.id,
          packageData: packageData,
          invoiceData: {
            ...invoiceData,
            ...contractDetails
          },
          contractDetails: contractDetails
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Contract creation error:', data);
        throw new Error(data.message || data.error || 'Failed to create contract');
      }

      // Handle both response formats: { contract: {...} } or { success: true, contract: {...} }
      const contractData = data.contract || (data.success && data.contract);
      
      console.log('Contract creation response:', { data, contractData });
      
      if (!contractData) {
        console.error('No contract returned from API:', data);
        throw new Error('Contract was not created - no contract data returned. Check console for details.');
      }

      if (!contractData.id || !contractData.signingUrl) {
        console.error('Contract data missing required fields:', contractData);
        throw new Error('Contract created but missing required fields (id or signingUrl)');
      }

      setContract(contractData);
      setStep('send');
      console.log('Contract created successfully, moving to send step');
    } catch (err) {
      console.error('Error creating contract:', err);
      setError(err.message || 'Failed to create contract. Please check the console for details.');
    } finally {
      setLoading(false);
    }
  };

  // Send contract via email
  const sendContractEmail = async () => {
    if (!contract || !contractDetails.email) return;

    setSending(true);
    setError(null);

    try {
      const response = await fetch(`/api/contracts/send/${contract.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          email: contractDetails.email
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send contract');
      }

      setEmailSent(true);
      onContractSent?.(contract);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  // Copy signing link to clipboard
  const copySigningLink = async () => {
    if (!contract?.signingUrl) return;

    try {
      await navigator.clipboard.writeText(contract.signingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = contract.signingUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return `£${parseFloat(amount || 0).toFixed(2)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {step === 'edit' && 'Edit Contract Details'}
                {step === 'review' && 'Review Contract'}
                {step === 'send' && 'Send Contract'}
              </h2>
              <p className="text-blue-100 text-sm">
                {lead?.name || 'Customer'} • {packageData?.name || 'Package'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-3 bg-gray-50 border-b flex items-center justify-center space-x-4 flex-shrink-0">
          <div className={`flex items-center space-x-2 ${step === 'edit' ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'edit' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>1</div>
            <span className="text-sm">Edit Details</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <div className={`flex items-center space-x-2 ${step === 'review' ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'review' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>2</div>
            <span className="text-sm">Review</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <div className={`flex items-center space-x-2 ${step === 'send' ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'send' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>3</div>
            <span className="text-sm">Send</span>
          </div>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-800 font-medium">Error</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Step 1: Edit Form */}
          {step === 'edit' && (
            <div className="space-y-6">
              {/* Customer Details Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <User className="w-4 h-4 mr-2 text-blue-500" />
                  CUSTOMER DETAILS
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Name (as in diary)</label>
                    <input
                      type="text"
                      value={contractDetails.customerName}
                      onChange={(e) => updateField('customerName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Client Name (if different)</label>
                    <input
                      type="text"
                      value={contractDetails.clientNameIfDifferent}
                      onChange={(e) => updateField('clientNameIfDifferent', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                    <input
                      type="text"
                      value={contractDetails.address}
                      onChange={(e) => updateField('address', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Postcode</label>
                    <input
                      type="text"
                      value={contractDetails.postcode}
                      onChange={(e) => updateField('postcode', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone / Mobile</label>
                    <input
                      type="tel"
                      value={contractDetails.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                    <input
                      type="email"
                      value={contractDetails.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-2 flex items-center">
                    <input
                      type="checkbox"
                      id="isVip"
                      checked={contractDetails.isVip}
                      onChange={(e) => updateField('isVip', e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="isVip" className="ml-2 text-sm text-gray-700">VIP Customer</label>
                  </div>
                </div>
              </div>

              {/* Studio Info Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <MapPin className="w-4 h-4 mr-2 text-purple-500" />
                  STUDIO INFO
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Studio No.</label>
                    <input
                      type="text"
                      value={contractDetails.studioNumber}
                      onChange={(e) => updateField('studioNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Photographer</label>
                    <input
                      type="text"
                      value={contractDetails.photographer}
                      onChange={(e) => updateField('photographer', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Invoice No.</label>
                    <input
                      type="text"
                      value={contractDetails.invoiceNumber}
                      onChange={(e) => updateField('invoiceNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Order Details Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <Package className="w-4 h-4 mr-2 text-green-500" />
                  ORDER DETAILS
                </h3>
                <div className="space-y-3">
                  {/* Digital Images */}
                  <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="digitalImages"
                        checked={contractDetails.digitalImages}
                        onChange={(e) => updateField('digitalImages', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="digitalImages" className="ml-2 text-sm text-gray-700">Digital Images</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <label className="text-xs text-gray-500">Qty:</label>
                      <input
                        type="text"
                        value={contractDetails.digitalImagesQty}
                        onChange={(e) => updateField('digitalImagesQty', e.target.value)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="All"
                      />
                    </div>
                  </div>

                  {/* Digital Z-Card */}
                  <div className="flex items-center bg-gray-50 p-3 rounded-lg">
                    <input
                      type="checkbox"
                      id="digitalZCard"
                      checked={contractDetails.digitalZCard}
                      onChange={(e) => updateField('digitalZCard', e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="digitalZCard" className="ml-2 text-sm text-gray-700">Digital Z-Card</label>
                  </div>

                  {/* E-Folio */}
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        id="efolio"
                        checked={contractDetails.efolio}
                        onChange={(e) => updateField('efolio', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="efolio" className="ml-2 text-sm text-gray-700">E-Folio</label>
                    </div>
                    {contractDetails.efolio && (
                      <input
                        type="text"
                        value={contractDetails.efolioUrl}
                        onChange={(e) => updateField('efolioUrl', e.target.value)}
                        placeholder="E-Folio URL"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    )}
                  </div>

                  {/* Project Influencer */}
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        id="projectInfluencer"
                        checked={contractDetails.projectInfluencer}
                        onChange={(e) => updateField('projectInfluencer', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="projectInfluencer" className="ml-2 text-sm text-gray-700">Project Influencer</label>
                    </div>
                    {contractDetails.projectInfluencer && (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={contractDetails.influencerLogin}
                          onChange={(e) => updateField('influencerLogin', e.target.value)}
                          placeholder="Login"
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <input
                          type="text"
                          value={contractDetails.influencerPassword}
                          onChange={(e) => updateField('influencerPassword', e.target.value)}
                          placeholder="Password"
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    )}
                  </div>

                  {/* Permission */}
                  <div className="flex items-center bg-gray-50 p-3 rounded-lg">
                    <input
                      type="checkbox"
                      id="allowImageUse"
                      checked={contractDetails.allowImageUse}
                      onChange={(e) => updateField('allowImageUse', e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="allowImageUse" className="ml-2 text-sm text-gray-700">Allow image use for marketing</label>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea
                  value={contractDetails.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Additional notes for the contract..."
                />
              </div>

              {/* Payment Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <PoundSterling className="w-4 h-4 mr-2 text-yellow-500" />
                  PAYMENT DETAILS
                </h3>
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Subtotal (excl VAT)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                        <input
                          type="number"
                          step="0.01"
                          value={contractDetails.subtotal}
                          onChange={(e) => updateSubtotal(e.target.value)}
                          className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">VAT (20%)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                        <input
                          type="text"
                          value={contractDetails.vatAmount.toFixed(2)}
                          readOnly
                          className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-100 text-gray-600"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Total</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                        <input
                          type="text"
                          value={contractDetails.total.toFixed(2)}
                          readOnly
                          className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-100 font-semibold text-gray-800"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
                      <select
                        value={contractDetails.paymentMethod}
                        onChange={(e) => updateField('paymentMethod', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="card">Card</option>
                        <option value="cash">Cash</option>
                        <option value="finance">Finance</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Auth Code (if applicable)</label>
                      <input
                        type="text"
                        value={contractDetails.authCode}
                        onChange={(e) => updateField('authCode', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Card auth code"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Review */}
          {step === 'review' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center space-x-2 text-blue-700 mb-2">
                  <Eye className="w-5 h-5" />
                  <span className="font-medium">Review Contract Details</span>
                </div>
                <p className="text-sm text-blue-600">
                  Please review the contract details below before creating. Once created, these details will be overlaid on the PDF contract.
                </p>
              </div>

              {/* Customer Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-2 flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Customer Details
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">Name:</span> <span className="font-medium">{contractDetails.customerName}</span></div>
                  {contractDetails.clientNameIfDifferent && (
                    <div><span className="text-gray-500">Client:</span> <span className="font-medium">{contractDetails.clientNameIfDifferent}</span></div>
                  )}
                  <div className="col-span-2"><span className="text-gray-500">Address:</span> <span className="font-medium">{contractDetails.address}</span></div>
                  <div><span className="text-gray-500">Postcode:</span> <span className="font-medium">{contractDetails.postcode}</span></div>
                  <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{contractDetails.phone}</span></div>
                  <div className="col-span-2"><span className="text-gray-500">Email:</span> <span className="font-medium">{contractDetails.email}</span></div>
                  {contractDetails.isVip && <div className="col-span-2"><span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs">VIP</span></div>}
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-2 flex items-center">
                  <Package className="w-4 h-4 mr-2" />
                  Order Details
                </h4>
                <div className="text-sm space-y-1">
                  <div className="flex items-center space-x-2">
                    {contractDetails.digitalImages ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-gray-300" />}
                    <span>Digital Images: {contractDetails.digitalImagesQty}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {contractDetails.digitalZCard ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-gray-300" />}
                    <span>Digital Z-Card</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {contractDetails.efolio ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-gray-300" />}
                    <span>E-Folio {contractDetails.efolioUrl && `(${contractDetails.efolioUrl})`}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {contractDetails.projectInfluencer ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-gray-300" />}
                    <span>Project Influencer</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {contractDetails.allowImageUse ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-gray-300" />}
                    <span>Permission for image use</span>
                  </div>
                </div>
                {contractDetails.notes && (
                  <div className="mt-2 pt-2 border-t text-sm">
                    <span className="text-gray-500">Notes:</span> <span>{contractDetails.notes}</span>
                  </div>
                )}
              </div>

              {/* Payment Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-2 flex items-center">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Payment Details
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal:</span>
                    <span>{formatCurrency(contractDetails.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">VAT (20%):</span>
                    <span>{formatCurrency(contractDetails.vatAmount)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-base border-t pt-1 mt-1">
                    <span>Total:</span>
                    <span>{formatCurrency(contractDetails.total)}</span>
                  </div>
                  <div className="pt-2">
                    <span className="text-gray-500">Payment Method:</span>{' '}
                    <span className="capitalize">{contractDetails.paymentMethod}</span>
                    {contractDetails.authCode && <span className="text-gray-400 ml-2">(Auth: {contractDetails.authCode})</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Send */}
          {step === 'send' && (
            <div>
              {!contract ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center space-x-2 text-yellow-700 mb-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium">Contract Data Missing</span>
                  </div>
                  <p className="text-sm text-yellow-600">
                    The contract was created but data is missing. Please check the console for details.
                  </p>
                </div>
              ) : (
                <>
              {/* Contract created success */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-2 text-green-700 mb-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Contract Created Successfully</span>
                </div>
                <p className="text-sm text-green-600">
                  The contract is ready to be sent to the customer.
                </p>
              </div>

              {/* Email input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Email
                </label>
                <input
                  type="email"
                  value={contractDetails.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="customer@email.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Send email button */}
              {!emailSent ? (
                <button
                  onClick={sendContractEmail}
                  disabled={sending || !contractDetails.email}
                  className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                >
                  {sending ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5" />
                      <span>Send Contract via Email</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="bg-green-100 border border-green-300 rounded-lg p-4 text-center">
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="font-medium text-green-800">Email Sent!</p>
                  <p className="text-sm text-green-600">
                    Contract sent to {contractDetails.email}
                  </p>
                </div>
              )}

              {/* Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or</span>
                </div>
              </div>

              {/* Copy link section */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Share Signing Link Manually
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={contract?.signingUrl || ''}
                    readOnly
                    className="flex-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-600"
                  />
                  <button
                    onClick={copySigningLink}
                    className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-1"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-green-600" />
                        <span className="text-green-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-gray-600" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>Link expires in 7 days</span>
                </p>
              </div>

              {/* Open signing page link */}
              {contract?.signingUrl && (
                <a
                  href={contract.signingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 w-full py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Preview Signing Page</span>
                </a>
              )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-between flex-shrink-0">
          <div>
            {step !== 'edit' && step !== 'send' && (
              <button
                onClick={() => setStep(step === 'review' ? 'edit' : 'review')}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            )}
            {step === 'send' && !emailSent && (
              <button
                onClick={() => setStep('edit')}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-1"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit Details</span>
              </button>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {emailSent ? 'Done' : 'Cancel'}
            </button>

            {step === 'edit' && (
              <button
                onClick={() => setStep('review')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-1"
              >
                <span>Review</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 'review' && (
              <button
                onClick={createContract}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    <span>Create Contract</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SendContractModal;
