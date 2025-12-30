/**
 * Contracts API Routes
 * Handles contract creation, sending, signing, and PDF generation
 * For Edge Talent Invoice & Order Form contracts
 */

const express = require('express');
const { auth } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { generateContractPDF, buildContractData } = require('../utils/contractGenerator');
const cloudinaryService = require('../utils/cloudinaryService');

const router = express.Router();
const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey || config.supabase.anonKey);

/**
 * Generate a unique contract token
 */
function generateContractToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create email transporter
 */
function createEmailTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

/**
 * @route   POST /api/contracts/create
 * @desc    Create a new contract for a lead with package details
 * @access  Private (Viewer, Admin)
 */
router.post('/create', auth, async (req, res) => {
  try {
    if (!['viewer', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only viewers and admins can create contracts' });
    }

    const { leadId, packageId, packageData, invoiceData, contractDetails } = req.body;

    if (!leadId) {
      return res.status(400).json({ message: 'Lead ID is required' });
    }

    // Get lead data
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Use contractDetails from the pre-screen form if provided, otherwise build from lead/package
    let contractData;

    if (contractDetails) {
      // Use the edited contract details from the pre-screen form
      contractData = {
        // Dates - convert to ISO strings for JSONB storage
        date: new Date().toISOString(),
        signedAt: null,

        // Customer details from edited form
        customerNumber: lead.id?.toString().slice(-6) || '',
        customerName: contractDetails.customerName || lead.name || '',
        clientNameIfDifferent: contractDetails.clientNameIfDifferent || '',
        address: contractDetails.address || '',
        postcode: contractDetails.postcode || '',
        phone: contractDetails.phone || '',
        email: contractDetails.email || '',
        isVip: contractDetails.isVip || false,

        // Studio info from edited form
        studioNumber: contractDetails.studioNumber || '',
        photographer: contractDetails.photographer || '',
        invoiceNumber: contractDetails.invoiceNumber || `INV-${Date.now().toString().slice(-8)}`,

        // Order details from edited form
        digitalImages: contractDetails.digitalImages ?? true,
        digitalImagesQty: contractDetails.digitalImagesQty || 'All',
        digitalZCard: contractDetails.digitalZCard || false,
        efolio: contractDetails.efolio || false,
        efolioUrl: contractDetails.efolioUrl || '',
        projectInfluencer: contractDetails.projectInfluencer || false,
        influencerLogin: contractDetails.influencerLogin || '',
        influencerPassword: contractDetails.influencerPassword || '',

        // Permissions from edited form
        allowImageUse: contractDetails.allowImageUse ?? true,
        imagesReceived: 'N.A',

        // Notes from edited form
        notes: contractDetails.notes || '',

        // Financials from edited form
        subtotal: contractDetails.subtotal || 0,
        vatAmount: contractDetails.vatAmount || 0,
        total: contractDetails.total || 0,

        // Payment from edited form
        paymentMethod: contractDetails.paymentMethod || 'card',
        authCode: contractDetails.authCode || '',
        viewerInitials: '',

        // Signatures (to be filled when signed)
        signatures: {
          main: null,
          notAgency: null,
          noCancel: null,
          passDetails: null,
          happyPurchase: null
        }
      };
    } else {
      // Fallback: Build contract data from lead and package
      let pkg = packageData;
      if (packageId && !packageData) {
        const { data: pkgData, error: pkgError } = await supabase
          .from('packages')
          .select('*')
          .eq('id', packageId)
          .single();

        if (!pkgError && pkgData) {
          pkg = pkgData;
        }
      }
      contractData = buildContractData(lead, pkg || {}, invoiceData || {});
      // Ensure date is serialized as ISO string
      if (contractData.date && contractData.date instanceof Date) {
        contractData.date = contractData.date.toISOString();
      }
      if (contractData.signedAt && contractData.signedAt instanceof Date) {
        contractData.signedAt = contractData.signedAt.toISOString();
      }
    }

    // Generate contract token
    const contractToken = generateContractToken();

    // Determine base URL for signing link
    // Priority: FRONTEND_URL > CLIENT_URL > RAILWAY_PUBLIC_DOMAIN > production default > localhost
    let baseUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL;

    if (!baseUrl && process.env.RAILWAY_PUBLIC_DOMAIN) {
      baseUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
    }

    if (!baseUrl) {
      // Default to production URL if in production, otherwise localhost
      baseUrl = process.env.NODE_ENV === 'production'
        ? 'https://crm.edgetalent.co.uk'
        : 'http://localhost:3000';
    }

    // Ensure URL doesn't have trailing slash
    baseUrl = baseUrl.replace(/\/$/, '');

    const signingUrl = `${baseUrl}/sign-contract/${contractToken}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    console.log('📝 Contract signing URL base:', baseUrl);

    // Ensure contract_data is properly serialized (no Date objects, functions, etc.)
    const serializedContractData = JSON.parse(JSON.stringify(contractData));

    // Create contract record
    console.log('Creating contract with data:', {
      lead_id: leadId,
      package_id: packageId || null,
      contract_token: contractToken.substring(0, 10) + '...',
      signing_url: signingUrl,
      expires_at: expiresAt.toISOString(),
      status: 'draft',
      contract_data_keys: Object.keys(serializedContractData),
      created_by: req.user.id,
      baseUrl: baseUrl
    });

    const { data: contract, error: createError } = await supabase
      .from('contracts')
      .insert({
        lead_id: leadId,
        package_id: packageId || null,
        contract_token: contractToken,
        signing_url: signingUrl,
        expires_at: expiresAt.toISOString(),
        status: 'draft',
        contract_data: serializedContractData, // Use serialized version
        created_by: req.user.id
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating contract:', createError);
      console.error('Full error details:', JSON.stringify(createError, null, 2));
      return res.status(500).json({ 
        message: 'Failed to create contract', 
        error: createError.message,
        details: createError.details || createError.hint || 'No additional details available'
      });
    }

    if (!contract) {
      console.error('❌ Contract insert returned no data');
      return res.status(500).json({ message: 'Failed to create contract - no data returned' });
    }

    console.log(`Contract created for lead ${lead.name}: ${contract.id}`);

    res.json({
      success: true,
      message: 'Contract created',
      contract: {
        id: contract.id,
        signingUrl: signingUrl,
        expiresAt: expiresAt.toISOString(),
        status: contract.status
      }
    });
  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/contracts/send/:contractId
 * @desc    Send contract signing link via email
 * @access  Private (Viewer, Admin)
 */
router.post('/send/:contractId', auth, async (req, res) => {
  try {
    if (!['viewer', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only viewers and admins can send contracts' });
    }

    const { contractId } = req.params;
    const { email: overrideEmail } = req.body;

    // Get contract with lead data
    const { data: contract, error: fetchError } = await supabase
      .from('contracts')
      .select(`
        *,
        lead:leads(id, name, email, phone)
      `)
      .eq('id', contractId)
      .single();

    if (fetchError || !contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    if (contract.status === 'signed') {
      return res.status(400).json({ message: 'Contract is already signed' });
    }

    // Determine recipient email
    const recipientEmail = overrideEmail || contract.contract_data?.email || contract.lead?.email;
    if (!recipientEmail) {
      return res.status(400).json({ message: 'No email address available' });
    }

    const customerName = contract.contract_data?.customerName || contract.lead?.name || 'Customer';

    // Send email
    try {
      const transporter = createEmailTransporter();

      // Get contract details for email
      const contractData = contract.contract_data || {};
      const totalAmount = contractData.total ? `£${parseFloat(contractData.total).toFixed(2)}` : '';
      const packageInfo = contractData.notes || '';

      const mailOptions = {
        from: `"Edge Talent" <${process.env.SMTP_FROM || process.env.SMTP_USER || 'hello@edgetalent.co.uk'}>`,
        to: recipientEmail,
        subject: `Edge Talent - Your Contract is Ready for Signing`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
              .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
              .header { background: #1a1a2e; padding: 30px 20px; text-align: center; }
              .header h1 { color: #ffffff; margin: 0; font-size: 28px; letter-spacing: 3px; }
              .header p { color: #cccccc; margin: 5px 0 0 0; font-size: 14px; }
              .content { padding: 40px 30px; }
              .greeting { font-size: 18px; margin-bottom: 20px; }
              .intro { margin-bottom: 25px; color: #555; }
              .button-container { text-align: center; margin: 30px 0; }
              .button { display: inline-block; background: #1a1a2e; color: #ffffff !important; padding: 16px 50px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; }
              .button:hover { background: #2a2a4e; }
              .instructions { background: #f8f9fa; border-radius: 8px; padding: 25px; margin: 25px 0; }
              .instructions h3 { color: #1a1a2e; margin-top: 0; margin-bottom: 15px; font-size: 16px; }
              .instructions ol { margin: 0; padding-left: 20px; color: #555; }
              .instructions li { margin-bottom: 10px; }
              .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
              .warning strong { color: #856404; }
              .link-backup { background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0; word-break: break-all; font-size: 13px; color: #666; }
              .order-summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .order-summary h4 { margin: 0 0 10px 0; color: #1a1a2e; }
              .order-summary p { margin: 5px 0; color: #555; }
              .footer { background: #f5f5f5; padding: 25px; text-align: center; color: #888; font-size: 12px; }
              .footer p { margin: 5px 0; }
              .contact { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>EDGE TALENT</h1>
                <p>Professional Photography Services</p>
              </div>
              <div class="content">
                <p class="greeting">Dear ${customerName},</p>

                <p class="intro">Thank you for choosing Edge Talent! Your contract is ready for review and signing. Please complete this within 7 days to confirm your order.</p>

                ${totalAmount ? `
                <div class="order-summary">
                  <h4>Order Summary</h4>
                  <p><strong>Total Amount:</strong> ${totalAmount} (inc. VAT)</p>
                  ${packageInfo ? `<p><strong>Details:</strong> ${packageInfo}</p>` : ''}
                </div>
                ` : ''}

                <div class="button-container">
                  <a href="${contract.signing_url}" class="button">Review & Sign Contract</a>
                </div>

                <div class="instructions">
                  <h3>How to Complete Your Contract:</h3>
                  <ol>
                    <li><strong>Click the button above</strong> to open your contract</li>
                    <li><strong>Review the PDF</strong> - Check all your details are correct</li>
                    <li><strong>Scroll down</strong> to view the contract details and terms</li>
                    <li><strong>Sign in the signature boxes</strong> - Use your mouse or finger to sign</li>
                    <li><strong>Tick the confirmation boxes</strong> to acknowledge the terms</li>
                    <li><strong>Click "Sign Contract"</strong> to submit</li>
                  </ol>
                </div>

                <div class="warning">
                  <strong>⏰ Important:</strong> This link will expire in 7 days. Please complete your signing before then. If you have any issues, contact us immediately.
                </div>

                <p>If the button above doesn't work, copy and paste this link into your browser:</p>
                <div class="link-backup">${contract.signing_url}</div>

                <div class="contact">
                  <p>Need help or have questions? Contact us:</p>
                  <p>📧 Email: <a href="mailto:hello@edgetalent.co.uk">hello@edgetalent.co.uk</a></p>
                  <p>🌐 Website: <a href="https://www.edgetalent.co.uk">www.edgetalent.co.uk</a></p>
                </div>
              </div>
              <div class="footer">
                <p><strong>Edge Talent</strong></p>
                <p>A trading name of S&A Advertising Ltd</p>
                <p>Company No 8708429 | VAT Reg No 171339904</p>
                <p>129A Weedington Rd, London NW5 4NX</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
Dear ${customerName},

Thank you for choosing Edge Talent! Your contract is ready for review and signing.

${totalAmount ? `Order Total: ${totalAmount} (inc. VAT)` : ''}
${packageInfo ? `Details: ${packageInfo}` : ''}

HOW TO COMPLETE YOUR CONTRACT:
================================

1. Click the link below to open your contract
2. Review the PDF - Check all your details are correct
3. Scroll down to view the contract details and terms
4. Sign in the signature boxes using your mouse or finger
5. Tick the confirmation boxes to acknowledge the terms
6. Click "Sign Contract" to submit

SIGN YOUR CONTRACT HERE:
${contract.signing_url}

⏰ IMPORTANT: This link will expire in 7 days. Please complete your signing before then.

Need help? Contact us:
Email: hello@edgetalent.co.uk
Website: www.edgetalent.co.uk

---
Edge Talent
A trading name of S&A Advertising Ltd
Company No 8708429 | VAT Reg No 171339904
129A Weedington Rd, London NW5 4NX
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`Contract email sent to ${recipientEmail} from hello@edgetalent.co.uk`);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Continue even if email fails - URL can still be shared manually
    }

    // Update contract status
    await supabase
      .from('contracts')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_to_email: recipientEmail
      })
      .eq('id', contractId);

    res.json({
      success: true,
      message: 'Contract sent successfully',
      sentTo: recipientEmail,
      signingUrl: contract.signing_url
    });
  } catch (error) {
    console.error('Error sending contract:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/contracts/verify/:token
 * @desc    Verify contract token and get contract for signing (public route)
 * @access  Public
 */
router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ message: 'Contract token is required' });
    }

    // Find contract by token
    const { data: contract, error } = await supabase
      .from('contracts')
      .select(`
        id,
        contract_token,
        signing_url,
        expires_at,
        status,
        contract_data,
        lead:leads(id, name, email, phone)
      `)
      .eq('contract_token', token)
      .single();

    if (error || !contract) {
      return res.status(404).json({ message: 'Invalid or expired contract link' });
    }

    // Check if expired
    if (new Date(contract.expires_at) < new Date()) {
      return res.status(410).json({ message: 'This contract link has expired' });
    }

    // Check if already signed
    if (contract.status === 'signed') {
      return res.status(400).json({ message: 'This contract has already been signed' });
    }

    // Return contract data for signing page
    res.json({
      success: true,
      contract: {
        id: contract.id,
        status: contract.status,
        expiresAt: contract.expires_at,
        data: contract.contract_data
      }
    });
  } catch (error) {
    console.error('Error verifying contract:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/contracts/preview/:token
 * @desc    Generate and return PDF preview for contract (public route)
 * @access  Public
 */
router.get('/preview/:token', async (req, res) => {
  // Helper to return HTML error page (for iframe display)
  const sendHtmlError = (status, title, message) => {
    res.status(status).setHeader('Content-Type', 'text/html').send(`
      <!DOCTYPE html>
      <html>
      <head><title>${title}</title></head>
      <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
        <h1 style="color: #dc2626;">${title}</h1>
        <p style="color: #666;">${message}</p>
      </body>
      </html>
    `);
  };

  try {
    const { token } = req.params;
    console.log('📄 PDF Preview requested for token:', token?.substring(0, 10) + '...');

    if (!token) {
      return sendHtmlError(400, 'Invalid Request', 'Contract token is required');
    }

    // Find contract by token
    const { data: contract, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('contract_token', token)
      .single();

    if (error) {
      console.error('Database error fetching contract:', error);
      return sendHtmlError(404, 'Contract Not Found', 'The contract could not be found in the database.');
    }

    if (!contract) {
      return sendHtmlError(404, 'Contract Not Found', 'Invalid or expired contract link.');
    }

    console.log('📄 Found contract, generating PDF...');
    console.log('Contract data keys:', Object.keys(contract.contract_data || {}));

    // Generate PDF
    const pdfBuffer = await generateContractPDF(contract.contract_data);

    console.log('✅ PDF generated successfully, size:', pdfBuffer.length, 'bytes');

    // Set headers for PDF display
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="contract_${contract.id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('❌ Error generating PDF preview:', error);
    console.error('Stack:', error.stack);
    sendHtmlError(500, 'PDF Generation Failed', `Error: ${error.message}`);
  }
});

/**
 * @route   POST /api/contracts/sign/:token
 * @desc    Submit signatures for a contract (public route)
 * @access  Public
 */
router.post('/sign/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { signatures, updatedData } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Contract token is required' });
    }

    if (!signatures || !signatures.main) {
      return res.status(400).json({ message: 'Main signature is required' });
    }

    // Verify contract exists and is valid
    const { data: contract, error: fetchError } = await supabase
      .from('contracts')
      .select('*')
      .eq('contract_token', token)
      .single();

    if (fetchError || !contract) {
      return res.status(404).json({ message: 'Invalid contract link' });
    }

    if (contract.status === 'signed') {
      return res.status(400).json({ message: 'This contract has already been signed' });
    }

    if (new Date(contract.expires_at) < new Date()) {
      return res.status(410).json({ message: 'This contract link has expired' });
    }

    // Merge signatures and any updated data into contract data
    const signedContractData = {
      ...contract.contract_data,
      ...updatedData,
      signatures: signatures,
      signedAt: new Date().toISOString()
    };

    // Generate signed PDF
    let pdfUrl = null;
    try {
      const pdfBuffer = await generateContractPDF(signedContractData);

      // Upload to Cloudinary
      const uploadResult = await cloudinaryService.uploadMedia(
        pdfBuffer,
        'raw',
        {
          folder: `crm/contracts/${new Date().getFullYear()}`,
          public_id: `contract_${contract.id}_${Date.now()}`,
          resource_type: 'raw'
        }
      );

      if (uploadResult.success) {
        pdfUrl = uploadResult.secure_url;
      }
    } catch (pdfError) {
      console.error('Error generating PDF:', pdfError);
      // Continue even if PDF fails - signature is still valid
    }

    // Update contract with signatures
    const { data: updated, error: updateError } = await supabase
      .from('contracts')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        contract_data: signedContractData,
        signed_pdf_url: pdfUrl
      })
      .eq('id', contract.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error saving signature:', updateError);
      return res.status(500).json({ message: 'Failed to save signature', error: updateError.message });
    }

    console.log(`Contract ${contract.id} signed successfully`);

    // Send confirmation email to customer
    try {
      const transporter = createEmailTransporter();
      const customerEmail = signedContractData.email;
      const customerName = signedContractData.customerName;

      if (customerEmail) {
        await transporter.sendMail({
          from: `"Edge Talent" <${process.env.SMTP_USER || 'noreply@edgetalent.co.uk'}>`,
          to: customerEmail,
          subject: 'Your Edge Talent Contract - Signed Successfully',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #1a1a2e;">Thank You, ${customerName}!</h1>
              <p>Your contract has been signed successfully.</p>
              ${pdfUrl ? `<p><a href="${pdfUrl}" style="color: #1a1a2e;">Click here to download your signed contract</a></p>` : ''}
              <p>If you have any questions, please contact us at <a href="mailto:sales@edgetalent.co.uk">sales@edgetalent.co.uk</a></p>
              <hr style="margin: 20px 0;">
              <p style="color: #888; font-size: 12px;">Edge Talent | 129A Weedington Rd, London NW5 4NX</p>
            </div>
          `
        });
      }
    } catch (emailError) {
      console.error('Confirmation email failed:', emailError);
    }

    res.json({
      success: true,
      message: 'Contract signed successfully',
      contractId: contract.id,
      signedAt: updated.signed_at,
      pdfUrl: pdfUrl
    });
  } catch (error) {
    console.error('Error signing contract:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/contracts/lead/:leadId
 * @desc    Get all contracts for a lead
 * @access  Private
 */
router.get('/lead/:leadId', auth, async (req, res) => {
  try {
    const { leadId } = req.params;

    const { data: contracts, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ message: 'Failed to fetch contracts', error: error.message });
    }

    res.json({
      success: true,
      contracts: contracts.map(c => ({
        id: c.id,
        status: c.status,
        createdAt: c.created_at,
        sentAt: c.sent_at,
        signedAt: c.signed_at,
        expiresAt: c.expires_at,
        signingUrl: c.signing_url,
        pdfUrl: c.signed_pdf_url,
        packageName: c.contract_data?.notes || 'Contract'
      }))
    });
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/contracts/:contractId
 * @desc    Get contract details
 * @access  Private
 */
router.get('/:contractId', auth, async (req, res) => {
  try {
    const { contractId } = req.params;

    const { data: contract, error } = await supabase
      .from('contracts')
      .select(`
        *,
        lead:leads(id, name, email, phone)
      `)
      .eq('id', contractId)
      .single();

    if (error || !contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    res.json({
      success: true,
      contract: {
        id: contract.id,
        leadId: contract.lead_id,
        lead: contract.lead,
        status: contract.status,
        createdAt: contract.created_at,
        sentAt: contract.sent_at,
        signedAt: contract.signed_at,
        expiresAt: contract.expires_at,
        signingUrl: contract.signing_url,
        pdfUrl: contract.signed_pdf_url,
        data: contract.contract_data
      }
    });
  } catch (error) {
    console.error('Error fetching contract:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   DELETE /api/contracts/:contractId
 * @desc    Delete/cancel a contract
 * @access  Private (Admin only)
 */
router.delete('/:contractId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can delete contracts' });
    }

    const { contractId } = req.params;

    const { error } = await supabase
      .from('contracts')
      .delete()
      .eq('id', contractId);

    if (error) {
      return res.status(500).json({ message: 'Failed to delete contract', error: error.message });
    }

    res.json({ success: true, message: 'Contract deleted' });
  } catch (error) {
    console.error('Error deleting contract:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/contracts/:contractId/pdf
 * @desc    Generate/download contract PDF
 * @access  Private
 */
router.get('/:contractId/pdf', auth, async (req, res) => {
  try {
    const { contractId } = req.params;

    const { data: contract, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single();

    if (error || !contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    // Generate PDF
    const pdfBuffer = await generateContractPDF(contract.contract_data);

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contract_${contractId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ message: 'Failed to generate PDF', error: error.message });
  }
});

module.exports = router;
