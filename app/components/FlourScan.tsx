'use client';
import { useState, useRef } from 'react';

interface FlourScanProps {
  onResult: (result: { w: number; protein: number; name: string }) => void;
  onCancel: () => void;
}

type ScanState = 'upload' | 'analyzing' | 'result' | 'error';

export default function FlourScan({ onResult, onCancel }: FlourScanProps) {
  const [scanState, setScanState] = useState<ScanState>('upload');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [scanError, setScanError] = useState<'image' | 'service'>('image');
  const [extractedResult, setExtractedResult] = useState<{
    w: number; protein: number; name: string;
    readability: string; confidence: string; note: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function analyzeImage(base64: string, mediaType: string) {
    let text = '';
    try {
      const response = await fetch('/api/flour-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType }),
      });

      const data = await response.json();
      if (!response.ok) {
        const errMsg = data.error ?? 'API error';
        throw new Error(errMsg);
      }

      // Extract text from Anthropic response
      text = (data.content?.[0]?.text ?? '').trim();

      // Aggressive cleaning — strip any markdown, backticks, extra text
      // Find JSON object using regex in case there's surrounding text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate — w and name required, protein optional (default to 12)
      if (parsed.w != null && Number(parsed.w) > 0 && parsed.name) {
        setExtractedResult({
          w: Number(parsed.w),
          protein: Number(parsed.protein ?? 12),
          name: String(parsed.name),
          readability: String(parsed.readability ?? 'partial'),
          confidence: String(parsed.confidence ?? 'medium'),
          note: String(parsed.note ?? ''),
        });
        setScanState('result');
      } else {
        throw new Error('Missing required fields in response');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isBilling = msg.includes('credit') || msg.includes('billing') || msg.includes('balance');
      setScanError(isBilling ? 'service' : 'image');
      console.error('FlourScan error:', err, '| Raw API text:', text);
      setScanState('error');
    }
  }

  async function handleFile(file: File) {
    // Convert any image format to JPEG via canvas
    // This handles HEIC/HEIF from iPhone, AVIF, WebP, etc.
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

    const base64 = jpeg.split(',')[1];
    setImagePreviewUrl(jpeg);
    setScanState('analyzing');
    await analyzeImage(base64, 'image/jpeg');
  }

  function reset() {
    setScanState('upload');
    setImagePreviewUrl(null);
    setExtractedResult(null);
  }

  // ── STATE 1: Upload ──────────────────────────
  if (scanState === 'upload') {
    return (
      <div>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          style={{
            border: '2px dashed var(--border)',
            borderRadius: '18px',
            padding: '2.5rem 1.5rem',
            background: 'var(--warm)',
            cursor: 'pointer',
            textAlign: 'center',
            minHeight: '160px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '.75rem',
          }}
        >
          <span style={{ fontSize: '2rem' }}>📷</span>
          <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '1rem', color: 'var(--char)', fontWeight: 700 }}>
            Take a photo of your flour bag
          </div>
          <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '.78rem', color: 'var(--smoke)' }}>
            or drag and drop an image
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
        <button
          onClick={onCancel}
          style={{
            marginTop: '.75rem', background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--smoke)', fontSize: '.78rem', fontFamily: 'var(--font-dm-sans)',
            textDecoration: 'underline', textUnderlineOffset: '2px', padding: '.2rem 0',
          }}
        >
          ← Back
        </button>
      </div>
    );
  }

  // ── STATE 2: Analyzing ───────────────────────
  if (scanState === 'analyzing') {
    return (
      <div>
        {imagePreviewUrl && (
          <img
            src={imagePreviewUrl}
            alt="Flour bag"
            style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '12px' }}
          />
        )}
        <div style={{ marginTop: '.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '.82rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', marginBottom: '.5rem' }}>
            Analysing your flour bag...
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '.3rem' }}>
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

  // ── STATE 3: Result ──────────────────────────
  if (scanState === 'result' && extractedResult) {
    return (
      <div>
        <div style={{ display: 'flex', gap: '.75rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
          {imagePreviewUrl && (
            <img
              src={imagePreviewUrl}
              alt="Flour bag"
              style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
            />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '.95rem', color: 'var(--char)', marginBottom: '.5rem', lineHeight: 1.3 }}>
              {extractedResult.name}
            </div>
            {extractedResult.readability === 'unreadable' && (
              <div style={{
                marginTop: '.5rem',
                padding: '.45rem .7rem',
                background: '#FEF4EF',
                border: '1px solid #F5C4B0',
                borderRadius: '8px',
                fontSize: '.72rem',
                color: 'var(--terra)',
                lineHeight: 1.4,
              }}>
                ⚠️ Image unclear — values are estimated. Try a clearer photo of the front of the bag.
              </div>
            )}
            {extractedResult.readability === 'partial' && (
              <div style={{
                marginTop: '.5rem',
                padding: '.45rem .7rem',
                background: '#FFF8E8',
                border: '1px solid #E8D080',
                borderRadius: '8px',
                fontSize: '.72rem',
                color: '#7A5A10',
                lineHeight: 1.4,
              }}>
                🔍 Some values estimated — check W and protein match your bag.
              </div>
            )}
            <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginBottom: '.5rem' }}>
              <span style={{
                fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem',
                color: 'var(--terra)', background: '#FEF4EF',
                borderRadius: '20px', padding: '.2rem .6rem',
                border: '1px solid rgba(196,82,42,0.2)',
              }}>
                W {extractedResult.w}
              </span>
              <span style={{
                fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem',
                color: 'var(--sage)', background: 'rgba(107,122,90,0.1)',
                borderRadius: '20px', padding: '.2rem .6rem',
                border: '1px solid rgba(107,122,90,0.25)',
              }}>
                {extractedResult.protein}% protein
              </span>
            </div>
            <div style={{ fontSize: '.78rem', color: 'var(--smoke)', fontStyle: 'italic' }}>
              Tap to adjust if needed
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => onResult(extractedResult)}
            style={{
              flex: 2, padding: '.75rem 1rem', border: 'none',
              borderRadius: '12px', background: 'var(--terra)', color: '#fff',
              fontFamily: 'var(--font-playfair)', fontSize: '.95rem', fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Use this flour →
          </button>
          <button
            onClick={reset}
            style={{
              flex: 1, padding: '.75rem 1rem',
              border: '1.5px solid var(--border)', borderRadius: '12px',
              background: 'transparent', color: 'var(--smoke)',
              fontSize: '.85rem', cursor: 'pointer',
              fontFamily: 'var(--font-dm-sans)',
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ── STATE 4: Error ───────────────────────────
  return (
    <div style={{
      background: '#FEF4EF', border: '1.5px solid #F5C4B0',
      borderRadius: '12px', padding: '1.25rem',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '.88rem', fontWeight: 600, color: 'var(--terra)', marginBottom: '.4rem' }}>
        {scanError === 'service'
          ? 'Scan temporarily unavailable — enter your flour manually.'
          : 'Couldn\'t read the bag clearly'}
      </div>
      <div style={{ fontSize: '.8rem', color: 'var(--smoke)', marginBottom: '1rem', lineHeight: 1.5 }}>
        Try a clearer photo with good lighting, showing the front of the bag.
      </div>
      <button
        onClick={reset}
        style={{
          padding: '.6rem 1.25rem', border: 'none', borderRadius: '10px',
          background: 'var(--terra)', color: '#fff',
          fontSize: '.85rem', cursor: 'pointer',
          fontFamily: 'var(--font-dm-sans)',
        }}
      >
        Try again
      </button>
    </div>
  );
}
