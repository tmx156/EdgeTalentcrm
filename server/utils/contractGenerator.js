/**
 * Contract Generator Utility
 * Uses the original Edge Talent PDF template and overlays data on it
 * Uses pdf-lib to maintain exact original layout
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

// Path to the original PDF template - Edge Talent Invoice & Order Form
const TEMPLATE_PATH = path.join(__dirname, '../templates/EDGE TALENT INVOICE Terms and conditions (1).pdf');
const FALLBACK_TEMPLATE_PATH = path.join(__dirname, '../templates/contract-template.pdf');

// Verify template exists on module load
const templatesDir = path.join(__dirname, '../templates');
console.log('📁 Templates directory:', templatesDir);

if (fs.existsSync(templatesDir)) {
  console.log('📁 Templates folder contents:', fs.readdirSync(templatesDir));
}

if (fs.existsSync(TEMPLATE_PATH)) {
  console.log('✅ Contract template found:', TEMPLATE_PATH);
} else {
  console.error('❌ Contract template NOT found at:', TEMPLATE_PATH);
  if (fs.existsSync(FALLBACK_TEMPLATE_PATH)) {
    console.log('⚠️ Will use fallback template:', FALLBACK_TEMPLATE_PATH);
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
 * Generate Edge Talent Contract PDF by overlaying data on original template
 * @param {Object} contractData - Contract data to populate
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateContractPDF(contractData) {
  try {
    console.log('🔄 Starting PDF generation...');

    // Load the template PDF - Edge Talent Invoice & Order Form
    let templateBytes;
    let actualTemplatePath = TEMPLATE_PATH;

    // Log current working directory and paths for debugging
    console.log('📍 Current working directory:', process.cwd());
    console.log('📍 __dirname:', __dirname);
    console.log('📍 Looking for template at:', TEMPLATE_PATH);

    if (!fs.existsSync(TEMPLATE_PATH)) {
      console.log('⚠️ Primary template not found, checking fallback...');

      // Try fallback to contract-template.pdf if the exact filename doesn't exist
      if (fs.existsSync(FALLBACK_TEMPLATE_PATH)) {
        console.log('⚠️ Using fallback template:', FALLBACK_TEMPLATE_PATH);
        actualTemplatePath = FALLBACK_TEMPLATE_PATH;
        templateBytes = fs.readFileSync(FALLBACK_TEMPLATE_PATH);
      } else {
        // List what's actually in the templates folder for debugging
        const templatesDir = path.join(__dirname, '../templates');
        let folderContents = [];
        if (fs.existsSync(templatesDir)) {
          folderContents = fs.readdirSync(templatesDir);
        }
        throw new Error(`Contract template not found. Templates folder contains: [${folderContents.join(', ')}]`);
      }
    } else {
      console.log('✅ Using primary template:', TEMPLATE_PATH);
      templateBytes = fs.readFileSync(TEMPLATE_PATH);
    }

    console.log('📄 Template loaded, size:', templateBytes.length, 'bytes');
    
    const pdfDoc = await PDFDocument.load(templateBytes);
    console.log(`✅ Loaded Edge Talent contract template PDF: ${path.basename(actualTemplatePath)}`);

    // Get the font
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Get pages
    const pages = pdfDoc.getPages();
    const page1 = pages[0];
    const page2 = pages.length > 1 ? pages[1] : null;

    // Get page dimensions (A4: 595 x 842 points)
    const { width, height } = page1.getSize();
    console.log(`PDF dimensions: ${width} x ${height}`);

    // Text color - black
    const textColor = rgb(0, 0, 0);

    // Font sizes
    const smallFont = 8;
    const normalFont = 10;
    const largeFont = 12;

    // ============ PAGE 1 FIELDS ============
    // Coordinates measured from bottom-left of page

    // Date (top right corner, after "Date:")
    page1.drawText(formatDate(contractData.date), {
      x: 520,
      y: height - 38,
      size: normalFont,
      font: font,
      color: textColor
    });

    // Customer Nos. (in the table row)
    page1.drawText(contractData.customerNumber || '', {
      x: 85,
      y: height - 130,
      size: smallFont,
      font: font,
      color: textColor
    });

    // Studio no.
    page1.drawText(contractData.studioNumber || '', {
      x: 200,
      y: height - 130,
      size: smallFont,
      font: font,
      color: textColor
    });

    // Photographer
    page1.drawText(contractData.photographer || '', {
      x: 340,
      y: height - 130,
      size: smallFont,
      font: font,
      color: textColor
    });

    // Invoice no.
    page1.drawText(contractData.invoiceNumber || '', {
      x: 480,
      y: height - 130,
      size: smallFont,
      font: font,
      color: textColor
    });

    // ---- CUSTOMER DETAILS SECTION ----

    // NAME OF PERSON IN DIARY (after the label)
    page1.drawText(contractData.customerName || '', {
      x: 165,
      y: height - 172,
      size: normalFont,
      font: font,
      color: textColor
    });

    // VIP YES/NO - circle the right one
    // YES is around x: 500, NO is around x: 530
    const vipX = contractData.isVip ? 492 : 522;
    page1.drawText('O', {
      x: vipX,
      y: height - 172,
      size: 12,
      font: boldFont,
      color: textColor
    });

    // NAME OF CLIENT IF DIFFERENT
    page1.drawText(contractData.clientNameIfDifferent || '', {
      x: 165,
      y: height - 195,
      size: normalFont,
      font: font,
      color: textColor
    });

    // ADDRESS
    page1.drawText(contractData.address || '', {
      x: 70,
      y: height - 218,
      size: normalFont,
      font: font,
      color: textColor
    });

    // POSTCODE
    page1.drawText(contractData.postcode || '', {
      x: 350,
      y: height - 241,
      size: normalFont,
      font: font,
      color: textColor
    });

    // PHONE/MOBILE NO.
    page1.drawText(contractData.phone || '', {
      x: 110,
      y: height - 241,
      size: normalFont,
      font: font,
      color: textColor
    });

    // EMAIL
    page1.drawText(contractData.email || '', {
      x: 450,
      y: height - 241,
      size: smallFont,
      font: font,
      color: textColor
    });

    // ---- ORDER DETAILS SECTION ----

    // DIGITAL IMAGES - Circle YES or NO
    const digiYesX = contractData.digitalImages ? 138 : 168;
    page1.drawText('O', {
      x: digiYesX,
      y: height - 290,
      size: 10,
      font: boldFont,
      color: textColor
    });

    // DIGITAL IMAGES QTY
    page1.drawText(contractData.digitalImagesQty?.toString() || '', {
      x: 255,
      y: height - 290,
      size: normalFont,
      font: font,
      color: textColor
    });

    // DIGITAL Z-CARD - Circle YES or NO
    if (contractData.digitalZCard) {
      page1.drawText('O', {
        x: 138,
        y: height - 313,
        size: 10,
        font: boldFont,
        color: textColor
      });
    }

    // EFOLIO - Circle YES or NO
    if (contractData.efolio) {
      page1.drawText('O', {
        x: 138,
        y: height - 336,
        size: 10,
        font: boldFont,
        color: textColor
      });
      // EFOLIO URL
      if (contractData.efolioUrl) {
        page1.drawText(contractData.efolioUrl, {
          x: 220,
          y: height - 336,
          size: smallFont,
          font: font,
          color: textColor
        });
      }
    }

    // PROJECT INFLUENCER - Circle YES or NO
    if (contractData.projectInfluencer) {
      page1.drawText('O', {
        x: 165,
        y: height - 359,
        size: 10,
        font: boldFont,
        color: textColor
      });
      // LOGIN
      if (contractData.influencerLogin) {
        page1.drawText(contractData.influencerLogin, {
          x: 265,
          y: height - 359,
          size: smallFont,
          font: font,
          color: textColor
        });
      }
      // PASSWORD
      if (contractData.influencerPassword) {
        page1.drawText(contractData.influencerPassword, {
          x: 430,
          y: height - 359,
          size: smallFont,
          font: font,
          color: textColor
        });
      }
    }

    // I DO/DO NOT give permission - Circle DO or DO NOT
    const permissionX = contractData.allowImageUse ? 37 : 57;
    page1.drawText('O', {
      x: permissionX,
      y: height - 385,
      size: 10,
      font: boldFont,
      color: textColor
    });

    // Digital Images checked & received - Circle YES/NO/N.A
    // Default to N.A
    page1.drawText('O', {
      x: 310, // N.A position
      y: height - 400,
      size: 10,
      font: boldFont,
      color: textColor
    });

    // NOTES
    if (contractData.notes) {
      const noteLines = contractData.notes.split('\n').slice(0, 4);
      noteLines.forEach((line, i) => {
        page1.drawText(line.substring(0, 60), {
          x: 42,
          y: height - 440 - (i * 11),
          size: smallFont,
          font: font,
          color: textColor
        });
      });
    }

    // SUB TOTAL (right side box)
    page1.drawText(formatCurrency(contractData.subtotal), {
      x: 460,
      y: height - 415,
      size: normalFont,
      font: font,
      color: textColor
    });

    // TOTAL (right side box, below sub total)
    page1.drawText(formatCurrency(contractData.total), {
      x: 460,
      y: height - 450,
      size: largeFont,
      font: boldFont,
      color: textColor
    });

    // ---- PAYMENT DETAILS SECTION ----

    // Mark payment method with X
    const paymentRowY = height - 550;
    if (contractData.paymentMethod === 'card') {
      page1.drawText('X', {
        x: 190,
        y: paymentRowY,
        size: normalFont,
        font: boldFont,
        color: textColor
      });
    } else if (contractData.paymentMethod === 'cash') {
      page1.drawText('X', {
        x: 290,
        y: paymentRowY,
        size: normalFont,
        font: boldFont,
        color: textColor
      });
    } else if (contractData.paymentMethod === 'finance') {
      page1.drawText('X', {
        x: 375,
        y: paymentRowY,
        size: normalFont,
        font: boldFont,
        color: textColor
      });
    }

    // SUB TOTAL in payment section
    page1.drawText(formatCurrency(contractData.subtotal), {
      x: 490,
      y: paymentRowY,
      size: normalFont,
      font: font,
      color: textColor
    });

    // VAT@20%
    page1.drawText(formatCurrency(contractData.vatAmount), {
      x: 490,
      y: paymentRowY - 23,
      size: normalFont,
      font: font,
      color: textColor
    });

    // AUTHORISATION CODE
    if (contractData.authCode) {
      page1.drawText(contractData.authCode, {
        x: 400,
        y: paymentRowY - 46,
        size: normalFont,
        font: font,
        color: textColor
      });
    }

    // TOTAL in payment section
    page1.drawText(formatCurrency(contractData.total), {
      x: 490,
      y: paymentRowY - 46,
      size: largeFont,
      font: boldFont,
      color: textColor
    });

    // ---- SIGNATURE SECTION ----

    // DATE next to signature
    page1.drawText(formatDate(contractData.signedAt || new Date()), {
      x: 500,
      y: height - 700,
      size: normalFont,
      font: font,
      color: textColor
    });

    // Main signature image
    if (contractData.signatures?.main) {
      try {
        const signatureImage = await embedSignatureImage(pdfDoc, contractData.signatures.main);
        if (signatureImage) {
          page1.drawImage(signatureImage, {
            x: 130,
            y: height - 720,
            width: 200,
            height: 45
          });
        }
      } catch (err) {
        console.error('Error adding main signature:', err);
      }
    }

    // ============ PAGE 2 FIELDS ============
    if (page2) {
      const page2Height = page2.getSize().height;

      // CUSTOMER NAME:
      page2.drawText(contractData.customerName || '', {
        x: 130,
        y: page2Height - 42,
        size: normalFont,
        font: font,
        color: textColor
      });

      // DATE:
      page2.drawText(formatDate(contractData.signedAt || new Date()), {
        x: 55,
        y: page2Height - 67,
        size: normalFont,
        font: font,
        color: textColor
      });

      // 4 Signature boxes - positions from visual inspection
      const signatureBoxes = [
        { key: 'notAgency', y: 145 },      // First box
        { key: 'noCancel', y: 270 },       // Second box
        { key: 'passDetails', y: 420 },    // Third box
        { key: 'happyPurchase', y: 560 }   // Fourth box
      ];

      for (const box of signatureBoxes) {
        if (contractData.signatures?.[box.key]) {
          try {
            const signatureImage = await embedSignatureImage(pdfDoc, contractData.signatures[box.key]);
            if (signatureImage) {
              page2.drawImage(signatureImage, {
                x: 50,
                y: page2Height - box.y,
                width: 140,
                height: 50
              });
            }
          } catch (err) {
            console.error(`Error adding ${box.key} signature:`, err);
          }
        }
      }
    }

    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('Error generating contract PDF:', error);
    throw error;
  }
}

/**
 * Embed a base64 signature image into the PDF
 */
async function embedSignatureImage(pdfDoc, signatureData) {
  if (!signatureData || !signatureData.startsWith('data:image')) {
    return null;
  }

  try {
    const base64Data = signatureData.split(',')[1];
    const imageBytes = Buffer.from(base64Data, 'base64');

    // Try PNG first, then JPEG
    if (signatureData.includes('image/png')) {
      return await pdfDoc.embedPng(imageBytes);
    } else {
      return await pdfDoc.embedJpg(imageBytes);
    }
  } catch (error) {
    console.error('Error embedding signature image:', error);
    return null;
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

    // Order details - detect from package includes
    digitalImages: true, // Default yes for all packages
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

    // Notes - include package name
    notes: `Package: ${packageData.name || 'Standard Package'}`,

    // Financials
    subtotal: invoiceData.subtotal || packageData.price || 0,
    vatAmount: invoiceData.vatAmount || (packageData.price * 0.2) || 0,
    total: invoiceData.total || (packageData.price * 1.2) || 0,

    // Payment
    paymentMethod: invoiceData.paymentMethod || 'card',
    authCode: invoiceData.authCode || '',
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
}

module.exports = {
  generateContractPDF,
  buildContractData,
  formatCurrency,
  formatDate
};
