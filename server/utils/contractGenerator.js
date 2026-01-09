/**
 * Contract Generator Utility
 * Uses Puppeteer to render HTML to PDF - guarantees exact visual match
 * with what the user sees when signing
 */

const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

// Initialize Supabase client
const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey || config.supabase.anonKey);

// Default template values (fallback if no custom template exists)
const DEFAULT_TEMPLATE = {
  company_name: 'EDGE TALENT',
  company_website: 'www.edgetalent.co.uk',
  company_address: '129A Weedington Rd, London NW5 4NX',
  form_title: 'INVOICE & ORDER FORM',
  form_subtitle: 'PLEASE CHECK YOUR ORDER BEFORE LEAVING YOUR VIEWING',
  form_contact_info: 'FOR ALL ENQUIRIES PLEASE EMAIL CUSTOMER SERVICES ON SALES@EDGETALENT.CO.UK',
  terms_and_conditions: `By signing this invoice, you confirm that you have viewed, selected and approved all images and all cropping, editing and adjustments. You understand that all orders are final and due to the immediate nature of digital delivery this order is strictly non-refundable, non-cancellable and non-amendable once you leave the premises, without affecting your statutory rights. All digital products, including images, efolios and Z-cards and Project Influencer are delivered immediately upon full payment. Project Influencer has been added to this order as a complimentary addition to your purchased package and holds no independent monetary value. By signing you accept responsibility for downloading, backing up and securely storing your files once they are provided. Finance customers must complete all Payl8r documentation prior to receipt of goods. Efolios include 10 images and hosting for 1 year, which may require renewal thereafter; content may be removed if renewal fees are unpaid. You own the copyright to all images purchased and unless you opt out in writing at the time of signing, Edge Talent may use your images for promotional purposes (above) including, but not limited to, display on its website and social media channels. You acknowledge that Edge Talent is not a talent casting company/agency and does not guarantee work, representation or casting opportunities. Edge Talent accepts no liability for compatibility issues, loss of files after delivery, missed opportunities, or indirect losses and total liability is limited to the amount paid for your order. All personal data is processed in accordance with GDPR and used only to fulfil your order or meet legal requirements. By signing below, you acknowledge that you have read, understood and agree to these Terms & Conditions. For any post-delivery assistance, please contact sales@edgetalent.co.uk`,
  signature_instruction: 'PLEASE SIGN BELOW TO INDICATE YOUR ACCEPTANCE OF THE ABOVE TERMS, AND ENSURE YOU RECEIVE YOUR OWN SIGNED COPY OF THIS INVOICE FOR YOUR RECORDS',
  footer_line1: 'Edge Talent is a trading name of S&A Advertising Ltd',
  footer_line2: 'Company No 8708429 VAT Reg No 171339904',
  confirmation1_text: 'I understand that Edge Talent is <strong>not a talent casting company/agency and will not find me work.</strong>',
  confirmation2_text: 'I understand that once I leave the premises I <strong>cannot cancel</strong>, amend or reduce the order.',
  confirmation3_text: 'I confirm that I am happy for Edge Talent to <strong>pass on details and photos</strong> of the client named on this order form. Talent Agencies we pass your details to typically charge between £50 - £200 to register onto their books',
  confirmation4_text: "I confirm that I'm happy and comfortable with my decision to purchase.",
  image_permission_text: 'I give permission for Edge Talent to use my images',
  image_no_permission_text: 'I DO NOT give permission for Edge Talent to use my images'
};

/**
 * Get active contract template from database or return defaults
 */
async function getActiveTemplate() {
  try {
    const { data: template, error } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn('Error fetching contract template, using defaults:', error.message);
      return DEFAULT_TEMPLATE;
    }

    return template || DEFAULT_TEMPLATE;
  } catch (err) {
    console.warn('Error fetching contract template, using defaults:', err.message);
    return DEFAULT_TEMPLATE;
  }
}

/**
 * Format currency value
 */
function formatCurrency(amount, currency = 'GBP') {
  const symbols = { GBP: '£', USD: '$', EUR: '€' };
  const symbol = symbols[currency] || '£';
  return `${symbol}${parseFloat(amount || 0).toFixed(2)}`;
}

/**
 * Format date as DD/MM/YYYY
 */
function formatDate(date) {
  const d = new Date(date || new Date());
  return d.toLocaleDateString('en-GB');
}

/**
 * Generate the HTML for the contract (matches ContractSigning.js exactly)
 * @param {Object} contractData - The contract data with customer info, financials, signatures
 * @param {Object} template - Optional custom template (if not provided, uses DEFAULT_TEMPLATE)
 */
function generateContractHTML(contractData, template = DEFAULT_TEMPLATE) {
  // Merge with defaults to ensure all values exist
  const t = { ...DEFAULT_TEMPLATE, ...template };

  // Generate image permission text based on allowImageUse flag
  const imagePermissionText = contractData.allowImageUse
    ? `I <strong>DO</strong> ${t.image_permission_text || 'give permission for Edge Talent to use my images'}`
    : `I <strong>DO NOT</strong> ${(t.image_no_permission_text || 'give permission for Edge Talent to use my images').replace('I DO NOT ', '')}`;

  const page1HTML = `
    <div class="page" style="padding: 30px; font-family: Arial, sans-serif; font-size: 11px; background: white;">
      <!-- Header -->
      <div data-editable="header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
        <p style="font-size: 10px; margin: 0;">${t.company_website}</p>
        <div style="text-align: center;">
          <h1 style="font-size: 28px; font-weight: bold; letter-spacing: 3px; margin: 0;">${t.company_name}</h1>
          <p style="font-size: 10px; margin: 3px 0 0 0;">${t.company_address}</p>
        </div>
        <div style="border: 1px solid black; padding: 8px 15px;">
          <span style="font-size: 10px;">Date: </span>
          <span style="font-weight: 500;">${formatDate(contractData.date)}</span>
        </div>
      </div>

      <!-- Title -->
      <div data-editable="title" style="text-align: center; margin-bottom: 15px;">
        <h2 style="font-size: 18px; font-weight: bold; margin: 0 0 5px 0;">${t.form_title}</h2>
        <p style="font-size: 9px; margin: 2px 0;">${t.form_subtitle}</p>
        <p style="font-size: 9px; margin: 2px 0;">${t.form_contact_info}</p>
      </div>

      <!-- Info Row -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid black; margin-bottom: 12px; font-size: 10px;">
        <tr>
          <td style="border-right: 1px solid black; padding: 6px; width: 25%;">
            <span style="color: #666;">Customer Nos.</span><br/>
            <span style="font-weight: 500;">${contractData.customerNumber || ''}</span>
          </td>
          <td style="border-right: 1px solid black; padding: 6px; width: 25%;">
            <span style="color: #666;">Studio no.</span><br/>
            <span style="font-weight: 500;">${contractData.studioNumber || ''}</span>
          </td>
          <td style="border-right: 1px solid black; padding: 6px; width: 25%;">
            <span style="color: #666;">Photographer</span><br/>
            <span style="font-weight: 500;">${contractData.photographer || ''}</span>
          </td>
          <td style="padding: 6px; width: 25%;">
            <span style="color: #666;">Invoice no.</span><br/>
            <span style="font-weight: 500;">${contractData.invoiceNumber || ''}</span>
          </td>
        </tr>
      </table>

      <!-- Customer Details -->
      <h3 style="font-weight: bold; margin: 0 0 5px 0; font-size: 12px;">CUSTOMER DETAILS</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid black; margin-bottom: 12px; font-size: 10px;">
        <tr style="border-bottom: 1px solid black;">
          <td style="padding: 6px;" colspan="3">
            <span style="color: #666;">NAME OF PERSON IN DIARY</span><br/>
            <span style="font-weight: 500;">${contractData.customerName || ''}</span>
          </td>
          <td style="border-left: 1px solid black; padding: 6px; text-align: center; width: 80px;">
            <span style="color: #666;">VIP?</span><br/>
            <span style="font-weight: 500;">${contractData.isVip ? 'YES' : 'NO'}</span>
          </td>
        </tr>
        <tr style="border-bottom: 1px solid black;">
          <td style="padding: 6px;" colspan="4">
            <span style="color: #666;">NAME OF CLIENT IF DIFFERENT</span><br/>
            <span style="font-weight: 500;">${contractData.clientNameIfDifferent || ''}</span>
          </td>
        </tr>
        <tr style="border-bottom: 1px solid black;">
          <td style="padding: 6px;" colspan="4">
            <span style="color: #666;">ADDRESS</span><br/>
            <span style="font-weight: 500;">${contractData.address || ''}</span>
          </td>
        </tr>
        <tr style="border-bottom: 1px solid black;">
          <td style="padding: 6px; text-align: right;" colspan="4">
            <span style="color: #666;">POSTCODE</span>
            <span style="font-weight: 500; margin-left: 8px;">${contractData.postcode || ''}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 6px; width: 50%;">
            <span style="color: #666;">PHONE/MOBILE NO.</span><br/>
            <span style="font-weight: 500;">${contractData.phone || ''}</span>
          </td>
          <td style="border-left: 1px solid black; padding: 6px;" colspan="3">
            <span style="color: #666;">EMAIL:</span><br/>
            <span style="font-weight: 500;">${contractData.email || ''}</span>
          </td>
        </tr>
      </table>

      <!-- Order Details with Totals -->
      <div style="display: flex; gap: 12px; margin-bottom: 8px;">
        <div style="flex: 1;">
          <h3 style="font-weight: bold; margin: 0 0 5px 0; font-size: 12px;">ORDER DETAILS</h3>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid black; font-size: 10px;">
            <tr style="border-bottom: 1px solid black;">
              <td style="padding: 5px; width: 120px;">DIGITAL IMAGES?</td>
              <td style="border-left: 1px solid black; padding: 5px; width: 60px; text-align: center;">${contractData.digitalImages ? 'YES' : 'NO'}</td>
              <td style="border-left: 1px solid black; padding: 5px;">QTY: <span style="font-weight: 500;">${contractData.digitalImagesQty || ''}</span></td>
            </tr>
            <tr style="border-bottom: 1px solid black;">
              <td style="padding: 5px;">DIGITAL Z-CARD?</td>
              <td style="border-left: 1px solid black; padding: 5px; text-align: center;">${contractData.digitalZCard ? 'YES' : 'NO'}</td>
              <td style="border-left: 1px solid black; padding: 5px; color: #666;">DIGITAL PDF ONLY</td>
            </tr>
            <tr style="border-bottom: 1px solid black;">
              <td style="padding: 5px;">EFOLIO?</td>
              <td style="border-left: 1px solid black; padding: 5px; text-align: center;">${contractData.efolio ? 'YES' : 'NO'}</td>
              <td style="border-left: 1px solid black; padding: 5px;">URL: <span style="font-weight: 500;">${contractData.efolioUrl || ''}</span></td>
            </tr>
            <tr style="border-bottom: 1px solid black;">
              <td style="padding: 5px;">PROJECT INFLUENCER?</td>
              <td style="border-left: 1px solid black; padding: 5px; text-align: center;">${contractData.projectInfluencer ? 'YES' : 'NO'}</td>
              <td style="border-left: 1px solid black; padding: 5px;">LOGIN: <span style="font-weight: 500;">${contractData.influencerLogin || ''}</span></td>
            </tr>
            <tr style="border-bottom: 1px solid black;">
              <td data-editable="image_permission" style="padding: 5px;" colspan="3">
                ${imagePermissionText}
              </td>
            </tr>
            <tr>
              <td style="padding: 5px;" colspan="2">Digital Images checked & received?</td>
              <td style="border-left: 1px solid black; padding: 5px; text-align: center;">N.A</td>
            </tr>
          </table>
        </div>
        <div style="width: 100px;">
          <table style="width: 100%; border-collapse: collapse; border: 1px solid black; font-size: 10px; height: 100%;">
            <tr style="border-bottom: 1px solid black;">
              <td style="padding: 8px; text-align: center;">
                <span style="color: #666;">SUB TOTAL</span><br/>
                <span style="font-weight: 500;">${formatCurrency(contractData.subtotal)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px; text-align: center;">
                <strong>TOTAL</strong><br/>
                <span style="font-weight: bold; font-size: 14px;">${formatCurrency(contractData.total)}</span>
              </td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Notes -->
      <div style="margin-bottom: 8px;">
        <span style="font-weight: bold; font-size: 10px;">NOTES:</span>
        <div style="border: 1px solid black; padding: 6px; min-height: 35px; font-size: 10px; margin-top: 3px;">${contractData.notes || ''}</div>
      </div>

      <!-- Terms -->
      <div data-editable="terms" style="font-size: 8px; color: #444; margin-bottom: 10px; line-height: 1.3;">
        <strong>Terms and Conditions:</strong> ${t.terms_and_conditions}
      </div>

      <!-- Payment Details -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid black; margin-bottom: 10px; font-size: 10px;">
        <tr style="border-bottom: 1px solid black;">
          <td style="padding: 5px; border-right: 1px solid black; width: 100px;">PAYMENT DETAILS</td>
          <td style="padding: 5px; border-right: 1px solid black; text-align: center; width: 100px;">CREDIT/DEBIT CARD</td>
          <td style="padding: 5px; border-right: 1px solid black; text-align: center; width: 50px;">CASH</td>
          <td style="padding: 5px; border-right: 1px solid black; text-align: center; width: 60px;">FINANCE</td>
          <td style="padding: 5px; text-align: right;">SUB TOTAL</td>
        </tr>
        <tr style="border-bottom: 1px solid black;">
          <td style="padding: 5px; border-right: 1px solid black;">PAYMENT TODAY</td>
          <td style="padding: 5px; border-right: 1px solid black; text-align: center; font-weight: bold;">${contractData.paymentMethod === 'card' ? '✓' : ''}</td>
          <td style="padding: 5px; border-right: 1px solid black; text-align: center; font-weight: bold;">${contractData.paymentMethod === 'cash' ? '✓' : ''}</td>
          <td style="padding: 5px; border-right: 1px solid black; text-align: center; font-weight: bold;">${contractData.paymentMethod === 'finance' ? '✓' : ''}</td>
          <td style="padding: 5px; text-align: right; font-weight: 500;">${formatCurrency(contractData.subtotal)}</td>
        </tr>
        <tr style="border-bottom: 1px solid black;">
          <td style="padding: 5px; border-right: 1px solid black; font-size: 9px; color: #666;" rowspan="2">Viewer must initial any cash<br/>received and sign here</td>
          <td style="padding: 5px; border-right: 1px solid black;" rowspan="2"></td>
          <td style="padding: 5px; border-right: 1px solid black; text-align: center;" colspan="2">VAT@20%</td>
          <td style="padding: 5px; text-align: right; font-weight: 500;">${formatCurrency(contractData.vatAmount)}</td>
        </tr>
        <tr>
          <td style="padding: 5px; border-right: 1px solid black; text-align: center;" colspan="2">
            <span style="font-size: 9px;">AUTHORISATION CODE:</span><br/>
            <span style="font-weight: 500;">${contractData.authCode || ''}</span>
          </td>
          <td style="padding: 5px;">
            <div style="text-align: right;">
              <strong>TOTAL</strong><br/>
              <span style="font-weight: bold; font-size: 16px;">${formatCurrency(contractData.total)}</span>
            </div>
          </td>
        </tr>
      </table>

      <!-- Signature Section -->
      <p data-editable="signature_instruction" style="font-size: 9px; font-weight: bold; margin-bottom: 8px;">${t.signature_instruction}</p>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid black;">
        <tr>
          <td style="padding: 8px; border-right: 1px solid black; width: 75%;">
            <span style="font-size: 10px;">CUSTOMER SIGNATURE:</span>
            <div style="margin-top: 5px; min-height: 60px;">
              ${contractData.signatures?.main ? `<img src="${contractData.signatures.main}" style="max-height: 55px; max-width: 250px;" />` : ''}
            </div>
          </td>
          <td style="padding: 8px; text-align: center;">
            <span style="font-size: 10px;">DATE:</span>
            <div style="font-weight: 500; margin-top: 10px;">${formatDate(contractData.signedAt || new Date())}</div>
          </td>
        </tr>
      </table>

      <!-- Footer -->
      <div data-editable="footer" style="text-align: center; font-size: 9px; color: #666; padding-top: 12px;">
        <p style="margin: 2px 0;">${t.footer_line1}</p>
        <p style="margin: 2px 0;">${t.footer_line2}</p>
      </div>
    </div>
  `;

  const page2HTML = `
    <div class="page" style="padding: 40px; font-family: Arial, sans-serif; background: white; page-break-before: always;">
      <!-- Header -->
      <div style="margin-bottom: 25px;">
        <p style="font-weight: bold; font-size: 14px; margin: 0 0 10px 0;">CUSTOMER NAME: <span style="font-weight: normal;">${contractData.customerName || ''}</span></p>
        <p style="font-weight: bold; font-size: 14px; margin: 0;">DATE: <span style="font-weight: normal;">${formatDate(contractData.signedAt || new Date())}</span></p>
      </div>

      <!-- 4 Confirmation Boxes -->
      <div style="display: flex; flex-direction: column; gap: 25px;">

        <!-- Box 1 -->
        <div data-editable="confirmation1" style="display: flex; gap: 25px; align-items: flex-start;">
          <div style="width: 160px; flex-shrink: 0; border: 2px solid black; padding: 5px; min-height: 80px;">
            ${contractData.signatures?.notAgency ? `<img src="${contractData.signatures.notAgency}" style="max-height: 70px; max-width: 145px;" />` : '<div style="color: #ccc; text-align: center; padding-top: 25px;">Sign Here</div>'}
          </div>
          <div style="flex: 1; padding-top: 10px;">
            <p style="font-size: 14px; line-height: 1.5; margin: 0;">
              ${t.confirmation1_text}
            </p>
          </div>
        </div>

        <!-- Box 2 -->
        <div data-editable="confirmation2" style="display: flex; gap: 25px; align-items: flex-start;">
          <div style="width: 160px; flex-shrink: 0; border: 2px solid black; padding: 5px; min-height: 80px;">
            ${contractData.signatures?.noCancel ? `<img src="${contractData.signatures.noCancel}" style="max-height: 70px; max-width: 145px;" />` : '<div style="color: #ccc; text-align: center; padding-top: 25px;">Sign Here</div>'}
          </div>
          <div style="flex: 1; padding-top: 10px;">
            <p style="font-size: 14px; line-height: 1.5; margin: 0;">
              ${t.confirmation2_text}
            </p>
          </div>
        </div>

        <!-- Box 3 -->
        <div data-editable="confirmation3" style="display: flex; gap: 25px; align-items: flex-start;">
          <div style="width: 160px; flex-shrink: 0; border: 2px solid black; padding: 5px; min-height: 80px;">
            ${contractData.signatures?.passDetails ? `<img src="${contractData.signatures.passDetails}" style="max-height: 70px; max-width: 145px;" />` : '<div style="color: #ccc; text-align: center; padding-top: 25px;">Sign Here</div>'}
          </div>
          <div style="flex: 1; padding-top: 10px;">
            <p style="font-size: 14px; line-height: 1.5; margin: 0;">
              ${t.confirmation3_text}
            </p>
          </div>
        </div>

        <!-- Box 4 -->
        <div data-editable="confirmation4" style="display: flex; gap: 25px; align-items: flex-start;">
          <div style="width: 160px; flex-shrink: 0; border: 2px solid black; padding: 5px; min-height: 80px;">
            ${contractData.signatures?.happyPurchase ? `<img src="${contractData.signatures.happyPurchase}" style="max-height: 70px; max-width: 145px;" />` : '<div style="color: #ccc; text-align: center; padding-top: 25px;">Sign Here</div>'}
          </div>
          <div style="flex: 1; padding-top: 10px;">
            <p style="font-size: 14px; line-height: 1.5; margin: 0;">
              ${t.confirmation4_text}
            </p>
          </div>
        </div>

      </div>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; padding: 0; }
        .page { width: 210mm; min-height: 297mm; }
        @media print {
          .page { page-break-after: always; }
        }
      </style>
    </head>
    <body>
      ${page1HTML}
      ${page2HTML}
    </body>
    </html>
  `;
}

/**
 * Generate Contract PDF using Puppeteer
 * This renders the HTML to PDF, guaranteeing exact visual match
 */
async function generateContractPDF(contractData) {
  let browser = null;

  try {
    console.log('🔄 Starting Puppeteer PDF generation...');

    // Fetch custom template from database (or use defaults)
    const template = await getActiveTemplate();
    console.log('📄 Using contract template:', template.id ? 'Custom' : 'Default');

    // Generate HTML with template
    const html = generateContractHTML(contractData, template);

    // Launch Puppeteer - use system Chromium on Railway/Alpine
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // Set content
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });

    console.log('✅ PDF generated successfully, size:', pdfBuffer.length, 'bytes');

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('❌ Error generating PDF with Puppeteer:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generate contract data from lead and package selection
 */
function buildContractData(lead, packageData, invoiceData = {}) {
  return {
    // Dates
    date: new Date(),
    signedAt: null,

    // Customer details
    customerNumber: lead.id?.toString().slice(-6) || '',
    customerName: lead.name || '',
    clientNameIfDifferent: lead.parent_name || '',
    address: lead.address || '',
    postcode: lead.postcode || '',
    phone: lead.phone || '',
    email: lead.email || '',
    isVip: lead.is_vip || false,

    // Studio info
    studioNumber: invoiceData.studioNumber || '',
    photographer: invoiceData.photographer || '',
    invoiceNumber: invoiceData.invoiceNumber || `INV-${Date.now().toString().slice(-8)}`,

    // Order details
    digitalImages: true,
    digitalImagesQty: packageData.imageCount || packageData.image_count || 'All',
    digitalZCard: packageData.includes?.some(i => i.toLowerCase().includes('z-card')) || false,
    efolio: packageData.includes?.some(i => i.toLowerCase().includes('efolio') || i.toLowerCase().includes('e-folio')) || false,
    efolioUrl: '',
    projectInfluencer: packageData.includes?.some(i => i.toLowerCase().includes('influencer')) || false,
    influencerLogin: '',
    influencerPassword: '',

    // Permissions
    allowImageUse: true,
    imagesReceived: 'N.A',

    // Notes
    notes: `Package: ${packageData.name || 'Standard Package'}`,

    // Financials
    subtotal: invoiceData.subtotal || packageData.price || 0,
    vatAmount: invoiceData.vatAmount || (packageData.price * 0.2) || 0,
    total: invoiceData.total || (packageData.price * 1.2) || 0,

    // Payment
    paymentMethod: invoiceData.paymentMethod || 'card',
    authCode: invoiceData.authCode || '',
    viewerInitials: '',

    // Signatures
    signatures: {
      main: null,
      notAgency: null,
      noCancel: null,
      passDetails: null,
      happyPurchase: null
    }
  };
}

module.exports = {
  generateContractPDF,
  generateContractHTML,
  buildContractData,
  getActiveTemplate,
  formatCurrency,
  formatDate,
  DEFAULT_TEMPLATE
};
