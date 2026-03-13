/**
 * Finance Contract Generator
 * Generates HTML/PDF for "Finance Agreement & Affordability Assessment"
 * CCA 1974 regulated, 2-page contract with 1 customer signature
 */

const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey || config.supabase.anonKey);

// Default finance template values
const DEFAULT_FINANCE_TEMPLATE = {
  company_name: 'EDGE TALENT',
  company_address: '129A Weedington Rd, London NW5 4NX',
  company_website: 'www.edgetalent.co.uk',
  creditor_trading_as: 'S&A Advertising Ltd',
  key_information_text: 'This is a credit agreement regulated by the Consumer Credit Act 1974. By signing this agreement, you are confirming that you wish to enter into a credit arrangement with the creditor named above. You have the right to withdraw from this agreement within 14 days of signing without giving any reason. If you withdraw, you must repay the credit and any interest accrued within 30 days. If you do not keep up repayments, your account will go into arrears and this may affect your credit rating. The creditor may take legal action to recover any outstanding balance. Please ensure you have read and understood all terms before signing.',
  customer_agreement_text: 'I confirm that the information provided is true and accurate. I understand the terms of this credit agreement and agree to make payments as outlined above. I acknowledge that failure to maintain payments may result in additional charges and may affect my credit rating.',
  creditor_acknowledgement_text: 'The creditor confirms that the affordability assessment has been conducted and the customer has been provided with adequate pre-contract information in accordance with the Consumer Credit Act 1974.',
  cca_notice: 'This is a Credit Agreement regulated by the Consumer Credit Act 1974. Sign it only if you want to be legally bound by its terms. Under the Consumer Credit Act 1974, you have the right to withdraw from this agreement within 14 days.',
  footer_line1: 'Edge Talent is a trading name of S&A Advertising Ltd',
  footer_line2: 'Company No 8708429 VAT Reg No 171339904'
};

/**
 * Get active finance template from database or return defaults
 */
async function getActiveFinanceTemplate() {
  try {
    const { data: template, error } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn('⚠️ Error fetching finance template:', error.message);
      return DEFAULT_FINANCE_TEMPLATE;
    }

    if (template && template.id) {
      // Merge: use finance-specific fields from DB template if they exist, otherwise defaults
      return {
        ...DEFAULT_FINANCE_TEMPLATE,
        company_name: template.company_name || DEFAULT_FINANCE_TEMPLATE.company_name,
        company_address: template.company_address || DEFAULT_FINANCE_TEMPLATE.company_address,
        company_website: template.company_website || DEFAULT_FINANCE_TEMPLATE.company_website,
        footer_line1: template.footer_line1 || DEFAULT_FINANCE_TEMPLATE.footer_line1,
        footer_line2: template.footer_line2 || DEFAULT_FINANCE_TEMPLATE.footer_line2,
        // Finance-specific fields from template if saved
        creditor_trading_as: template.creditor_trading_as || DEFAULT_FINANCE_TEMPLATE.creditor_trading_as,
        key_information_text: template.key_information_text || DEFAULT_FINANCE_TEMPLATE.key_information_text,
        customer_agreement_text: template.customer_agreement_text || DEFAULT_FINANCE_TEMPLATE.customer_agreement_text,
        creditor_acknowledgement_text: template.creditor_acknowledgement_text || DEFAULT_FINANCE_TEMPLATE.creditor_acknowledgement_text,
        cca_notice: template.cca_notice || DEFAULT_FINANCE_TEMPLATE.cca_notice
      };
    }

    return DEFAULT_FINANCE_TEMPLATE;
  } catch (err) {
    console.warn('⚠️ Exception fetching finance template:', err.message);
    return DEFAULT_FINANCE_TEMPLATE;
  }
}

/**
 * Format currency value
 */
function formatCurrency(amount) {
  return `£${parseFloat(amount || 0).toFixed(2)}`;
}

/**
 * Format date as DD/MM/YYYY
 */
function formatDate(date) {
  const d = new Date(date || new Date());
  return d.toLocaleDateString('en-GB');
}

/**
 * Calculate all finance fields from input data
 */
function calculateFinanceFields(data) {
  const cashPrice = parseFloat(data.cashPrice) || 0;
  const deposit = parseFloat(data.deposit) || 0;
  const interestRate = parseFloat(data.interestRate) || 0;
  const adminFee = parseFloat(data.adminFee) || 0;
  const numberOfInstalments = parseInt(data.numberOfInstalments) || 12;
  const duration = parseInt(data.duration) || 12;
  const monthlyIncome = parseFloat(data.monthlyIncome) || 0;
  const priorityOutgoings = parseFloat(data.priorityOutgoings) || 0;
  const otherOutgoings = parseFloat(data.otherOutgoings) || 0;

  const amountOfCredit = cashPrice - deposit;
  const interest = amountOfCredit * (interestRate / 100) * (duration / 12);
  const totalChargeForCredit = interest + adminFee;
  const totalAmountPayable = amountOfCredit + totalChargeForCredit;
  const monthlyRepayment = numberOfInstalments > 0 ? totalAmountPayable / numberOfInstalments : 0;
  const dailyRateOfInterest = interestRate / 365;
  const disposableBalance = monthlyIncome - priorityOutgoings - otherOutgoings;
  const totalExpenditure = priorityOutgoings + otherOutgoings;
  const apr = amountOfCredit > 0 && duration > 0
    ? (totalChargeForCredit / amountOfCredit) * (12 / duration) * 100
    : 0;

  return {
    amountOfCredit,
    interest,
    totalChargeForCredit,
    totalAmountPayable,
    monthlyRepayment,
    dailyRateOfInterest,
    disposableBalance,
    totalExpenditure,
    apr
  };
}

/**
 * Generate the Finance Agreement HTML (2-page layout)
 */
function generateFinanceContractHTML(contractData, template = DEFAULT_FINANCE_TEMPLATE) {
  const t = template && template.company_name ? template : DEFAULT_FINANCE_TEMPLATE;
  const d = contractData;

  // Calculate derived fields
  const calc = calculateFinanceFields(d);

  const page1HTML = `
    <div class="page" style="padding: 30px; font-family: Arial, sans-serif; font-size: 11px; background: white;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; border-bottom: 2px solid #1a1a2e; padding-bottom: 10px;">
        <div>
          <h1 style="font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 0; color: #1a1a2e;">${t.company_name}</h1>
          <p style="font-size: 9px; margin: 3px 0 0 0; color: #666;">${t.company_address}</p>
        </div>
        <div style="text-align: right;">
          <h2 style="font-size: 14px; font-weight: bold; margin: 0; color: #1a1a2e;">FINANCE AGREEMENT</h2>
          <h3 style="font-size: 11px; font-weight: bold; margin: 2px 0 0 0; color: #1a1a2e;">& AFFORDABILITY ASSESSMENT</h3>
          <p style="font-size: 9px; margin: 5px 0 0 0; color: #666;">Date: ${formatDate(d.date)}</p>
          <p style="font-size: 8px; margin: 2px 0 0 0; color: #999;">Ref: ${d.agreementNumber || d.invoiceNumber || ''}</p>
        </div>
      </div>

      <!-- Section 1: Customer Information -->
      <div style="margin-bottom: 12px;">
        <div style="background: #1a1a2e; color: white; padding: 5px 10px; font-weight: bold; font-size: 11px; margin-bottom: 0;">
          SECTION 1: CUSTOMER INFORMATION
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #333; font-size: 10px;">
          <tr style="border-bottom: 1px solid #ccc;">
            <td style="padding: 6px 10px; width: 30%; color: #666; border-right: 1px solid #ccc;">Full Name</td>
            <td style="padding: 6px 10px; font-weight: 500;">${d.customerName || ''}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ccc;">
            <td style="padding: 6px 10px; color: #666; border-right: 1px solid #ccc;">Address</td>
            <td style="padding: 6px 10px; font-weight: 500;">${d.address || ''}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ccc;">
            <td style="padding: 6px 10px; color: #666; border-right: 1px solid #ccc;">Postcode</td>
            <td style="padding: 6px 10px; font-weight: 500;">${d.postcode || ''}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ccc;">
            <td style="padding: 6px 10px; color: #666; border-right: 1px solid #ccc;">Date of Birth</td>
            <td style="padding: 6px 10px; font-weight: 500;">${d.dateOfBirth ? formatDate(d.dateOfBirth) : ''}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ccc;">
            <td style="padding: 6px 10px; color: #666; border-right: 1px solid #ccc;">Years at Address</td>
            <td style="padding: 6px 10px; font-weight: 500;">${d.yearsAtAddress || ''}</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; color: #666; border-right: 1px solid #ccc;">Mobile Number</td>
            <td style="padding: 6px 10px; font-weight: 500;">${d.phone || ''}</td>
          </tr>
        </table>
      </div>

      <!-- Section 2: Affordability Assessment -->
      <div style="margin-bottom: 12px;">
        <div style="background: #1a1a2e; color: white; padding: 5px 10px; font-weight: bold; font-size: 11px; margin-bottom: 0;">
          SECTION 2: AFFORDABILITY ASSESSMENT
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #333; font-size: 10px;">
          <tr style="border-bottom: 1px solid #ccc;">
            <td style="padding: 6px 10px; width: 60%; color: #666; border-right: 1px solid #ccc;">Monthly Household Income</td>
            <td style="padding: 6px 10px; font-weight: 500; text-align: right;">${formatCurrency(d.monthlyIncome)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ccc;">
            <td style="padding: 6px 10px; color: #666; border-right: 1px solid #ccc;">Priority Outgoings (Rent/Mortgage, Bills, etc.)</td>
            <td style="padding: 6px 10px; font-weight: 500; text-align: right;">${formatCurrency(d.priorityOutgoings)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ccc;">
            <td style="padding: 6px 10px; color: #666; border-right: 1px solid #ccc;">Other Outgoings (Lifestyle, Subscriptions, etc.)</td>
            <td style="padding: 6px 10px; font-weight: 500; text-align: right;">${formatCurrency(d.otherOutgoings)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ccc; background: #f0f9ff;">
            <td style="padding: 6px 10px; font-weight: bold; border-right: 1px solid #ccc;">Disposable Balance</td>
            <td style="padding: 6px 10px; font-weight: bold; text-align: right;">${formatCurrency(calc.disposableBalance)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ccc; background: #f0f9ff;">
            <td style="padding: 6px 10px; font-weight: bold; border-right: 1px solid #ccc;">Total Expenditure</td>
            <td style="padding: 6px 10px; font-weight: bold; text-align: right;">${formatCurrency(calc.totalExpenditure)}</td>
          </tr>
          <tr style="background: #fef3c7;">
            <td style="padding: 6px 10px; font-weight: bold; border-right: 1px solid #ccc;">Agreed Instalment Value</td>
            <td style="padding: 6px 10px; font-weight: bold; text-align: right; font-size: 12px;">${formatCurrency(d.agreedInstalment)}</td>
          </tr>
        </table>
      </div>

      <!-- Section 3: Loan & Repayment Terms -->
      <div style="margin-bottom: 12px;">
        <div style="background: #1a1a2e; color: white; padding: 5px 10px; font-weight: bold; font-size: 11px; margin-bottom: 0;">
          SECTION 3: LOAN & REPAYMENT TERMS
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #333; font-size: 10px;">
          <tr style="border-bottom: 1px solid #ccc;">
            <td style="padding: 5px 10px; width: 50%; color: #666; border-right: 1px solid #ccc;">Cash Price of Goods</td>
            <td style="padding: 5px 10px; font-weight: 500; text-align: right;">${formatCurrency(d.cashPrice)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ccc;">
            <td style="padding: 5px 10px; color: #666; border-right: 1px solid #ccc;">Deposit</td>
            <td style="padding: 5px 10px; font-weight: 500; text-align: right;">${formatCurrency(d.deposit)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ccc; background: #f0f9ff;">
            <td style="padding: 5px 10px; font-weight: bold; border-right: 1px solid #ccc;">Amount of Credit</td>
            <td style="padding: 5px 10px; font-weight: bold; text-align: right;">${formatCurrency(calc.amountOfCredit)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ccc;">
            <td style="padding: 5px 10px; color: #666; border-right: 1px solid #ccc;">Interest</td>
            <td style="padding: 5px 10px; font-weight: 500; text-align: right;">${formatCurrency(calc.interest)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ccc;">
            <td style="padding: 5px 10px; color: #666; border-right: 1px solid #ccc;">Admin Fee</td>
            <td style="padding: 5px 10px; font-weight: 500; text-align: right;">${formatCurrency(d.adminFee)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ccc; background: #f0f9ff;">
            <td style="padding: 5px 10px; font-weight: bold; border-right: 1px solid #ccc;">Total Charge for Credit</td>
            <td style="padding: 5px 10px; font-weight: bold; text-align: right;">${formatCurrency(calc.totalChargeForCredit)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ccc; background: #fef3c7;">
            <td style="padding: 5px 10px; font-weight: bold; border-right: 1px solid #ccc;">Total Amount Payable</td>
            <td style="padding: 5px 10px; font-weight: bold; text-align: right; font-size: 12px;">${formatCurrency(calc.totalAmountPayable)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ccc;">
            <td style="padding: 5px 10px; color: #666; border-right: 1px solid #ccc;">Number of Instalments</td>
            <td style="padding: 5px 10px; font-weight: 500; text-align: right;">${d.numberOfInstalments || 12}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ccc;">
            <td style="padding: 5px 10px; color: #666; border-right: 1px solid #ccc;">Duration of Agreement (months)</td>
            <td style="padding: 5px 10px; font-weight: 500; text-align: right;">${d.duration || 12}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ccc;">
            <td style="padding: 5px 10px; color: #666; border-right: 1px solid #ccc;">Interest Rate (annual %)</td>
            <td style="padding: 5px 10px; font-weight: 500; text-align: right;">${parseFloat(d.interestRate || 0).toFixed(1)}%</td>
          </tr>
          <tr>
            <td style="padding: 5px 10px; color: #666; border-right: 1px solid #ccc;">APR</td>
            <td style="padding: 5px 10px; font-weight: 500; text-align: right;">${calc.apr.toFixed(1)}%</td>
          </tr>
        </table>
      </div>

      <!-- Footer -->
      <div style="text-align: center; font-size: 8px; color: #999; padding-top: 8px;">
        <p style="margin: 1px 0;">${t.footer_line1}</p>
        <p style="margin: 1px 0;">${t.footer_line2}</p>
      </div>
    </div>
  `;

  const page2HTML = `
    <div class="page" style="padding: 30px; font-family: Arial, sans-serif; font-size: 11px; background: white; page-break-before: always;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 2px solid #1a1a2e; padding-bottom: 8px;">
        <h1 style="font-size: 18px; font-weight: bold; letter-spacing: 2px; margin: 0; color: #1a1a2e;">${t.company_name}</h1>
        <div style="text-align: right;">
          <p style="font-size: 10px; margin: 0; font-weight: bold;">FINANCE AGREEMENT - Page 2</p>
          <p style="font-size: 9px; margin: 2px 0 0 0; color: #666;">${d.customerName || ''} - ${formatDate(d.date)}</p>
        </div>
      </div>

      <!-- Section 4: Repayment Schedule -->
      <div style="margin-bottom: 15px;">
        <div style="background: #1a1a2e; color: white; padding: 5px 10px; font-weight: bold; font-size: 11px; margin-bottom: 0;">
          SECTION 4: REPAYMENT SCHEDULE
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #333; font-size: 10px;">
          <tr style="border-bottom: 1px solid #ccc;">
            <td style="padding: 6px 10px; width: 50%; color: #666; border-right: 1px solid #ccc;">Repayment Frequency</td>
            <td style="padding: 6px 10px; font-weight: 500; text-transform: capitalize;">${d.repaymentFrequency || 'Monthly'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ccc;">
            <td style="padding: 6px 10px; color: #666; border-right: 1px solid #ccc;">Commencing From</td>
            <td style="padding: 6px 10px; font-weight: 500;">${d.commencingFrom ? formatDate(d.commencingFrom) : ''}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ccc; background: #fef3c7;">
            <td style="padding: 6px 10px; font-weight: bold; border-right: 1px solid #ccc;">Monthly Repayment Amount</td>
            <td style="padding: 6px 10px; font-weight: bold; font-size: 12px;">${formatCurrency(calc.monthlyRepayment)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; color: #666; border-right: 1px solid #ccc;">Daily Rate of Interest</td>
            <td style="padding: 6px 10px; font-weight: 500;">${calc.dailyRateOfInterest.toFixed(4)}%</td>
          </tr>
        </table>
      </div>

      <!-- Section 5: Key Information & Acknowledgement -->
      <div data-editable="key_information" style="margin-bottom: 15px;">
        <div style="background: #1a1a2e; color: white; padding: 5px 10px; font-weight: bold; font-size: 11px; margin-bottom: 0;">
          SECTION 5: KEY INFORMATION & ACKNOWLEDGEMENT
        </div>
        <div style="border: 1px solid #333; border-top: none; padding: 10px; font-size: 9px; line-height: 1.4; color: #444;">
          ${t.key_information_text}
        </div>
      </div>

      <!-- Section 6: Execution -->
      <div style="margin-bottom: 15px;">
        <div style="background: #1a1a2e; color: white; padding: 5px 10px; font-weight: bold; font-size: 11px; margin-bottom: 0;">
          SECTION 6: EXECUTION
        </div>
        <div style="border: 1px solid #333; border-top: none;">
          <!-- CCA Notice -->
          <div style="padding: 8px 10px; font-size: 8px; color: #666; border-bottom: 1px solid #ccc; background: #fff8dc; font-style: italic;">
            ${t.cca_notice}
          </div>

          <!-- Creditor Info -->
          <div style="padding: 8px 10px; border-bottom: 1px solid #ccc;">
            <p style="font-size: 9px; color: #666; margin: 0 0 3px 0;">Creditor:</p>
            <p style="font-weight: bold; margin: 0; font-size: 11px;">${t.company_name}</p>
            <p style="font-size: 9px; margin: 2px 0 0 0; color: #555;">Trading as: ${t.creditor_trading_as}</p>
            <p style="font-size: 9px; margin: 2px 0 0 0; color: #555;">${t.company_address}</p>
          </div>

          <!-- Customer Signature -->
          <div style="padding: 10px; border-bottom: 1px solid #ccc;">
            <p style="font-size: 9px; color: #666; margin: 0 0 3px 0;">Customer Agreement:</p>
            <p style="font-size: 8px; color: #555; margin: 0 0 8px 0; line-height: 1.3;">${t.customer_agreement_text}</p>
            <div style="display: flex; gap: 20px; align-items: flex-end;">
              <div style="flex: 1;">
                <p style="font-size: 9px; font-weight: bold; margin: 0 0 5px 0;">CUSTOMER SIGNATURE:</p>
                <div data-signature="customer" style="border: 2px solid #333; min-height: 70px; padding: 5px;">
                  ${d.signatures?.customer ? `<img src="${d.signatures.customer}" style="max-height: 60px; max-width: 250px;" />` : ''}
                </div>
              </div>
              <div style="width: 120px; text-align: center;">
                <p style="font-size: 9px; font-weight: bold; margin: 0 0 5px 0;">DATE:</p>
                <div style="border: 1px solid #333; padding: 8px; font-weight: 500; font-size: 10px;">
                  ${d.signedAt ? formatDate(d.signedAt) : formatDate(new Date())}
                </div>
              </div>
            </div>
          </div>

          <!-- Creditor Signature (auto-populated text, not drawn) -->
          <div style="padding: 10px;">
            <p style="font-size: 9px; color: #666; margin: 0 0 3px 0;">Creditor Acknowledgement:</p>
            <p style="font-size: 8px; color: #555; margin: 0 0 8px 0; line-height: 1.3;">${t.creditor_acknowledgement_text}</p>
            <div style="display: flex; gap: 20px; align-items: flex-end;">
              <div style="flex: 1;">
                <p style="font-size: 9px; font-weight: bold; margin: 0 0 5px 0;">CREDITOR (Authorised Signatory):</p>
                <div style="border: 1px solid #999; min-height: 40px; padding: 8px; background: #f9f9f9;">
                  <span style="font-size: 14px; font-family: 'Brush Script MT', 'Segoe Script', cursive; color: #1a1a2e;">${d.creditorName || ''}</span>
                </div>
              </div>
              <div style="width: 120px; text-align: center;">
                <p style="font-size: 9px; font-weight: bold; margin: 0 0 5px 0;">DATE:</p>
                <div style="border: 1px solid #999; padding: 8px; font-weight: 500; font-size: 10px; background: #f9f9f9;">
                  ${formatDate(d.creditorDate || d.date)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="text-align: center; font-size: 8px; color: #999; padding-top: 5px;">
        <p style="margin: 1px 0;">${t.footer_line1}</p>
        <p style="margin: 1px 0;">${t.footer_line2}</p>
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
 * Generate Finance Contract PDF using Puppeteer
 */
async function generateFinanceContractPDF(contractData) {
  let browser = null;

  try {
    console.log('🔄 Starting Puppeteer PDF generation for finance contract...');

    const template = await getActiveFinanceTemplate();
    const html = generateFinanceContractHTML(contractData, template);

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
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });

    console.log('✅ Finance PDF generated successfully, size:', pdfBuffer.length, 'bytes');
    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('❌ Error generating finance PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = {
  generateFinanceContractHTML,
  generateFinanceContractPDF,
  getActiveFinanceTemplate,
  calculateFinanceFields,
  DEFAULT_FINANCE_TEMPLATE
};
