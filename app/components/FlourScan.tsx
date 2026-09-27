'use client';
import { useState, useRef, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { FLOUR_DB } from '@/lib/flourDatabase';

export function matchScannedFlour(name: string) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const matches = FLOUR_DB.filter(entry => entry.brand && normalize(`${entry.brand} ${entry.name}`) === normalize(name));
  return matches.length === 1 ? matches[0] : undefined;
}

export function validScannedValues(w: number, protein: number) {
  return Number.isFinite(w) && w >= 50 && w <= 500 && Number.isFinite(protein) && protein > 0 && protein <= 30;
}

interface FlourScanProps {
  onResult: (result: { w: number; protein: number; name: string }) => void;
  onCancel: () => void;
}

type ScanState = 'upload' | 'analyzing' | 'result' | 'error';

export default function FlourScan({ onResult, onCancel }: FlourScanProps) {
  const isFr = useLocale() === 'fr';
  const [scanState, setScanState] = useState<ScanState>('upload');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [scanError, setScanError] = useState<'image' | 'service'>('image');
  const [adjusting, setAdjusting] = useState(false);
  const [adjustedW, setAdjustedW] = useState<number | null>(null);
  const [adjustedProtein, setAdjustedProtein] = useState<number | null>(null);
  const [extractedResult, setExtractedResult] = useState<{
    w: number; protein: number; name: string;
    readability: string; confidence: string; source: string; note: string;
  } | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  function cancel() { requestRef.current?.abort(); onCancel(); }
  const backButton = <button type="button" onClick={cancel} style={{minHeight:44,padding:'8px 0',background:'none',border:0,color:'var(--terra)',fontSize:16,cursor:'pointer'}}>{isFr ? '← Retour aux farines' : '← Back to flours'}</button>;
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function analyzeImage(base64: string, mediaType: string, signal: AbortSignal) {
    let text = '';
    try {
      const response = await fetch('/api/flour-scan', {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType }),
      });

      const data = await response.json();
      if (!response.ok) {
        const errMsg = data.error ?? 'API error';
        throw new Error(`service: ${errMsg}`);
      }

      // Extract text from Anthropic response
      text = (data.content?.[0]?.text ?? '').trim();

      // Aggressive cleaning — strip any markdown, backticks, extra text
      // Find JSON object using regex in case there's surrounding text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate — w and name required, protein optional (default to 12)
      if (validScannedValues(Number(parsed.w), Number(parsed.protein ?? 12)) && parsed.name && parsed.readability !== 'unreadable') {
        setExtractedResult({
          w: Number(parsed.w),
          protein: Number(parsed.protein ?? 12),
          name: String(parsed.name),
          readability: String(parsed.readability ?? 'partial'),
          confidence: String(parsed.confidence ?? 'medium'),
          source: String(parsed.source ?? 'estimated'),
          note: String(parsed.note ?? ''),
        });
        setScanState('result');
      } else {
        throw new Error('Missing required fields in response');
      }
    } catch (err) {
      if (signal.aborted) return;
      const msg = err instanceof Error ? err.message : String(err);
      const isBilling = msg.includes('service:') || msg.includes('credit') || msg.includes('billing') || msg.includes('balance') || err instanceof TypeError;
      setScanError(isBilling ? 'service' : 'image');
      console.error('FlourScan error:', err, '| Raw API text:', text);
      setScanState('error');
    }
  }

  async function handleFile(file: File) {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setScanState('analyzing'); setImagePreviewUrl(null);
    setAdjusting(false); setAdjustedW(null); setAdjustedProtein(null); setExtractedResult(null);
    try {
    if (!file.type.startsWith('image/')) throw new Error('Not an image');
    // Decode supported image formats to JPEG via canvas
    // Browser-unsupported formats fall through to the retry/back state.
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // Use canvas to normalise to JPEG
    const jpeg = await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Resize if too large (max 1600px on longest side — enough for text recognition)
        const MAX = 1600;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not available')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });

    if (controller.signal.aborted) return;
    const base64 = jpeg.split(',')[1];
    setImagePreviewUrl(jpeg);
    setScanState('analyzing');
    await analyzeImage(base64, 'image/jpeg', controller.signal);
    } catch {
      if (!controller.signal.aborted) { setScanError('image'); setScanState('error'); }
    }
  }

  function reset() {
    requestRef.current?.abort();
    setAdjusting(false); setAdjustedW(null); setAdjustedProtein(null);
    setScanState('upload');
    setImagePreviewUrl(null);
    setExtractedResult(null);
  }

  // ── STATE 1: Upload ──────────────────────────
  if (scanState === 'upload') {
    return (
      <div>
        <div
          role="button" tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          style={{
            border: '2px dashed var(--border)',
            borderRadius: '16px',
            padding: '40px 24px',
            background: 'var(--warm)',
            cursor: 'pointer',
            textAlign: 'center',
            minHeight: '160px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="var(--terra)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 10 V6 a2 2 0 0 1 2-2 h4" /><path d="M22 4 h4 a2 2 0 0 1 2 2 v4" />
            <path d="M28 22 v4 a2 2 0 0 1-2 2 h-4" /><path d="M10 28 H6 a2 2 0 0 1-2-2 v-4" />
            <path d="M11 21 c0-4 1.5-5 2-7 h6 c.5 2 2 3 2 7 a2 2 0 0 1-2 2 h-6 a2 2 0 0 1-2-2 Z" fill="rgba(107, 68, 35,0.12)" />
            <line x1="12" y1="12" x2="20" y2="12" />
          </svg>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', color: 'var(--char)', fontWeight: 700 }}>
            {isFr ? 'Photographiez votre sachet de farine' : 'Take a photo of your flour bag'}
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--smoke)' }}>
            {isFr ? 'ou glissez-déposez une image' : 'or drag and drop an image'}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {backButton}
      </div>
    );
  }

  // ── STATE 2: Analyzing ───────────────────────
  if (scanState === 'analyzing') {
    return (
      <div>
        {backButton}
        {imagePreviewUrl && (
          <img
            src={imagePreviewUrl}
            alt="Flour bag"
            style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '16px' }}
          />
        )}
        <div style={{ marginTop: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', marginBottom: '8px' }}>
            {isFr ? 'Analyse de votre farine…' : 'Analysing your flour bag...'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className={`flour-scan-dot flour-scan-dot-${i + 1}`}
                style={{
                  display: 'inline-block', width: '8px', height: '8px',
                  borderRadius: '50%', background: 'var(--terra)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── STATE 3: Result ─────────────────────────
  if (scanState === 'result' && extractedResult) {
    const matchedEntry = matchScannedFlour(extractedResult.name);
    const isDatabase = !!matchedEntry;
    const isEstimated = !isDatabase;
    const displayW = matchedEntry?.w ?? adjustedW ?? extractedResult.w;
    const displayProtein = matchedEntry?.protein ?? adjustedProtein ?? extractedResult.protein;

    return (
      <div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'flex-start' }}>
          {imagePreviewUrl && (
            <img
              src={imagePreviewUrl}
              alt="Flour bag"
              style={{ width: '80px', height: '80px', borderRadius: '16px', objectFit: 'cover', flexShrink: 0 }}
            />
          )}
          <div style={{ flex: 1 }}>
            {/* Flour name */}
            <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--char)', marginBottom: '8px', lineHeight: 1.3 }}>
              {extractedResult.name}
            </div>

            {/* Status banner */}
            {isDatabase ? (
              <div style={{
                marginBottom: '8px', padding: '4px 12px',
                background: 'rgba(107,122,90,0.1)', border: '1px solid rgba(107,122,90,0.25)',
                borderRadius: '16px', fontSize: '12px', color: '#4A7A3A', lineHeight: 1.4,
              }}>
                {isFr ? '✓ Produit retrouvé dans le catalogue' : '✓ Product found in the catalogue'}
              </div>
            ) : (
              <div style={{
                marginBottom: '8px', padding: '4px 12px',
                background: '#FDFBF2', border: '1px solid #E8D890',
                borderRadius: '16px', fontSize: '12px', color: '#6A5A10', lineHeight: 1.4,
              }}>
                {isFr
                  ? 'Produit non retrouvé dans le catalogue. Choisissez son type à l’étape suivante et saisissez les valeurs du sachet si vous les connaissez.'
                  : 'Product not found in the catalogue. Choose its flour type next and enter the bag’s values if known.'}
              </div>
            )}

            {/* W and protein — tappable when estimated */}
            {!adjusting ? (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{
                  fontFamily: 'var(--font-ui)', fontSize: '12px',
                  color: 'var(--terra)', background: '#FEF4EF',
                  borderRadius: '20px', padding: '.2rem 8px',
                  border: '1px solid rgba(107, 68, 35,0.2)',
                }}>
                  W {matchedEntry?.wRange ? `${matchedEntry.wRangePublished?'':'~'}${matchedEntry.wRange[0]}–${matchedEntry.wRange[1]}` : `${matchedEntry && !matchedEntry.wPublished?'~':''}${displayW}`}
                </span>
                <span style={{
                  fontFamily: 'var(--font-ui)', fontSize: '12px',
                  color: 'var(--sage)', background: 'rgba(107,122,90,0.1)',
                  borderRadius: '20px', padding: '.2rem 8px',
                  border: '1px solid rgba(107,122,90,0.25)',
                }}>
                  {displayProtein}% {isFr?'de protéines':'protein'}
                </span>
                {isEstimated && (
                  <button
                    onClick={() => setAdjusting(true)}
                    style={{
                      background: 'none', border: 'none', padding: 0,
                      fontSize: '11px', color: 'var(--smoke)',
                      fontFamily: 'var(--font-ui)', cursor: 'pointer',
                      textDecoration: 'underline', textUnderlineOffset: '2px',
                    }}
                  >
                    {isFr ? 'Ajuster' : 'Adjust'}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', color: 'var(--smoke)', width: '60px', fontFamily: 'var(--font-ui)' }}>
                    W value
                  </label>
                  <input
                    type="number"
                    value={adjustedW ?? extractedResult.w}
                    onChange={e => setAdjustedW(Number(e.target.value))}
                    style={{
                      width: '80px', padding: '4px 8px', borderRadius: '8px',
                      border: '1.5px solid var(--border)', fontFamily: 'var(--font-ui)',
                      fontSize: '13px', color: 'var(--char)', background: 'var(--warm)',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--smoke)' }}>
                    (on bag? usually 180–380)
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', color: 'var(--smoke)', width: '60px', fontFamily: 'var(--font-ui)' }}>
                    Protein
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={adjustedProtein ?? extractedResult.protein}
                    onChange={e => setAdjustedProtein(Number(e.target.value))}
                    style={{
                      width: '80px', padding: '4px 8px', borderRadius: '8px',
                      border: '1.5px solid var(--border)', fontFamily: 'var(--font-ui)',
                      fontSize: '13px', color: 'var(--char)', background: 'var(--warm)',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--smoke)' }}>
                    % (check nutritional table)
                  </span>
                </div>
                <button
                  onClick={() => setAdjusting(false)}
                  style={{
                    alignSelf: 'flex-start', padding: '4px 12px',
                    background: 'var(--terra)', border: 'none', borderRadius: '12px',
                    color: '#fff', fontSize: '12px', cursor: 'pointer',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  {isFr ? 'Terminé' : 'Done'}
                </button>
              </div>
            )}
          </div>
        </div>

        {backButton}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            disabled={!validScannedValues(displayW, displayProtein)}
            onClick={() => onResult({ ...extractedResult, w: displayW, protein: displayProtein })}
            style={{
              flex: 2, padding: '12px 16px', border: 'none',
              borderRadius: '12px', background: 'var(--terra)', color: '#fff',
              fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {isDatabase ? (isFr ? 'Utiliser cette farine →' : 'Use this flour →') : (isFr ? 'Choisir le type de farine →' : 'Choose flour type →')}
          </button>
          <button
            onClick={reset}
            style={{
              flex: 1, padding: '12px 16px', minHeight: '44px',
              border: '1.5px solid var(--border)', borderRadius: '12px',
              background: 'transparent', color: 'var(--smoke)',
              fontSize: '14px', cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            {isFr ? 'Réessayer' : 'Try again'}
          </button>
        </div>
      </div>
    );
  }

  // ── STATE 4: Error ───────────────────────────
  return (
    <div style={{
      background: '#FEF4EF', border: '1.5px solid #F5C4B0',
      borderRadius: '16px', padding: '20px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--terra)', marginBottom: '8px' }}>
        {scanError === 'service'
          ? (isFr ? 'Scan temporairement indisponible — entrez votre farine manuellement.' : 'Scan temporarily unavailable — enter your flour manually.')
          : (isFr ? 'Lecture du sachet difficile' : 'Couldn\'t read the bag clearly')}
      </div>
      <div style={{ fontSize: '13px', color: 'var(--smoke)', marginBottom: '16px', lineHeight: 1.5 }}>
        {isFr ? 'Réessayez avec une photo plus nette, bien éclairée, montrant l’avant du sachet.' : 'Try a clearer photo with good lighting, showing the front of the bag.'}
      </div>
      {backButton}
      <button
        onClick={reset}
        style={{
          padding: '8px 20px', minHeight: '44px', border: 'none', borderRadius: '12px',
          background: 'var(--terra)', color: '#fff',
          fontSize: '14px', cursor: 'pointer',
          fontFamily: 'var(--font-ui)',
        }}
      >
        {isFr ? 'Réessayer' : 'Try again'}
      </button>
    </div>
  );
}
