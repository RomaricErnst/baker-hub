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
  const [extractedResult, setExtractedResult] = useState<{ w: number; protein: number; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function analyzeImage(base64: string, mediaType: string) {
    try {
      const response = await fetch('/api/flour-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'API error');

      const text = (data.content?.[0]?.text ?? '').trim();
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      if (parsed.w && parsed.protein && parsed.name) {
        setExtractedResult({
          w: Number(parsed.w),
          protein: Number(parsed.protein),
          name: parsed.name,
        });
        setScanState('result');
      } else {
        setScanState('error');
      }
    } catch {
      setScanState('error');
    }
  }

  async function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const base64 = dataUrl.split(',')[1];
      setImagePreviewUrl(dataUrl);
      setScanState('analyzing');
      await analyzeImage(base64, file.type);
    };
    reader.readAsDataURL(file);
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
          capture="environment"
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
        Couldn&apos;t read the bag clearly
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
