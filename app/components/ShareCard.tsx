'use client';
import { useRef, useState } from 'react';
import { PIZZAS, DESSERT_PIZZAS } from '@/app/lib/toppingDatabase';
import type { BakePhoto } from '@/app/lib/supabase/fetchBakeEvents';

interface ShareCardProps {
  styleName: string;
  numItems: number;
  itemWeight: number;
  hydration: number | null;
  prefLabel: string | null;
  flourLine: string | null;
  recipeFlour: number | null;
  recipeWater: number | null;
  recipeSalt: number | null;
  coldH: number;
  rtH: number;
  bakedQtys: Record<string, number> | null;
  localSlots: Array<{ preset_id: string; qty?: number }>;
  sessionPhotos: BakePhoto[];
  locale: string;
  status: string;
  onClose: () => void;
}

function formatH(h: number): string {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  if (mins === 0) return `${whole}h`;
  return `${whole}h ${mins}m`;
}

const CARD_SIZE = 1080;

export default function ShareCard({
  styleName, numItems, itemWeight, hydration, prefLabel, flourLine,
  recipeFlour, recipeWater, recipeSalt, coldH, rtH,
  bakedQtys, localSlots, sessionPhotos, locale, status, onClose,
}: ShareCardProps) {
  const l = locale === 'fr' ? 'fr' : 'en';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [template, setTemplate] = useState<'full' | 'two' | 'text'>('full');
  const [selectedPhotoUrls, setSelectedPhotoUrls] = useState<string[]>([]);
  const [cameraPhotoUrls, setCameraPhotoUrls] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  const allPizzas = [...PIZZAS, ...DESSERT_PIZZAS];

  const statusLabel =
    status === 'baked' ? (l === 'fr' ? 'Tout juste sorti du four' : 'Straight from the oven') :
    status === 'pizza_planned' ? (l === 'fr' ? 'Ce soir au menu' : "Tonight's menu") :
    (l === 'fr' ? 'En préparation' : 'In the making');

  const pizzaLines: string[] = (() => {
    const src = bakedQtys && Object.values(bakedQtys).some(v => v > 0)
      ? Object.entries(bakedQtys).filter(([, q]) => q > 0)
      : localSlots.map(s => [s.preset_id, s.qty ?? 1] as [string, number]);
    return src.map(([id, qty]) => {
      const p = allPizzas.find(x => x.id === id);
      const name = p ? ((p.name as Record<string, string>)[l] ?? (p.name as Record<string, string>).en ?? id) : id;
      return qty > 1 ? `${name} ×${qty}` : name;
    });
  })();

  const line1Parts = [
    styleName,
    numItems && itemWeight ? `${numItems} × ${itemWeight}g` : null,
    hydration != null ? `${hydration}%` : null,
    prefLabel,
  ].filter(Boolean).join(' · ');

  const line2Parts = recipeFlour && recipeWater && recipeSalt
    ? `${recipeFlour}g flour · ${recipeWater}g water · ${recipeSalt}g salt`
    : null;

  const line3Parts = [
    coldH > 0 ? `Cold ${formatH(coldH)}` : null,
    rtH > 0 ? `RT ${formatH(rtH)}` : null,
  ].filter(Boolean).join(' · ');

  const allPhotos = [
    ...sessionPhotos.map(p => ({ url: p.photo_url, source: 'session' as const })),
    ...cameraPhotoUrls.map(url => ({ url, source: 'camera' as const })),
  ];

  function togglePhoto(url: string) {
    setSelectedPhotoUrls(prev => {
      if (prev.includes(url)) return prev.filter(u => u !== url);
      const max = template === 'two' ? 2 : 1;
      if (prev.length >= max) return [...prev.slice(1), url];
      return [...prev, url];
    });
  }

  async function drawCard(): Promise<HTMLCanvasElement | null> {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    canvas.width = CARD_SIZE;
    canvas.height = CARD_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#1A1612';
    ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

    async function loadImg(url: string): Promise<HTMLImageElement | null> {
      return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
      });
    }

    if (template === 'text') {
      ctx.strokeStyle = 'rgba(212,168,83,0.04)';
      ctx.lineWidth = 1;
      for (let i = -CARD_SIZE; i < CARD_SIZE * 2; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + CARD_SIZE, CARD_SIZE); ctx.stroke();
      }
    } else if (template === 'full' && selectedPhotoUrls[0]) {
      const img = await loadImg(selectedPhotoUrls[0]);
      if (img) {
        const scale = Math.max(CARD_SIZE / img.width, CARD_SIZE / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (CARD_SIZE - w) / 2, (CARD_SIZE - h) / 2, w, h);
      }
      const grad = ctx.createLinearGradient(0, CARD_SIZE * 0.3, 0, CARD_SIZE);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.5, 'rgba(0,0,0,0.55)');
      grad.addColorStop(1, 'rgba(0,0,0,0.88)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);
    } else if (template === 'two') {
      const photoHeight = CARD_SIZE * 0.52;
      const urls = selectedPhotoUrls.slice(0, 2);
      for (let i = 0; i < 2; i++) {
        if (urls[i]) {
          const img = await loadImg(urls[i]);
          if (img) {
            const slotW = CARD_SIZE / 2 - 1;
            const scale = Math.max(slotW / img.width, photoHeight / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            ctx.save();
            ctx.beginPath();
            ctx.rect(i * (CARD_SIZE / 2 + 2), 0, slotW, photoHeight);
            ctx.clip();
            ctx.drawImage(img, i * (CARD_SIZE / 2 + 2) + (slotW - w) / 2, (photoHeight - h) / 2, w, h);
            ctx.restore();
          }
        } else {
          ctx.fillStyle = '#2D2420';
          ctx.fillRect(i * (CARD_SIZE / 2 + 2), 0, CARD_SIZE / 2 - 1, photoHeight);
        }
      }
      const grad2 = ctx.createLinearGradient(0, photoHeight * 0.6, 0, photoHeight + 60);
      grad2.addColorStop(0, 'rgba(26,22,18,0)');
      grad2.addColorStop(1, 'rgba(26,22,18,1)');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, photoHeight * 0.6, CARD_SIZE, photoHeight * 0.4 + 60);
    }

    const textStartY = template === 'full'
      ? CARD_SIZE * 0.52
      : template === 'two'
      ? CARD_SIZE * 0.57
      : CARD_SIZE * 0.22;

    ctx.font = '500 36px "DM Mono", monospace';
    ctx.fillStyle = '#D4A853';
    ctx.letterSpacing = '4px';
    ctx.fillText(statusLabel.toUpperCase(), 72, textStartY);

    ctx.font = 'bold 130px "Playfair Display", Georgia, serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.letterSpacing = '0px';
    const words = styleName.split(' ');
    let lineY = textStartY + 80;
    let currentLine = '';
    const maxW = CARD_SIZE - 144;
    for (const word of words) {
      const test = currentLine ? currentLine + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && currentLine) {
        ctx.fillText(currentLine, 72, lineY);
        lineY += 140;
        currentLine = word;
      } else {
        currentLine = test;
      }
    }
    if (currentLine) { ctx.fillText(currentLine, 72, lineY); lineY += 140; }

    lineY += 20;
    ctx.strokeStyle = '#D4A853';
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(72, lineY); ctx.lineTo(CARD_SIZE - 72, lineY); ctx.stroke();
    ctx.globalAlpha = 1;
    lineY += 44;

    ctx.font = '400 38px "DM Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.fillText(line1Parts, 72, lineY); lineY += 54;
    if (flourLine) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '400 32px "DM Mono", monospace';
      ctx.fillText(flourLine, 72, lineY); lineY += 46;
      ctx.font = '400 38px "DM Mono", monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
    }
    if (line2Parts) { ctx.fillText(line2Parts, 72, lineY); lineY += 54; }
    if (line3Parts) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillText(line3Parts, 72, lineY); lineY += 54; }

    if (pizzaLines.length > 0) {
      lineY += 12;
      ctx.font = 'italic 400 36px "DM Sans", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(pizzaLines.join(' · '), 72, lineY);
    }

    ctx.font = '500 30px "DM Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('🍕 BAKER HUB · bakerhub.app', 72, CARD_SIZE - 60);

    return canvas;
  }

  async function handleShare() {
    setGenerating(true);
    try {
      const canvas = await drawCard();
      if (!canvas) return;
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;
      const file = new File([blob], 'my-bake.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: styleName });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'my-bake.png'; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) { console.error(e); }
    setGenerating(false);
  }

  const monoSm: React.CSSProperties = { fontFamily: 'var(--font-dm-mono)', fontSize: '11px', color: 'var(--smoke)' };
  const sectionLbl: React.CSSProperties = {
    fontFamily: 'var(--font-dm-mono)', fontSize: '10px', color: 'var(--smoke)',
    textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '10px',
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'var(--warm)',
      borderRadius: '20px 20px 0 0', zIndex: 10,
      display: 'flex', flexDirection: 'column', overflowY: 'hidden',
    }}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Header */}
      <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <p style={{ fontFamily: 'var(--font-playfair)', fontSize: '18px', fontWeight: 700, color: 'var(--char)', margin: 0 }}>
          {l === 'fr' ? 'Partager ce bake' : 'Share this bake'}
        </p>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--smoke)', fontSize: '18px' }}>✕</button>
      </div>

      {/* Scrollable body */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Live preview */}
        <div style={{ width: '100%', aspectRatio: '1', background: '#1A1612', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
          <PreviewCard
            template={template}
            statusLabel={statusLabel}
            styleName={styleName}
            line1Parts={line1Parts}
            flourLine={flourLine}
            line2Parts={line2Parts}
            line3Parts={line3Parts}
            pizzaLines={pizzaLines}
            selectedPhotoUrls={selectedPhotoUrls}
          />
        </div>

        {/* Template picker */}
        <div>
          <div style={sectionLbl}>{l === 'fr' ? 'Format' : 'Template'}</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {(['full', 'two', 'text'] as const).map(t => (
              <div key={t} onClick={() => setTemplate(t)} style={{ flex: 1, cursor: 'pointer' }}>
                <div style={{
                  aspectRatio: '1', background: '#1A1612', borderRadius: '8px',
                  border: template === t ? '2px solid var(--gold)' : '1.5px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', position: 'relative',
                }}>
                  {t === 'full' && (
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.5) 100%)', display: 'flex', alignItems: 'flex-end', padding: '6px' }}>
                      <div style={{ width: '100%', height: '30%', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }} />
                    </div>
                  )}
                  {t === 'two' && (
                    <div style={{ position: 'absolute', inset: 0 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', height: '50%' }}>
                        <div style={{ background: 'rgba(255,255,255,0.07)' }} />
                        <div style={{ background: 'rgba(255,255,255,0.07)' }} />
                      </div>
                      <div style={{ padding: '4px 6px', marginTop: '4px' }}>
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', marginBottom: '3px' }} />
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', width: '70%' }} />
                      </div>
                    </div>
                  )}
                  {t === 'text' && <span style={{ fontSize: '16px', opacity: 0.3 }}>Aa</span>}
                </div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '9px', color: 'var(--smoke)', textAlign: 'center', marginTop: '4px' }}>
                  {t === 'full' ? '1 photo' : t === 'two' ? '2 photos' : (l === 'fr' ? 'Texte' : 'Text only')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Photo picker */}
        {template !== 'text' && (
          <div>
            <div style={sectionLbl}>
              {l === 'fr' ? 'Photos' : 'Photos'}
              <span style={{ opacity: 0.5, marginLeft: '6px' }}>
                {template === 'two' ? (l === 'fr' ? '(2 max)' : '(pick up to 2)') : (l === 'fr' ? '(1 photo)' : '(pick 1)')}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {allPhotos.map((p, i) => (
                <div
                  key={i}
                  onClick={() => togglePhoto(p.url)}
                  style={{
                    width: '72px', height: '72px', borderRadius: '8px', overflow: 'hidden',
                    cursor: 'pointer', position: 'relative', flexShrink: 0,
                    outline: selectedPhotoUrls.includes(p.url) ? '2.5px solid var(--gold)' : '2px solid transparent',
                  }}
                >
                  <img src={p.url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="" />
                  {selectedPhotoUrls.includes(p.url) && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(212,168,83,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: 'white', fontSize: '18px' }}>✓</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Camera roll picker */}
              <label style={{
                width: '72px', height: '72px', borderRadius: '8px',
                border: '1.5px dashed var(--border)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', gap: '4px', flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--smoke)" strokeWidth="1.5">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <circle cx="12" cy="12" r="3.5" />
                </svg>
                <span style={{ ...monoSm, fontSize: '9px', textAlign: 'center' }}>
                  {l === 'fr' ? 'Pellicule' : 'Camera roll'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={e => {
                    const files = Array.from(e.target.files ?? []);
                    files.forEach(file => {
                      const url = URL.createObjectURL(file);
                      setCameraPhotoUrls(prev => [...prev, url]);
                      setSelectedPhotoUrls(prev => {
                        const max = template === 'two' ? 2 : 1;
                        return [...prev.slice(-(max - 1)), url];
                      });
                    });
                    e.target.value = '';
                  }}
                />
              </label>

              {allPhotos.length === 0 && (
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '11px', color: 'var(--smoke)', fontStyle: 'italic', alignSelf: 'center' }}>
                  {l === 'fr' ? 'Aucune photo — choisissez depuis la pellicule' : 'No session photos yet — pick from camera roll'}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Action bar */}
      <div style={{ padding: '12px 20px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <button
          onClick={handleShare}
          disabled={generating}
          style={{
            width: '100%', padding: '15px',
            background: generating ? 'var(--smoke)' : 'var(--terra)',
            color: 'white', border: 'none', borderRadius: '12px',
            fontFamily: 'var(--font-playfair)', fontSize: '17px', fontWeight: 700,
            cursor: generating ? 'default' : 'pointer',
            boxShadow: '0 2px 8px rgba(196,82,42,0.25)',
          }}
        >
          {generating
            ? (l === 'fr' ? 'Génération...' : 'Generating...')
            : (l === 'fr' ? '✦ Partager' : '✦ Share this bake')}
        </button>
        <p style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '10px', color: 'var(--smoke)', textAlign: 'center', marginTop: '8px', opacity: 0.6 }}>
          {l === 'fr' ? 'Partage natif iOS/Android · Téléchargement sur desktop' : 'Native share on iOS/Android · Downloads as PNG on desktop'}
        </p>
      </div>
    </div>
  );
}

function PreviewCard({ template, statusLabel, styleName, line1Parts, flourLine, line2Parts, line3Parts, pizzaLines, selectedPhotoUrls }: {
  template: 'full' | 'two' | 'text';
  statusLabel: string;
  styleName: string;
  line1Parts: string;
  flourLine: string | null;
  line2Parts: string | null;
  line3Parts: string | null;
  pizzaLines: string[];
  selectedPhotoUrls: string[];
}) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#1A1612', overflow: 'hidden' }}>

      {template === 'full' && selectedPhotoUrls[0] && (
        <>
          <img src={selectedPhotoUrls[0]} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.88) 100%)' }} />
        </>
      )}

      {template === 'two' && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '52%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
          {[0, 1].map(i => (
            <div key={i} style={{ background: '#2D2420', overflow: 'hidden' }}>
              {selectedPhotoUrls[i] && <img src={selectedPhotoUrls[i]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />}
            </div>
          ))}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(to bottom, transparent, #1A1612)' }} />
        </div>
      )}

      <div style={{
        position: 'absolute',
        top: template === 'text' ? '20%' : template === 'two' ? '56%' : '50%',
        left: 0, right: 0, bottom: 0,
        padding: '6% 7%',
      }}>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '9px', color: '#D4A853', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '4px' }}>
          {statusLabel}
        </div>
        <div style={{ fontFamily: 'var(--font-playfair)', fontSize: 'clamp(18px, 8vw, 30px)', fontWeight: 700, color: 'white', lineHeight: 1.1, marginBottom: '8px' }}>
          {styleName}
        </div>
        <div style={{ height: '1px', background: 'rgba(212,168,83,0.5)', marginBottom: '8px' }} />
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '8px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.7 }}>
          {line1Parts}<br />
          {flourLine && <>{flourLine}<br /></>}
          {line2Parts && <>{line2Parts}<br /></>}
          {line3Parts && <span style={{ color: 'rgba(255,255,255,0.5)' }}>{line3Parts}</span>}
        </div>
        {pizzaLines.length > 0 && (
          <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '8px', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', marginTop: '6px' }}>
            {pizzaLines.join(' · ')}
          </div>
        )}
        <div style={{ position: 'absolute', bottom: '6%', right: '7%', fontFamily: 'var(--font-dm-mono)', fontSize: '7px', color: 'rgba(255,255,255,0.25)', letterSpacing: '.08em' }}>
          🍕 BAKER HUB · bakerhub.app
        </div>
      </div>
    </div>
  );
}
