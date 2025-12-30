import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Check, RotateCcw, Loader, AlertTriangle, CheckCircle, FileText, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * ContractSigning - Public page for customers to sign contracts
 * Displays the actual PDF contract and collects signatures
 */
const ContractSigning = () => {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contract, setContract] = useState(null);
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
    <div className="min-h-screen bg-gray-800 py-4 px-2 md:px-4">
      <div className="max-w-4xl mx-auto">

        {/* Progress Header */}
        <div className="bg-white rounded-t-lg p-4 flex items-center justify-between border-b">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Edge Talent Contract</h1>
            <p className="text-sm text-gray-500">{contractData.customerName}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Signatures: {signatureCount}/5</p>
            <div className="w-32 h-2 bg-gray-200 rounded-full mt-1">
              <div className="h-2 bg-green-500 rounded-full transition-all" style={{ width: `${(signatureCount/5)*100}%` }}></div>
            </div>
          </div>
        </div>

        {/* Page Tabs */}
        <div className="bg-gray-100 flex border-b">
          <button onClick={() => setCurrentPage(1)}
            className={`flex-1 py-3 text-center font-medium transition-colors ${currentPage === 1 ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
            Page 1: Invoice & Order
          </button>
          <button onClick={() => setCurrentPage(2)}
            className={`flex-1 py-3 text-center font-medium transition-colors ${currentPage === 2 ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
            Page 2: Confirmations
          </button>
        </div>

        {/* Contract Content */}
        <div className="bg-white shadow-2xl">
          {currentPage === 1 ? (
            <Page1Content contractData={contractData} signatures={signatures} setSignatures={setSignatures} formatCurrency={formatCurrency} formatDate={formatDate} />
          ) : (
            <Page2Content contractData={contractData} signatures={signatures} setSignatures={setSignatures} formatDate={formatDate} />
          )}
        </div>

        {/* Submit Footer */}
        <div className="bg-white rounded-b-lg p-4 border-t flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {signatureCount < 5 ? `${5 - signatureCount} signature(s) remaining` : 'All signatures complete!'}
          </p>
          <button onClick={handleSubmit} disabled={submitting || signatureCount < 5}
            className="px-8 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2">
            {submitting ? <><Loader className="w-5 h-5 animate-spin" /><span>Submitting...</span></> : <><Check className="w-5 h-5" /><span>Submit Signed Contract</span></>}
          </button>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 mt-4">
          <p>Edge Talent is a trading name of S&A Advertising Ltd</p>
          <p>Company No 8708429 | VAT Reg No 171339904</p>
        </div>
      </div>
    </div>
  );
};

/**
 * Page 1 - Invoice & Order Form (matching PDF layout exactly)
 */
const Page1Content = ({ contractData, signatures, setSignatures, formatCurrency, formatDate }) => {
  return (
    <div className="p-6 text-sm" style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px' }}>
      {/* Header - matches PDF */}
      <div className="flex justify-between items-start mb-4">
        <p className="text-xs">www.edgetalent.co.uk</p>
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-widest">EDGE TALENT</h1>
          <p className="text-xs">129A Weedington Rd, London NW5 4NX</p>
        </div>
        <div className="border border-black px-4 py-2">
          <span className="text-xs">Date: </span>
          <span className="font-medium">{formatDate(contractData.date)}</span>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold mb-1">INVOICE & ORDER FORM</h2>
        <p className="text-xs">PLEASE CHECK YOUR ORDER BEFORE LEAVING YOUR VIEWING</p>
        <p className="text-xs">FOR ALL ENQUIRIES PLEASE EMAIL CUSTOMER SERVICES ON SALES@EDGETALENT.CO.UK</p>
      </div>

      {/* Info Row - 4 columns with borders */}
      <table className="w-full border border-black mb-4 text-xs">
        <tbody>
          <tr>
            <td className="border-r border-black p-2 w-1/4">
              <span className="text-gray-600">Customer Nos.</span><br/>
              <span className="font-medium">{contractData.customerNumber || ''}</span>
            </td>
            <td className="border-r border-black p-2 w-1/4">
              <span className="text-gray-600">Studio no.</span><br/>
              <span className="font-medium">{contractData.studioNumber || ''}</span>
            </td>
            <td className="border-r border-black p-2 w-1/4">
              <span className="text-gray-600">Photographer</span><br/>
              <span className="font-medium">{contractData.photographer || ''}</span>
            </td>
            <td className="p-2 w-1/4">
              <span className="text-gray-600">Invoice no.</span><br/>
              <span className="font-medium">{contractData.invoiceNumber || ''}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Customer Details */}
      <h3 className="font-bold mb-1">CUSTOMER DETAILS</h3>
      <table className="w-full border border-black mb-4 text-xs">
        <tbody>
          <tr className="border-b border-black">
            <td className="p-2" colSpan="3">
              <span className="text-gray-600">NAME OF PERSON IN DIARY</span><br/>
              <span className="font-medium">{contractData.customerName || ''}</span>
            </td>
            <td className="border-l border-black p-2 text-center w-24">
              <span className="text-gray-600">VIP?</span><br/>
              <span className="font-medium">{contractData.isVip ? 'YES' : 'NO'}</span>
            </td>
          </tr>
          <tr className="border-b border-black">
            <td className="p-2" colSpan="4">
              <span className="text-gray-600">NAME OF CLIENT IF DIFFERENT</span><br/>
              <span className="font-medium">{contractData.clientNameIfDifferent || ''}</span>
            </td>
          </tr>
          <tr className="border-b border-black">
            <td className="p-2" colSpan="4">
              <span className="text-gray-600">ADDRESS</span><br/>
              <span className="font-medium">{contractData.address || ''}</span>
            </td>
          </tr>
          <tr className="border-b border-black">
            <td className="p-2 text-right" colSpan="4">
              <span className="text-gray-600">POSTCODE</span>
              <span className="font-medium ml-2">{contractData.postcode || ''}</span>
            </td>
          </tr>
          <tr>
            <td className="p-2 w-1/2">
              <span className="text-gray-600">PHONE/MOBILE NO.</span><br/>
              <span className="font-medium">{contractData.phone || ''}</span>
            </td>
            <td className="border-l border-black p-2" colSpan="3">
              <span className="text-gray-600">EMAIL:</span><br/>
              <span className="font-medium">{contractData.email || ''}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Order Details with SUB TOTAL/TOTAL on right */}
      <div className="flex gap-4 mb-2">
        <div className="flex-1">
          <h3 className="font-bold mb-1">ORDER DETAILS</h3>
          <table className="w-full border border-black text-xs">
            <tbody>
              <tr className="border-b border-black">
                <td className="p-2 w-36">DIGITAL IMAGES?</td>
                <td className="border-l border-black p-2 w-20 text-center">{contractData.digitalImages ? 'YES' : 'NO'}</td>
                <td className="border-l border-black p-2">QTY: <span className="font-medium">{contractData.digitalImagesQty || ''}</span></td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-2">DIGITAL Z-CARD?</td>
                <td className="border-l border-black p-2 text-center">{contractData.digitalZCard ? 'YES' : 'NO'}</td>
                <td className="border-l border-black p-2 text-gray-500">DIGITAL PDF ONLY</td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-2">EFOLIO?</td>
                <td className="border-l border-black p-2 text-center">{contractData.efolio ? 'YES' : 'NO'}</td>
                <td className="border-l border-black p-2">URL: <span className="font-medium">{contractData.efolioUrl || ''}</span></td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-2">PROJECT INFLUENCER?</td>
                <td className="border-l border-black p-2 text-center">{contractData.projectInfluencer ? 'YES' : 'NO'}</td>
                <td className="border-l border-black p-2">LOGIN: <span className="font-medium">{contractData.influencerLogin || ''}</span> &nbsp; PASSWORD: <span className="font-medium">{contractData.influencerPassword || ''}</span></td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-2" colSpan="3">
                  I <span className="font-bold">{contractData.allowImageUse ? 'DO' : 'DO NOT'}</span> give permission for Edge Talent to use my images
                </td>
              </tr>
              <tr>
                <td className="p-2" colSpan="2">Digital Images checked & received?</td>
                <td className="border-l border-black p-2 text-center">YES / NO / N.A</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="w-28">
          <table className="w-full border border-black text-xs h-full">
            <tbody>
              <tr className="border-b border-black">
                <td className="p-2 text-center">
                  <span className="text-gray-600">SUB TOTAL</span><br/>
                  <span className="font-medium">{formatCurrency(contractData.subtotal)}</span>
                </td>
              </tr>
              <tr>
                <td className="p-2 text-center">
                  <span className="font-bold">TOTAL</span><br/>
                  <span className="font-bold text-base">{formatCurrency(contractData.total)}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes */}
      <div className="mb-3">
        <span className="font-bold text-xs">NOTES:</span>
        <div className="border border-black p-2 min-h-12 text-xs mt-1">{contractData.notes || ''}</div>
      </div>

      {/* Terms */}
      <div className="text-xs text-gray-700 mb-3 leading-tight" style={{ fontSize: '9px' }}>
        <strong>Terms and Conditions:</strong> By signing this invoice, you confirm that you have viewed, selected and approved all images and all cropping, editing and adjustments. You understand that all orders are final and due to the immediate nature of digital delivery this order is strictly non-refundable, non-cancellable and non-amendable once you leave the premises, without affecting your statutory rights. All digital products, including images, efolios and Z-cards and Project Influencer are delivered immediately upon full payment. Project Influencer has been added to this order as a complimentary addition to your purchased package and holds no independent monetary value. By signing you accept responsibility for downloading, backing up and securely storing your files once they are provided. Finance customers must complete all Payl8r documentation prior to receipt of goods. Efolios include 10 images and hosting for 1 year, which may require renewal thereafter; content may be removed if renewal fees are unpaid. You own the copyright to all images purchased and unless you opt out in writing at the time of signing, Edge Talent may use your images for promotional purposes (above) including, but not limited to, display on its website and social media channels. You acknowledge that Edge Talent is not an talent casting company/talent casting company/agency and does not guarantee work, representation or casting opportunities. Edge Talent accepts no liability for compatibility issues, loss of files after delivery, missed opportunities, or indirect losses and total liability is limited to the amount paid for your order. All personal data is processed in accordance with GDPR and used only to fulfil your order or meet legal requirements. By signing below, you acknowledge that you have read, understood and agree to these Terms & Conditions. For any post-delivery assistance, please contact sales@edgetalent.co.uk
      </div>

      {/* Payment Details Table - matches PDF layout */}
      <table className="w-full border border-black mb-3 text-xs">
        <tbody>
          <tr className="border-b border-black">
            <td className="p-2 border-r border-black w-28">PAYMENT DETAILS</td>
            <td className="p-2 border-r border-black text-center w-28">CREDIT/DEBIT CARD</td>
            <td className="p-2 border-r border-black text-center w-16">CASH</td>
            <td className="p-2 border-r border-black text-center w-20">FINANCE</td>
            <td className="p-2 text-right">SUB TOTAL</td>
          </tr>
          <tr className="border-b border-black">
            <td className="p-2 border-r border-black">PAYMENT TODAY</td>
            <td className="p-2 border-r border-black text-center">{contractData.paymentMethod === 'card' ? '✓' : ''}</td>
            <td className="p-2 border-r border-black text-center">{contractData.paymentMethod === 'cash' ? '✓' : ''}</td>
            <td className="p-2 border-r border-black text-center">{contractData.paymentMethod === 'finance' ? '✓' : ''}</td>
            <td className="p-2 text-right font-medium">{formatCurrency(contractData.subtotal)}</td>
          </tr>
          <tr className="border-b border-black">
            <td className="p-2 border-r border-black text-xs text-gray-500" rowSpan="2">Viewer must initial any cash received and sign here</td>
            <td className="p-2 border-r border-black" rowSpan="2"></td>
            <td className="p-2 border-r border-black text-center" colSpan="2">VAT@20%</td>
            <td className="p-2 text-right font-medium">{formatCurrency(contractData.vatAmount)}</td>
          </tr>
          <tr>
            <td className="p-2 border-r border-black text-center" colSpan="2">
              <span className="text-xs">AUTHORISATION CODE:</span><br/>
              <span className="font-medium">{contractData.authCode || ''}</span>
            </td>
            <td className="p-2">
              <div className="text-right">
                <span className="font-bold">TOTAL</span><br/>
                <span className="font-bold text-lg">{formatCurrency(contractData.total)}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Main Signature Section */}
      <div className="mb-3">
        <p className="text-xs font-bold mb-2">PLEASE SIGN BELOW TO INDICATE YOUR ACCEPTANCE OF THE ABOVE TERMS, AND ENSURE YOU RECEIVE YOUR OWN SIGNED COPY OF THIS INVOICE FOR YOUR RECORDS</p>
        <table className="w-full border border-black">
          <tbody>
            <tr>
              <td className="p-2 border-r border-black" style={{ width: '75%' }}>
                <span className="text-xs">CUSTOMER SIGNATURE:</span>
                <div className="mt-1">
                  <SignaturePad
                    onSignatureChange={(data) => setSignatures(prev => ({ ...prev, main: data }))}
                    signature={signatures.main}
                    height={70}
                  />
                </div>
              </td>
              <td className="p-2 text-center">
                <span className="text-xs">DATE:</span>
                <div className="font-medium mt-2">{formatDate(new Date())}</div>
              </td>
            </tr>
          </tbody>
        </table>
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
 * Page 2 - Confirmation Signatures (matching PDF layout exactly)
 * Signature boxes on LEFT, text on RIGHT
 */
const Page2Content = ({ contractData, signatures, setSignatures, formatDate }) => {
  const confirmations = [
    {
      key: 'notAgency',
      text: 'I understand that Edge Talent is ',
      bold: 'not a talent casting company/agency and will not find me work.'
    },
    {
      key: 'noCancel',
      text: 'I understand that once I leave the premises I ',
      bold: 'cannot cancel, amend or reduce the order.'
    },
    {
      key: 'passDetails',
      text: 'I confirm that I am happy for Edge Talent to ',
      bold: 'pass on details and photos',
      after: ' of the client named on this order form. Talent Agencies we pass your details to typically charge between £50 - £200 to register onto their books'
    },
    {
      key: 'happyPurchase',
      text: "I confirm that I'm happy and comfortable with my decision to purchase.",
      bold: ''
    },
  ];

  return (
    <div className="p-8" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header - matches PDF */}
      <div className="mb-8">
        <p className="font-bold text-base mb-3">CUSTOMER NAME: <span className="font-normal">{contractData.customerName}</span></p>
        <p className="font-bold text-base">DATE: <span className="font-normal">{formatDate(new Date())}</span></p>
      </div>

      {/* 4 Confirmation Boxes - signature LEFT, text RIGHT (matches PDF) */}
      <div className="space-y-8">
        {confirmations.map((conf) => (
          <div key={conf.key} className="flex gap-8 items-start">
            {/* Signature Box - LEFT side */}
            <div className="w-44 flex-shrink-0">
              <div className="border-2 border-black bg-white">
                <p className="text-xs text-gray-500 px-2 pt-1">CLICK TO SIGN</p>
                <div className="relative">
                  <SignaturePad
                    onSignatureChange={(data) => setSignatures(prev => ({ ...prev, [conf.key]: data }))}
                    signature={signatures[conf.key]}
                    height={80}
                    small
                  />
                  {!signatures[conf.key] && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-gray-300 text-lg italic">Sign Here</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Text - RIGHT side */}
            <div className="flex-1 pt-4">
              <p className="text-base leading-relaxed">
                {conf.text}<strong>{conf.bold}</strong>{conf.after || ''}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * SignaturePad Component
 * Fixed: Only registers signature when actual drawing occurs (not on hover/mouseout)
 */
const SignaturePad = ({ onSignatureChange, signature, height = 100, small = false }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!signature);
  const [context, setContext] = useState(null);
  // Track if any strokes were made during this drawing session
  const hasDrawnRef = useRef(false);

  const width = small ? 180 : 350;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    setContext(ctx);

    if (signature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        setHasSignature(true);
        hasDrawnRef.current = true;
      };
      img.src = signature;
    }
  }, [width, height]);

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
    // Mark that actual drawing has occurred
    hasDrawnRef.current = true;
    setHasSignature(true);
  }, [isDrawing, context, getPosition]);

  const stopDrawing = useCallback(() => {
    if (!context) return;

    // Only save signature if user was actually drawing AND made strokes
    const wasDrawing = isDrawing;

    context.closePath();
    setIsDrawing(false);

    // Only trigger signature change if actual drawing occurred
    if (wasDrawing && hasDrawnRef.current && canvasRef.current) {
      onSignatureChange(canvasRef.current.toDataURL('image/png'));
    }
  }, [context, isDrawing, onSignatureChange]);

  // Handle mouse leaving canvas - only stop if actively drawing
  const handleMouseOut = useCallback(() => {
    if (!isDrawing) return; // Don't do anything if not drawing
    stopDrawing();
  }, [isDrawing, stopDrawing]);

  const clearCanvas = useCallback(() => {
    if (!context) return;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    setHasSignature(false);
    hasDrawnRef.current = false;
    onSignatureChange(null);
  }, [context, width, height, onSignatureChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', handleMouseOut); // Changed from mouseout to mouseleave
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
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="border border-gray-300 cursor-crosshair touch-none bg-white block"
        style={{ width: `${width}px`, height: `${height}px` }}
      />
      {!hasSignature && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-gray-300 italic">Sign here</span>
        </div>
      )}
      {hasSignature && (
        <button type="button" onClick={clearCanvas}
          className="absolute top-1 right-1 p-1 bg-gray-100 rounded hover:bg-gray-200">
          <RotateCcw className="w-3 h-3 text-gray-500" />
        </button>
      )}
    </div>
  );
};

export default ContractSigning;
