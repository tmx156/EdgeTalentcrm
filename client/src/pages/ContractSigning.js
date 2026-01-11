import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Check, RotateCcw, Loader, AlertTriangle, CheckCircle, FileText, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * ContractSigning - Public page for customers to sign contracts
 * Mobile-responsive design for all screen sizes
 */
const ContractSigning = () => {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contract, setContract] = useState(null);
  const [template, setTemplate] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Signature states
  const [signatures, setSignatures] = useState({
    main: null,
    notAgency: null,
    noCancel: null,
    passDetails: null,
    happyPurchase: null
  });

  // Fetch contract data
  useEffect(() => {
    const fetchContract = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/contracts/verify/${token}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Invalid contract link');
        }

        setContract(data.contract);
        setTemplate(data.template);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchContract();
    }
  }, [token]);

  // Handle signature submission
  const handleSubmit = async () => {
    const requiredSignatures = ['main', 'notAgency', 'noCancel', 'passDetails', 'happyPurchase'];
    const missingSignatures = requiredSignatures.filter(key => !signatures[key]);

    if (missingSignatures.length > 0) {
      alert(`Please complete all ${missingSignatures.length} remaining signature(s) before submitting.`);
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(`/api/contracts/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatures })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit signature');
      }

      setSubmitted(true);
      setPdfUrl(data.pdfUrl);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => `£${parseFloat(amount || 0).toFixed(2)}`;
  const formatDate = (date) => new Date(date || new Date()).toLocaleDateString('en-GB');

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-gray-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading contract...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Contract</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            Contact <a href="mailto:sales@edgetalent.co.uk" className="text-blue-600 hover:underline">sales@edgetalent.co.uk</a>
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Contract Signed!</h1>
          <p className="text-gray-600 mb-6">Thank you. A confirmation email has been sent.</p>
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <FileText className="w-5 h-5" />
              <span>Download Signed Contract</span>
            </a>
          )}
        </div>
      </div>
    );
  }

  const contractData = contract?.data || {};
  const signatureCount = Object.values(signatures).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-800 py-2 px-1 sm:py-4 sm:px-4">
      <div className="max-w-4xl mx-auto">

        {/* Progress Header */}
        <div className="bg-white rounded-t-lg p-3 sm:p-4 flex items-center justify-between border-b">
          <div className="min-w-0 flex-1">
            <h1 className="text-sm sm:text-lg font-bold text-gray-900 truncate">Edge Talent Contract</h1>
            <p className="text-xs sm:text-sm text-gray-500 truncate">{contractData.customerName}</p>
          </div>
          <div className="text-right ml-2 flex-shrink-0">
            <p className="text-xs sm:text-sm text-gray-500">Signatures: {signatureCount}/5</p>
            <div className="w-20 sm:w-32 h-2 bg-gray-200 rounded-full mt-1">
              <div className="h-2 bg-green-500 rounded-full transition-all" style={{ width: `${(signatureCount/5)*100}%` }}></div>
            </div>
          </div>
        </div>

        {/* Page Tabs */}
        <div className="bg-gray-100 flex border-b">
          <button onClick={() => setCurrentPage(1)}
            className={`flex-1 py-2 sm:py-3 text-xs sm:text-sm text-center font-medium transition-colors ${currentPage === 1 ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
            Page 1: Invoice
          </button>
          <button onClick={() => setCurrentPage(2)}
            className={`flex-1 py-2 sm:py-3 text-xs sm:text-sm text-center font-medium transition-colors ${currentPage === 2 ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
            Page 2: Confirm
          </button>
        </div>

        {/* Contract Content */}
        <div className="bg-white shadow-2xl overflow-x-auto">
          {currentPage === 1 ? (
            <Page1Content contractData={contractData} signatures={signatures} setSignatures={setSignatures} formatCurrency={formatCurrency} formatDate={formatDate} template={template} />
          ) : (
            <Page2Content contractData={contractData} signatures={signatures} setSignatures={setSignatures} formatDate={formatDate} template={template} />
          )}
        </div>

        {/* Submit Footer */}
        <div className="bg-white rounded-b-lg p-3 sm:p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs sm:text-sm text-gray-500">
            {signatureCount < 5 ? `${5 - signatureCount} signature(s) remaining` : 'All signatures complete!'}
          </p>
          <button onClick={handleSubmit} disabled={submitting || signatureCount < 5}
            className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2">
            {submitting ? <><Loader className="w-5 h-5 animate-spin" /><span>Submitting...</span></> : <><Check className="w-5 h-5" /><span>Submit Contract</span></>}
          </button>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 mt-4 px-2">
          <p>{template?.footer_line1 || 'Edge Talent is a trading name of S&A Advertising Ltd'}</p>
          <p>{template?.footer_line2 || 'Company No 8708429 | VAT Reg No 171339904'}</p>
        </div>
      </div>
    </div>
  );
};

/**
 * Page 1 - Invoice & Order Form (Mobile Responsive)
 */
const Page1Content = ({ contractData, signatures, setSignatures, formatCurrency, formatDate, template }) => {
  // Use template values with fallbacks
  const t = {
    company_name: template?.company_name || 'EDGE TALENT',
    company_website: template?.company_website || 'www.edgetalent.co.uk',
    company_address: template?.company_address || '129A Weedington Rd, London NW5 4NX',
    form_title: template?.form_title || 'INVOICE & ORDER FORM',
    form_subtitle: template?.form_subtitle || 'PLEASE CHECK YOUR ORDER BEFORE LEAVING YOUR VIEWING',
    form_contact_info: template?.form_contact_info || 'FOR ALL ENQUIRIES PLEASE EMAIL CUSTOMER SERVICES ON SALES@EDGETALENT.CO.UK',
    terms_and_conditions: template?.terms_and_conditions || 'By signing this invoice, you confirm that you have viewed, selected and approved all images and all cropping, editing and adjustments. You understand that all orders are final and due to the immediate nature of digital delivery this order is strictly non-refundable, non-cancellable and non-amendable once you leave the premises, without affecting your statutory rights. All digital products, including images, efolios and Z-cards and Project Influencer are delivered immediately upon full payment. Project Influencer has been added to this order as a complimentary addition to your purchased package and holds no independent monetary value. By signing you accept responsibility for downloading, backing up and securely storing your files once they are provided. Finance customers must complete all Payl8r documentation prior to receipt of goods. Efolios include 10 images and hosting for 1 year, which may require renewal thereafter; content may be removed if renewal fees are unpaid. You own the copyright to all images purchased and unless you opt out in writing at the time of signing, Edge Talent may use your images for promotional purposes (above) including, but not limited to, display on its website and social media channels. You acknowledge that Edge Talent is not a talent casting company/agency and does not guarantee work, representation or casting opportunities. Edge Talent accepts no liability for compatibility issues, loss of files after delivery, missed opportunities, or indirect losses and total liability is limited to the amount paid for your order. All personal data is processed in accordance with GDPR and used only to fulfil your order or meet legal requirements. By signing below, you acknowledge that you have read, understood and agree to these Terms & Conditions. For any post-delivery assistance, please contact sales@edgetalent.co.uk',
    signature_instruction: template?.signature_instruction || 'PLEASE SIGN BELOW TO INDICATE YOUR ACCEPTANCE OF THE ABOVE TERMS, AND ENSURE YOU RECEIVE YOUR OWN SIGNED COPY OF THIS INVOICE FOR YOUR RECORDS',
    image_permission_text: template?.image_permission_text || 'give permission for Edge Talent to use my images'
  };

  return (
    <div className="p-3 sm:p-6 text-xs sm:text-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
        <p className="text-xs hidden sm:block">{t.company_website}</p>
        <div className="text-center">
          <h1 className="text-xl sm:text-3xl font-bold tracking-wider sm:tracking-widest">{t.company_name}</h1>
          <p className="text-xs">{t.company_address}</p>
        </div>
        <div className="border border-black px-3 py-1 sm:px-4 sm:py-2">
          <span className="text-xs">Date: </span>
          <span className="font-medium text-xs sm:text-sm">{formatDate(contractData.date)}</span>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-4">
        <h2 className="text-base sm:text-xl font-bold mb-1">{t.form_title}</h2>
        <p className="text-xs hidden sm:block">{t.form_subtitle}</p>
        <p className="text-xs hidden sm:block">{t.form_contact_info}</p>
      </div>

      {/* Info Row - Stacked on mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 border border-black mb-4 text-xs">
        <div className="p-2 border-b sm:border-b-0 sm:border-r border-black">
          <span className="text-gray-600">Customer Nos.</span><br/>
          <span className="font-medium">{contractData.customerNumber || '-'}</span>
        </div>
        <div className="p-2 border-b sm:border-b-0 sm:border-r border-black">
          <span className="text-gray-600">Studio no.</span><br/>
          <span className="font-medium">{contractData.studioNumber || '-'}</span>
        </div>
        <div className="p-2 sm:border-r border-black">
          <span className="text-gray-600">Photographer</span><br/>
          <span className="font-medium">{contractData.photographer || '-'}</span>
        </div>
        <div className="p-2">
          <span className="text-gray-600">Invoice no.</span><br/>
          <span className="font-medium break-all">{contractData.invoiceNumber || '-'}</span>
        </div>
      </div>

      {/* Customer Details */}
      <h3 className="font-bold mb-1 text-sm">CUSTOMER DETAILS</h3>
      <div className="border border-black mb-4 text-xs">
        <div className="flex border-b border-black">
          <div className="flex-1 p-2">
            <span className="text-gray-600">NAME OF PERSON IN DIARY</span><br/>
            <span className="font-medium">{contractData.customerName || ''}</span>
          </div>
          <div className="border-l border-black p-2 text-center w-16 sm:w-24">
            <span className="text-gray-600">VIP?</span><br/>
            <span className="font-medium">{contractData.isVip ? 'YES' : 'NO'}</span>
          </div>
        </div>
        <div className="p-2 border-b border-black">
          <span className="text-gray-600">NAME OF CLIENT IF DIFFERENT</span><br/>
          <span className="font-medium">{contractData.clientNameIfDifferent || '-'}</span>
        </div>
        <div className="p-2 border-b border-black">
          <span className="text-gray-600">ADDRESS</span><br/>
          <span className="font-medium">{contractData.address || '-'}</span>
        </div>
        <div className="p-2 border-b border-black">
          <span className="text-gray-600">POSTCODE: </span>
          <span className="font-medium">{contractData.postcode || '-'}</span>
        </div>
        <div className="flex flex-col sm:flex-row">
          <div className="p-2 flex-1 border-b sm:border-b-0 sm:border-r border-black">
            <span className="text-gray-600">PHONE/MOBILE NO.</span><br/>
            <span className="font-medium">{contractData.phone || '-'}</span>
          </div>
          <div className="p-2 flex-1">
            <span className="text-gray-600">EMAIL:</span><br/>
            <span className="font-medium break-all">{contractData.email || '-'}</span>
          </div>
        </div>
      </div>

      {/* Order Details - Stacked on mobile */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-3">
        <div className="flex-1">
          <h3 className="font-bold mb-1 text-sm">ORDER DETAILS</h3>
          <div className="border border-black text-xs">
            <div className="flex border-b border-black">
              <div className="p-2 flex-1">DIGITAL IMAGES?</div>
              <div className="border-l border-black p-2 w-14 text-center">{contractData.digitalImages ? 'YES' : 'NO'}</div>
              <div className="border-l border-black p-2 flex-1">QTY: <span className="font-medium">{contractData.digitalImagesQty || '-'}</span></div>
            </div>
            <div className="flex border-b border-black">
              <div className="p-2 flex-1">DIGITAL Z-CARD?</div>
              <div className="border-l border-black p-2 w-14 text-center">{contractData.digitalZCard ? 'YES' : 'NO'}</div>
              <div className="border-l border-black p-2 flex-1 text-gray-500">DIGITAL PDF</div>
            </div>
            <div className="flex border-b border-black">
              <div className="p-2 flex-1">EFOLIO?</div>
              <div className="border-l border-black p-2 w-14 text-center">{contractData.efolio ? 'YES' : 'NO'}</div>
              <div className="border-l border-black p-2 flex-1 truncate">URL: {contractData.efolioUrl || '-'}</div>
            </div>
            <div className="flex border-b border-black">
              <div className="p-2 flex-1">PROJECT INFLUENCER?</div>
              <div className="border-l border-black p-2 w-14 text-center">{contractData.projectInfluencer ? 'YES' : 'NO'}</div>
              <div className="border-l border-black p-2 flex-1">-</div>
            </div>
            <div className="p-2 border-b border-black">
              I <span className="font-bold">{contractData.allowImageUse ? 'DO' : 'DO NOT'}</span> {t.image_permission_text}
            </div>
            <div className="flex">
              <div className="p-2 flex-1">Digital Images checked & received?</div>
              <div className="border-l border-black p-2 w-20 text-center">N.A</div>
            </div>
          </div>
        </div>

        {/* Totals Box */}
        <div className="w-full sm:w-28">
          <div className="border border-black text-xs h-full">
            <div className="p-2 text-center border-b border-black">
              <span className="text-gray-600">SUB TOTAL</span><br/>
              <span className="font-medium">{formatCurrency(contractData.subtotal)}</span>
            </div>
            <div className="p-2 text-center">
              <span className="font-bold">TOTAL</span><br/>
              <span className="font-bold text-sm sm:text-base">{formatCurrency(contractData.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="mb-3">
        <span className="font-bold text-xs">NOTES:</span>
        <div className="border border-black p-2 min-h-8 text-xs mt-1">{contractData.notes || ''}</div>
      </div>

      {/* Terms - Collapsible on mobile */}
      <details className="mb-3">
        <summary className="text-xs font-bold cursor-pointer text-gray-700">Terms and Conditions (tap to read)</summary>
        <div className="text-xs text-gray-600 mt-2 leading-tight" style={{ fontSize: '9px' }}>
          {t.terms_and_conditions}
        </div>
      </details>

      {/* Payment Details - Simplified for mobile */}
      <div className="border border-black mb-3 text-xs">
        <div className="grid grid-cols-3 sm:grid-cols-5 border-b border-black">
          <div className="p-2 font-medium col-span-3 sm:col-span-2">PAYMENT</div>
          <div className="hidden sm:block p-2 text-center border-l border-black">CARD</div>
          <div className="hidden sm:block p-2 text-center border-l border-black">CASH</div>
          <div className="hidden sm:block p-2 text-center border-l border-black">FINANCE</div>
        </div>
        <div className="grid grid-cols-2 border-b border-black">
          <div className="p-2">Payment Method:</div>
          <div className="p-2 font-medium text-right">{contractData.paymentMethod?.toUpperCase() || 'CARD'}</div>
        </div>
        <div className="grid grid-cols-2 border-b border-black">
          <div className="p-2">Subtotal:</div>
          <div className="p-2 font-medium text-right">{formatCurrency(contractData.subtotal)}</div>
        </div>
        <div className="grid grid-cols-2 border-b border-black">
          <div className="p-2">VAT @ 20%:</div>
          <div className="p-2 font-medium text-right">{formatCurrency(contractData.vatAmount)}</div>
        </div>
        {/* Finance Details - Show deposit and finance amount when payment method is finance */}
        {contractData.paymentMethod === 'finance' && (
          <>
            <div className="grid grid-cols-2 border-b border-black">
              <div className="p-2">Deposit:</div>
              <div className="p-2 font-medium text-right">{formatCurrency(contractData.depositAmount || 0)}</div>
            </div>
            <div className="grid grid-cols-2 border-b border-black">
              <div className="p-2">Finance Amount:</div>
              <div className="p-2 font-medium text-right">{formatCurrency(contractData.financeAmount || 0)}</div>
            </div>
          </>
        )}
        <div className="grid grid-cols-2 bg-gray-50">
          <div className="p-2 font-bold">TOTAL:</div>
          <div className="p-2 font-bold text-right text-base">{formatCurrency(contractData.total)}</div>
        </div>
      </div>

      {/* Main Signature Section */}
      <div className="mb-3">
        <p className="text-xs font-bold mb-2">{t.signature_instruction}</p>
        <div className="border border-black">
          <div className="p-2">
            <span className="text-xs text-gray-600">CUSTOMER SIGNATURE:</span>
            <div className="mt-1">
              <SignaturePad
                onSignatureChange={(data) => setSignatures(prev => ({ ...prev, main: data }))}
                signature={signatures.main}
                height={80}
              />
            </div>
          </div>
          <div className="border-t border-black p-2 flex justify-between items-center bg-gray-50">
            <span className="text-xs text-gray-600">DATE:</span>
            <span className="font-medium text-sm">{formatDate(new Date())}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-600 pt-2">
        <p>Edge Talent is a trading name of S&A Advertising Ltd</p>
        <p>Company No 8708429 VAT Reg No 171339904</p>
      </div>
    </div>
  );
};

/**
 * Page 2 - Confirmation Signatures (Mobile Responsive)
 */
const Page2Content = ({ contractData, signatures, setSignatures, formatDate, template }) => {
  // Use template values with fallbacks for confirmation texts
  const confirmations = [
    {
      key: 'notAgency',
      html: template?.confirmation1_text || 'I understand that Edge Talent is <strong>not a talent casting company/agency and will not find me work.</strong>'
    },
    {
      key: 'noCancel',
      html: template?.confirmation2_text || 'I understand that once I leave the premises I <strong>cannot cancel</strong>, amend or reduce the order.'
    },
    {
      key: 'passDetails',
      html: template?.confirmation3_text || 'I confirm that I am happy for Edge Talent to <strong>pass on details and photos</strong> of the client named on this order form. Talent Agencies we pass your details to typically charge between £50 - £200 to register onto their books'
    },
    {
      key: 'happyPurchase',
      html: template?.confirmation4_text || "I confirm that I'm happy and comfortable with my decision to purchase."
    },
  ];

  return (
    <div className="p-3 sm:p-8">
      {/* Header */}
      <div className="mb-6">
        <p className="font-bold text-sm sm:text-base mb-2">CUSTOMER NAME: <span className="font-normal">{contractData.customerName}</span></p>
        <p className="font-bold text-sm sm:text-base">DATE: <span className="font-normal">{formatDate(new Date())}</span></p>
      </div>

      {/* 4 Confirmation Boxes - Stacked on mobile */}
      <div className="space-y-4 sm:space-y-6">
        {confirmations.map((conf) => (
          <div key={conf.key} className="flex flex-col sm:flex-row gap-3 sm:gap-6 items-start border-b border-gray-200 pb-4 sm:border-0 sm:pb-0">
            {/* Signature Box */}
            <div className="w-full sm:w-44 flex-shrink-0 order-2 sm:order-1">
              <div className="border-2 border-black bg-white">
                <p className="text-xs text-gray-500 px-2 pt-1">TAP TO SIGN</p>
                <div className="relative">
                  <SignaturePad
                    onSignatureChange={(data) => setSignatures(prev => ({ ...prev, [conf.key]: data }))}
                    signature={signatures[conf.key]}
                    height={70}
                    small
                  />
                  {!signatures[conf.key] && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-gray-300 text-base italic">Sign Here</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Text */}
            <div className="flex-1 order-1 sm:order-2">
              <p className="text-sm sm:text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: conf.html }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * SignaturePad Component - Mobile Responsive
 */
const SignaturePad = ({ onSignatureChange, signature, height = 100, small = false }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!signature);
  const [context, setContext] = useState(null);
  const [canvasWidth, setCanvasWidth] = useState(small ? 180 : 350);
  const hasDrawnRef = useRef(false);

  // Responsive width
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth - 10;
        setCanvasWidth(Math.min(containerWidth, small ? 180 : 500));
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [small]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = canvasWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, height);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    setContext(ctx);

    if (signature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvasWidth, height);
        setHasSignature(true);
        hasDrawnRef.current = true;
      };
      img.src = signature;
    }
  }, [canvasWidth, height]);

  const getPosition = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.touches) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const startDrawing = useCallback((e) => {
    if (!context) return;
    e.preventDefault();
    const pos = getPosition(e);
    context.beginPath();
    context.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  }, [context, getPosition]);

  const draw = useCallback((e) => {
    if (!isDrawing || !context) return;
    e.preventDefault();
    const pos = getPosition(e);
    context.lineTo(pos.x, pos.y);
    context.stroke();
    hasDrawnRef.current = true;
    setHasSignature(true);
  }, [isDrawing, context, getPosition]);

  const stopDrawing = useCallback(() => {
    if (!context) return;
    const wasDrawing = isDrawing;
    context.closePath();
    setIsDrawing(false);
    if (wasDrawing && hasDrawnRef.current && canvasRef.current) {
      onSignatureChange(canvasRef.current.toDataURL('image/png'));
    }
  }, [context, isDrawing, onSignatureChange]);

  const handleMouseOut = useCallback(() => {
    if (!isDrawing) return;
    stopDrawing();
  }, [isDrawing, stopDrawing]);

  const clearCanvas = useCallback(() => {
    if (!context) return;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvasWidth, height);
    setHasSignature(false);
    hasDrawnRef.current = false;
    onSignatureChange(null);
  }, [context, canvasWidth, height, onSignatureChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', handleMouseOut);
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseleave', handleMouseOut);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
    };
  }, [startDrawing, draw, stopDrawing, handleMouseOut]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="border border-gray-300 cursor-crosshair touch-none bg-white block w-full"
        style={{ height: `${height}px` }}
      />
      {!hasSignature && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-gray-300 italic text-sm">Sign here</span>
        </div>
      )}
      {hasSignature && (
        <button type="button" onClick={clearCanvas}
          className="absolute top-1 right-1 p-1.5 bg-gray-100 rounded hover:bg-gray-200">
          <RotateCcw className="w-4 h-4 text-gray-500" />
        </button>
      )}
    </div>
  );
};

export default ContractSigning;
