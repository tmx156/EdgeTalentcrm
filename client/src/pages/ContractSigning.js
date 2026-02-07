import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useParams } from 'react-router-dom';
import { Check, RotateCcw, Loader, AlertTriangle, CheckCircle, FileText } from 'lucide-react';

/**
 * ContractSigning - Public page for customers to sign contracts
 * Renders the same HTML as the contract editor/PDF generator,
 * with interactive signature pads injected via React portals.
 */
const ContractSigning = () => {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contract, setContract] = useState(null);
  const [template, setTemplate] = useState(null);
  const [contractHTML, setContractHTML] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState('auto');

  // Signature states
  const [signatures, setSignatures] = useState({
    main: null,
    notAgency: null,
    noCancel: null,
    passDetails: null,
    happyPurchase: null
  });

  // Refs for signature portal targets
  const [signaturePortals, setSignaturePortals] = useState({});
  const previewRef = useRef(null);
  const innerRef = useRef(null);
  const containerRef = useRef(null);

  // A4 width in pixels at 96dpi ≈ 794px (210mm)
  const A4_WIDTH = 794;

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
        setContractHTML(data.html || '');
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

  // Parse HTML into individual pages (same pattern as ContractEditor.js)
  const getPageHTML = useCallback((pageNum) => {
    if (!contractHTML) return '';

    const parser = new DOMParser();
    const doc = parser.parseFromString(contractHTML, 'text/html');
    const pages = doc.querySelectorAll('.page');

    // Get styles from head
    const styles = doc.querySelector('style');
    const styleHTML = styles ? styles.outerHTML : '';

    if (pages.length >= pageNum) {
      return styleHTML + pages[pageNum - 1].outerHTML;
    }
    return '';
  }, [contractHTML]);

  // After HTML renders, find [data-signature] elements and store DOM refs for portals
  useEffect(() => {
    if (!previewRef.current || !contractHTML) return;

    // Small delay to ensure DOM has rendered
    const timer = setTimeout(() => {
      const sigElements = previewRef.current.querySelectorAll('[data-signature]');
      const portals = {};

      sigElements.forEach((el) => {
        const sigName = el.getAttribute('data-signature');
        if (sigName) {
          // Clear existing content (the "Sign Here" placeholder or img)
          el.innerHTML = '';
          portals[sigName] = el;
        }
      });

      setSignaturePortals(portals);
    }, 50);

    return () => clearTimeout(timer);
  }, [contractHTML, currentPage]);

  // Calculate mobile scale based on container width
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const newScale = Math.min(1, containerWidth / A4_WIDTH);
        setScale(newScale);
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // Measure actual content height and set wrapper height = contentHeight * scale
  // This collapses the dead space caused by transform: scale() not affecting layout
  useEffect(() => {
    const measure = () => {
      if (!innerRef.current) return;
      const contentH = innerRef.current.scrollHeight;
      setScaledHeight(Math.ceil(contentH * scale));
    };

    // Measure after portals have rendered
    const timer = setTimeout(measure, 100);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', measure);
    };
  }, [scale, contractHTML, currentPage, signaturePortals]);

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

  // Which signatures are on which page
  const page1Signatures = ['main'];
  const page2Signatures = ['notAgency', 'noCancel', 'passDetails', 'happyPurchase'];
  const currentPageSignatures = currentPage === 1 ? page1Signatures : page2Signatures;

  return (
    <div className="min-h-screen bg-gray-800 py-2 px-1 sm:py-4 sm:px-4">
      <div className="max-w-4xl mx-auto" ref={containerRef}>

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

        {/* Contract Content - Server-rendered HTML with mobile scaling */}
        <div className="bg-white shadow-2xl overflow-hidden" style={{ height: scaledHeight !== 'auto' ? `${scaledHeight}px` : 'auto' }}>
          <div
            ref={innerRef}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              width: `${A4_WIDTH}px`
            }}
          >
            <style>{`
              [data-signature] {
                cursor: pointer;
                position: relative;
                transition: outline 0.2s;
              }
              [data-signature]:hover {
                outline: 3px solid #22c55e;
                outline-offset: 2px;
                border-radius: 4px;
              }
              [data-editable]:hover {
                outline: none !important;
              }
              .page {
                min-height: auto !important;
              }
              /* Page 2: Stack confirmation rows vertically for usable signature areas */
              [data-editable^="confirmation"] {
                flex-direction: column !important;
                gap: 10px !important;
              }
              /* Make signature boxes full width instead of 160px */
              [data-editable^="confirmation"] > [data-signature] {
                width: 100% !important;
                min-height: 90px !important;
                order: 2;
              }
              /* Text comes first (above signature) */
              [data-editable^="confirmation"] > div:not([data-signature]) {
                order: 1;
                padding-top: 0 !important;
              }
            `}</style>
            <div
              ref={previewRef}
              dangerouslySetInnerHTML={{ __html: getPageHTML(currentPage) }}
            />
          </div>
        </div>

        {/* Render signature pads via portals into [data-signature] elements */}
        {currentPageSignatures.map((sigName) => {
          const portalTarget = signaturePortals[sigName];
          if (!portalTarget) return null;

          const isSmall = sigName !== 'main';
          const sigHeight = isSmall ? 70 : 80;

          return ReactDOM.createPortal(
            <div style={{ position: 'relative' }}>
              {!signatures[sigName] && isSmall && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none', zIndex: 1
                }}>
                  <span style={{ color: '#ccc', fontSize: '14px', fontStyle: 'italic' }}>Sign Here</span>
                </div>
              )}
              <SignaturePad
                onSignatureChange={(data) => setSignatures(prev => ({ ...prev, [sigName]: data }))}
                signature={signatures[sigName]}
                height={sigHeight}
                small={isSmall}
                parentScale={scale}
              />
            </div>,
            portalTarget
          );
        })}

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
          <p>{template?.footer_line1 || ''}</p>
          <p>{template?.footer_line2 || ''}</p>
        </div>
      </div>
    </div>
  );
};

/**
 * SignaturePad Component - Mobile Responsive
 */
const SignaturePad = ({ onSignatureChange, signature, height = 100, small = false, parentScale = 1 }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!signature);
  const [context, setContext] = useState(null);
  const [canvasWidth, setCanvasWidth] = useState(350);
  const hasDrawnRef = useRef(false);

  // Responsive width - fill the container
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth - 10;
        setCanvasWidth(Math.max(containerWidth, 100));
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
    // getBoundingClientRect() returns the visual (post-transform) rect.
    // Canvas drawing expects unscaled coordinates, so divide by parentScale
    // to convert from visual touch position to canvas internal coordinates.
    const s = parentScale || 1;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) / s,
        y: (e.touches[0].clientY - rect.top) / s
      };
    }
    return {
      x: (e.clientX - rect.left) / s,
      y: (e.clientY - rect.top) / s
    };
  }, [parentScale]);

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
      {!hasSignature && !small && (
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
