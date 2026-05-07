'use client';
import { useRef, useState, useEffect } from 'react';
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
  bakeType?: string;
  ovenType?: string | null;
  mixerType?: string | null;
  manualOil?: number | null;
  manualSugar?: number | null;
  onClose: () => void;
}

function formatH(h: number): string {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  const rounded = Math.round(mins / 15) * 15;
  if (rounded === 0) return `${whole}h`;
  if (rounded === 60) return `${whole + 1}h`;
  return `${whole}h ${rounded}m`;
}

const LS_TITLE = 'bh_share_title';
const LS_BAKER = 'bh_share_baker';

const OVEN_LABEL: Record<string, string> = {
  pizza_oven: 'Pizza oven', home_oven: 'Home oven',
  ooni_karu: 'Ooni Karu', ooni_koda: 'Ooni Koda',
  roccbox: 'Roccbox', gozney_dome: 'Gozney Dome',
  cast_iron: 'Cast iron', bbq: 'BBQ',
  ooni_volt: 'Ooni Volt', steel: 'Baking steel',
};
const MIXER_LABEL: Record<string, string> = {
  hand: 'Hand kneaded', stand: 'Stand mixer',
  no_knead: 'No-knead', spiral: 'Spiral mixer',
};

export default function ShareCard({
  styleName, numItems, itemWeight, hydration, prefLabel, flourLine,
  recipeFlour, recipeWater, recipeSalt, coldH, rtH,
  bakedQtys, localSlots, sessionPhotos, locale, status,
  ovenType, mixerType, manualOil, manualSugar, onClose,
}: ShareCardProps) {
  const l = locale === 'fr' ? 'fr' : 'en';
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [customTitle, setCustomTitle] = useState<string>(
    () => (typeof window !== 'undefined' ? localStorage.getItem(LS_TITLE) ?? styleName : styleName)
  );
  const [bakerName, setBakerName] = useState<string>(
    () => (typeof window !== 'undefined' ? localStorage.getItem(LS_BAKER) ?? '' : '')
  );
  const [template, setTemplate] = useState<'full' | 'two' | 'four' | 'text'>('full');
  const [selectedPhotoUrls, setSelectedPhotoUrls] = useState<string[]>([]);
  const [cameraPhotoUrls, setCameraPhotoUrls] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { localStorage.setItem(LS_TITLE, customTitle); }, [customTitle]);
  useEffect(() => { localStorage.setItem(LS_BAKER, bakerName); }, [bakerName]);

  // ── Content lines ──
  const specLine = [
    `${numItems} × ${itemWeight}g`,
    hydration != null ? `${hydration}%` : null,
    prefLabel,
  ].filter(Boolean).join(' · ');

  const oilStr = manualOil && manualOil > 0 ? ` · ${manualOil}g oil` : '';
  const sugarStr = manualSugar && manualSugar > 0 ? ` · ${manualSugar}g sugar` : '';
  const weightsLine = recipeFlour && recipeWater && recipeSalt
    ? `${recipeFlour}g flour · ${recipeWater}g water · ${recipeSalt}g salt${oilStr}${sugarStr}`
    : null;

  const timingLine = [
    coldH > 0 ? `Cold ${formatH(coldH)}` : null,
    rtH > 0 ? `RT ${formatH(rtH)}` : null,
  ].filter(Boolean).join(' · ');

  const gearLine = [
    ovenType ? (OVEN_LABEL[ovenType] ?? ovenType) : null,
    mixerType ? (MIXER_LABEL[mixerType] ?? mixerType) : null,
  ].filter(Boolean).join(' · ') || null;

  const allPizzas = [...PIZZAS, ...DESSERT_PIZZAS];
  const pizzaEntries: [string, number][] =
    bakedQtys && Object.values(bakedQtys).some(v => v > 0)
      ? Object.entries(bakedQtys).filter(([, q]) => q > 0)
      : localSlots.map(s => [s.preset_id, s.qty ?? 1]);

  const pizzaLines: string[] = pizzaEntries.map(([id, qty]) => {
    const p = allPizzas.find(x => x.id === id);
    const name = p
      ? ((p.name as Record<string, string>)[l] ?? (p.name as Record<string, string>).en ?? id)
      : id;
    return qty > 1 ? `${name} ×${qty}` : name;
  });

  const pizzaDisplayLines: string[] =
    pizzaLines.length <= 3
      ? pizzaLines.length > 0 ? [pizzaLines.join(' · ')] : []
      : Array.from({ length: Math.ceil(pizzaLines.length / 2) }, (_, i) =>
          pizzaLines.slice(i * 2, i * 2 + 2).join('  ·  ')
        );

  const cardDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const contentLineCount = [
    true,
    flourLine,
    weightsLine,
    true,
    gearLine,
    ...pizzaDisplayLines,
  ].filter(Boolean).length;

  const PANEL_MIN = 360;
  const PANEL_MAX = 540;
  const panelHeight = Math.min(PANEL_MAX, Math.max(PANEL_MIN,
    100 + 110 + (contentLineCount * 52) + 60
  ));
  const photoZoneHeight = 1080 - panelHeight;
  const photoZoneRatio = photoZoneHeight / 1080;

  const allPhotos = [
    ...sessionPhotos.map(p => ({ url: p.photo_url })),
    ...cameraPhotoUrls.map(url => ({ url })),
  ];

  const maxPhotos = template === 'four' ? 4 : template === 'two' ? 2 : 1;

  function togglePhoto(url: string) {
    setSelectedPhotoUrls(prev => {
      if (prev.includes(url)) return prev.filter(u => u !== url);
      if (prev.length >= maxPhotos) return [...prev.slice(1), url];
      return [...prev, url];
    });
  }

  // ── Editable caption ──
  const defaultCaption = [
    customTitle,
    '',
    specLine,
    ...(flourLine ? [flourLine] : []),
    ...(weightsLine ? [weightsLine] : []),
    timingLine,
    ...(gearLine ? [gearLine] : []),
    '',
    ...(pizzaLines.length > 0 ? [pizzaLines.join(' · ')] : []),
    '',
    ...(bakerName ? [`Baked by ${bakerName}`] : []),
    'Planned with bakerhub.app',
  ].join('\n');

  const [editableCaption, setEditableCaption] = useState(defaultCaption);

  useEffect(() => {
    setEditableCaption(defaultCaption);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customTitle, bakerName, specLine, weightsLine, timingLine]);

  // ── Canvas draw ──
  async function drawCard(): Promise<HTMLCanvasElement | null> {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    canvas.width = 1080;
    canvas.height = 1080;
    const ctxOrNull = canvas.getContext('2d');
    if (!ctxOrNull) return null;
    const ctx = ctxOrNull;

    ctx.fillStyle = '#1A1612';
    ctx.fillRect(0, 0, 1080, 1080);

    async function loadImg(url: string): Promise<HTMLImageElement | null> {
      return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
      });
    }

    function drawCover(img: HTMLImageElement, x: number, y: number, w: number, h: number) {
      const scale = Math.max(w / img.width, h / img.height);
      const iw = img.width * scale;
      const ih = img.height * scale;
      ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    }

    // Photo zone
    if (template === 'text') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, 1080, photoZoneHeight);
      ctx.clip();
      const words = customTitle.split(' ');
      if (words.length === 1) {
        ctx.font = `bold ${photoZoneHeight * 0.55}px "Playfair Display", Georgia, serif`;
        ctx.fillStyle = 'rgba(212,168,83,0.05)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(customTitle, 540, photoZoneHeight / 2);
      } else {
        const mid = Math.ceil(words.length / 2);
        ctx.font = `bold ${photoZoneHeight * 0.3}px "Playfair Display", Georgia, serif`;
        ctx.fillStyle = 'rgba(212,168,83,0.05)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(words.slice(0, mid).join(' '), 540, photoZoneHeight * 0.38);
        ctx.fillText(words.slice(mid).join(' '), 540, photoZoneHeight * 0.65);
      }
      ctx.restore();
    } else if (template === 'full') {
      if (selectedPhotoUrls[0]) {
        const img = await loadImg(selectedPhotoUrls[0]);
        if (img) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, 1080, photoZoneHeight);
          ctx.clip();
          drawCover(img, 0, 0, 1080, photoZoneHeight);
          ctx.restore();
        }
      }
      const g = ctx.createLinearGradient(0, photoZoneHeight * 0.5, 0, photoZoneHeight);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.72)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1080, photoZoneHeight);
    } else if (template === 'two') {
      const slotW = (1080 - 2) / 2;
      for (let i = 0; i < 2; i++) {
        const x = i * (slotW + 2);
        ctx.fillStyle = '#2D2420';
        ctx.fillRect(x, 0, slotW, photoZoneHeight);
        if (selectedPhotoUrls[i]) {
          const img = await loadImg(selectedPhotoUrls[i]);
          if (img) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, 0, slotW, photoZoneHeight);
            ctx.clip();
            drawCover(img, x, 0, slotW, photoZoneHeight);
            ctx.restore();
          }
        }
      }
      const g2 = ctx.createLinearGradient(0, photoZoneHeight * 0.65, 0, photoZoneHeight);
      g2.addColorStop(0, 'rgba(0,0,0,0)');
      g2.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, 1080, photoZoneHeight);
    } else if (template === 'four') {
      const slotW = (1080 - 2) / 2;
      const slotH = (photoZoneHeight - 2) / 2;
      for (let i = 0; i < 4; i++) {
        const x = (i % 2) * (slotW + 2);
        const y = Math.floor(i / 2) * (slotH + 2);
        ctx.fillStyle = '#2D2420';
        ctx.fillRect(x, y, slotW, slotH);
        if (selectedPhotoUrls[i]) {
          const img = await loadImg(selectedPhotoUrls[i]);
          if (img) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, slotW, slotH);
            ctx.clip();
            drawCover(img, x, y, slotW, slotH);
            ctx.restore();
          }
        }
      }
      const g4 = ctx.createLinearGradient(0, photoZoneHeight * 0.72, 0, photoZoneHeight);
      g4.addColorStop(0, 'rgba(0,0,0,0)');
      g4.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = g4;
      ctx.fillRect(0, 0, 1080, photoZoneHeight);
    }

    // Dark panel
    ctx.fillStyle = '#1A1612';
    ctx.fillRect(0, photoZoneHeight, 1080, panelHeight);

    // Gold top border
    ctx.strokeStyle = 'rgba(212,168,83,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(72, photoZoneHeight + 1);
    ctx.lineTo(1080 - 72, photoZoneHeight + 1);
    ctx.stroke();

    // Date
    let y = photoZoneHeight + 42;
    ctx.font = '400 26px "DM Mono", monospace';
    ctx.fillStyle = 'rgba(212,168,83,0.65)';
    ctx.textAlign = 'left';
    ctx.fillText(cardDate, 72, y);

    // Title
    y += 16;
    ctx.font = 'bold 88px "Playfair Display", Georgia, serif';
    ctx.fillStyle = '#FFFFFF';
    const maxTitleW = 1080 - 144;
    const titleWords = customTitle.split(' ');
    let titleLine = '';
    for (const word of titleWords) {
      const test = titleLine ? titleLine + ' ' + word : word;
      if (ctx.measureText(test).width > maxTitleW && titleLine) {
        ctx.fillText(titleLine, 72, y + 88);
        y += 96;
        titleLine = word;
      } else {
        titleLine = test;
      }
    }
    ctx.fillText(titleLine, 72, y + 88);
    y += 106;

    // Thin gold divider
    ctx.strokeStyle = 'rgba(212,168,83,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(72, y);
    ctx.lineTo(1080 - 72, y);
    ctx.stroke();
    y += 40;

    function drawLine(text: string, color: string, size: number) {
      ctx.font = `400 ${size}px "DM Mono", monospace`;
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.fillText(text, 72, y);
      y += size + 18;
    }

    drawLine(specLine, 'rgba(255,255,255,0.78)', 34);
    if (flourLine) drawLine(flourLine, 'rgba(212,168,83,0.7)', 30);
    if (weightsLine) drawLine(weightsLine, 'rgba(255,255,255,0.75)', 34);
    if (timingLine) drawLine(timingLine, 'rgba(255,255,255,0.52)', 32);
    if (gearLine) drawLine(gearLine, 'rgba(255,255,255,0.45)', 28);

    if (pizzaDisplayLines.length > 0) {
      y += 4;
      for (const pl of pizzaDisplayLines) {
        ctx.font = 'italic 400 30px "DM Sans", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.textAlign = 'left';
        ctx.fillText(pl, 72, y);
        y += 44;
      }
    }

    // Branding
    const brandY = photoZoneHeight + panelHeight - 36;
    ctx.font = '400 22px "DM Mono", monospace';
    ctx.textAlign = 'left';
    if (bakerName) {
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillText(`Baked by ${bakerName}`, 72, brandY);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.textAlign = 'right';
    ctx.fillText('Planned with bakerhub.app', 1080 - 72, brandY);

    return canvas;
  }

  async function handleShare() {
    setGenerating(true);
    try {
      const canvas = await drawCard();
      if (!canvas) return;
      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/png')
      );
      if (!blob) return;
      const file = new File([blob], 'my-bake.png', { type: 'image/png' });
      if (typeof navigator !== 'undefined' && navigator.share &&
          navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: customTitle });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'my-bake.png'; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) { console.error('share error:', e); }
    setGenerating(false);
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: 'var(--font-dm-mono)', fontSize: '12px',
    padding: '8px 10px', borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--cream)', color: 'var(--char)',
    width: '100%', boxSizing: 'border-box',
    outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-dm-mono)', fontSize: '10px',
    color: 'var(--smoke)', textTransform: 'uppercase',
    letterSpacing: '.08em', marginBottom: '4px', display: 'block',
  };
  const sectionLbl: React.CSSProperties = {
    fontFamily: 'var(--font-dm-mono)', fontSize: '10px',
    color: 'var(--smoke)', textTransform: 'uppercase',
    letterSpacing: '.08em', marginBottom: '10px',
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
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--smoke)', fontSize: '18px', padding: '4px' }}>✕</button>
      </div>

      {/* Scrollable body */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Live preview */}
        <div style={{ width: '100%', aspectRatio: '1 / 1', position: 'relative', overflow: 'hidden', borderRadius: '12px', background: '#1A1612' }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            <PreviewCard
              template={template}
              selectedPhotoUrls={selectedPhotoUrls}
              customTitle={customTitle}
              bakerName={bakerName}
              specLine={specLine}
              flourLine={flourLine}
              weightsLine={weightsLine}
              timingLine={timingLine}
              gearLine={gearLine}
              pizzaDisplayLines={pizzaDisplayLines}
              cardDate={cardDate}
              photoZoneRatio={photoZoneRatio}
            />
          </div>
        </div>

        {/* Editable fields */}
        <div>
          <div style={sectionLbl}>{l === 'fr' ? 'Personnaliser' : 'Customise'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={labelStyle}>{l === 'fr' ? 'Titre' : 'Title'}</label>
              <input
                value={customTitle}
                onChange={e => setCustomTitle(e.target.value)}
                placeholder={styleName}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                {l === 'fr' ? 'PAR (optionnel)' : 'BAKED BY (optional)'}
              </label>
              <input
                value={bakerName}
                onChange={e => setBakerName(e.target.value)}
                placeholder={l === 'fr' ? 'Votre nom' : 'Your name'}
                style={inputStyle}
              />
              <div style={{
                fontFamily: 'var(--font-dm-mono)', fontSize: '10px',
                color: 'var(--smoke)', opacity: 0.5, marginTop: '3px',
              }}>
                {l === 'fr' ? 'Apparaît en bas à gauche de la carte' : 'Appears bottom-left on the card'}
              </div>
            </div>
          </div>
        </div>

        {/* Template picker */}
        <div>
          <div style={sectionLbl}>{l === 'fr' ? 'Format' : 'Template'}</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {(['full', 'two', 'four', 'text'] as const).map(t => (
              <div key={t} onClick={() => setTemplate(t)} style={{ flex: 1, cursor: 'pointer' }}>
                <div style={{
                  aspectRatio: '1', background: '#1A1612', borderRadius: '8px',
                  border: template === t ? '2px solid var(--gold)' : '1.5px solid rgba(255,255,255,0.1)',
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
                  {t === 'four' && (
                    <div style={{ position: 'absolute', inset: 0 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '1px', height: '55%' }}>
                        {[0,1,2,3].map(i => <div key={i} style={{ background: 'rgba(255,255,255,0.07)' }} />)}
                      </div>
                      <div style={{ padding: '4px 6px', marginTop: '4px' }}>
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', marginBottom: '3px' }} />
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', width: '60%' }} />
                      </div>
                    </div>
                  )}
                  {t === 'text' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '16px', opacity: 0.3, color: 'white' }}>Aa</span>
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '9px', color: 'var(--smoke)', textAlign: 'center', marginTop: '4px' }}>
                  {t === 'full' ? '1 photo' : t === 'two' ? '2 photos' : t === 'four' ? '4 photos' : (l === 'fr' ? 'Texte' : 'Text only')}
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
              <span style={{ opacity: 0.5, marginLeft: '6px', textTransform: 'none' as const, letterSpacing: 0 }}>
                {maxPhotos === 1
                  ? (l === 'fr' ? '(1 photo)' : '(pick 1)')
                  : (l === 'fr' ? `(${maxPhotos} max)` : `(pick up to ${maxPhotos})`)}
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
                <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '9px', color: 'var(--smoke)', textAlign: 'center' }}>
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
                        const max = template === 'four' ? 4 : template === 'two' ? 2 : 1;
                        return [...prev.slice(-(max - 1)), url];
                      });
                    });
                    e.target.value = '';
                  }}
                />
              </label>

              {allPhotos.length === 0 && (
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '11px', color: 'var(--smoke)', fontStyle: 'italic', alignSelf: 'center' }}>
                  {l === 'fr' ? 'Aucune photo — choisissez depuis la pellicule' : 'No session photos — pick from camera roll'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Caption */}
        <div>
          <div style={sectionLbl}>{l === 'fr' ? 'Légende' : 'Caption'}</div>
          <textarea
            value={editableCaption}
            onChange={e => setEditableCaption(e.target.value)}
            rows={9}
            style={{
              width: '100%', padding: '10px 12px',
              fontFamily: 'var(--font-dm-mono)', fontSize: '11px',
              color: 'var(--char)', lineHeight: 1.7,
              background: 'var(--cream)', border: '1px solid var(--border)',
              borderRadius: '8px', resize: 'none',
              boxSizing: 'border-box', outline: 'none',
            }}
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(editableCaption).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            style={{
              marginTop: '6px', padding: '6px 14px',
              borderRadius: '8px',
              background: 'transparent',
              border: `1px solid ${copied ? 'var(--terra)' : 'var(--border)'}`,
              color: copied ? 'var(--terra)' : 'var(--smoke)',
              fontFamily: 'var(--font-dm-mono)', fontSize: '11px',
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            {copied ? (l === 'fr' ? 'Copié ! ✓' : 'Copied! ✓') : (l === 'fr' ? 'Copier la légende' : 'Copy caption')}
          </button>
        </div>

      </div>

      {/* Action bar */}
      <div style={{
        padding: '12px 20px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
        background: 'var(--warm)',
      }}>
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
        <p style={{
          fontFamily: 'var(--font-dm-mono)', fontSize: '10px',
          color: 'var(--smoke)', textAlign: 'center',
          marginTop: '8px', opacity: 0.6,
        }}>
          {l === 'fr'
            ? 'Partage natif iOS/Android · Téléchargement PNG sur desktop'
            : 'Native share on iOS/Android · Downloads PNG on desktop'}
        </p>
      </div>
    </div>
  );
}

// ── Live CSS preview ──────────────────────────────────────────────────────────
function PreviewCard({
  template, selectedPhotoUrls, customTitle, bakerName,
  specLine, flourLine, weightsLine, timingLine, gearLine,
  pizzaDisplayLines, cardDate, photoZoneRatio,
}: {
  template: 'full' | 'two' | 'four' | 'text';
  selectedPhotoUrls: string[];
  customTitle: string;
  bakerName: string;
  specLine: string;
  flourLine: string | null;
  weightsLine: string | null;
  timingLine: string;
  gearLine: string | null;
  pizzaDisplayLines: string[];
  cardDate: string;
  photoZoneRatio: number;
}) {
  const panelPct = `${(1 - photoZoneRatio) * 100}%`;

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#1A1612', overflow: 'hidden' }}>

      {/* Photo zone */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${photoZoneRatio * 100}%`, overflow: 'hidden' }}>

        {template === 'text' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-playfair)', fontSize: 'clamp(16px, 10vw, 36px)', fontWeight: 700, color: 'rgba(212,168,83,0.07)', textAlign: 'center', padding: '0 10%' }}>
              {customTitle}
            </span>
          </div>
        )}

        {template === 'full' && selectedPhotoUrls[0] && (
          <img src={selectedPhotoUrls[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        )}

        {template === 'two' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', height: '100%' }}>
            {[0, 1].map(i => (
              <div key={i} style={{ background: '#2D2420', overflow: 'hidden' }}>
                {selectedPhotoUrls[i] && <img src={selectedPhotoUrls[i]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />}
              </div>
            ))}
          </div>
        )}

        {template === 'four' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '2px', height: '100%' }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ background: '#2D2420', overflow: 'hidden' }}>
                {selectedPhotoUrls[i] && <img src={selectedPhotoUrls[i]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />}
              </div>
            ))}
          </div>
        )}

        {/* Gradient fade into panel */}
        {template !== 'text' && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(to bottom, transparent, #1A1612)' }} />
        )}
      </div>

      {/* Panel */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: panelPct,
        background: '#1A1612',
        borderTop: '1px solid rgba(212,168,83,0.2)',
        padding: '8px 10px 6px',
        overflow: 'hidden',
      }}>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '8px', color: 'rgba(212,168,83,0.65)', marginBottom: '2px' }}>
          {cardDate}
        </div>
        <div style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700, fontSize: 'clamp(12px, 3.5vw, 18px)', color: 'white', lineHeight: 1.1, marginBottom: '5px' }}>
          {customTitle}
        </div>
        <div style={{ height: '1px', background: 'rgba(212,168,83,0.25)', marginBottom: '5px' }} />
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '7px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.8 }}>
          {specLine}
          {flourLine && <><br /><span style={{ color: 'rgba(212,168,83,0.7)' }}>{flourLine}</span></>}
          {weightsLine && <><br />{weightsLine}</>}
          {timingLine && <><br /><span style={{ color: 'rgba(255,255,255,0.5)' }}>{timingLine}</span></>}
          {gearLine && <><br /><span style={{ color: 'rgba(255,255,255,0.4)' }}>{gearLine}</span></>}
        </div>
        {pizzaDisplayLines.length > 0 && (
          <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '7px', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', marginTop: '4px', lineHeight: 1.6 }}>
            {pizzaDisplayLines.join('\n')}
          </div>
        )}
        <div style={{ position: 'absolute', bottom: '5px', left: '10px', right: '10px', display: 'flex', justifyContent: 'space-between' }}>
          {bakerName && (
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '6px', color: 'rgba(255,255,255,0.28)' }}>
              Baked by {bakerName}
            </span>
          )}
          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '6px', color: 'rgba(255,255,255,0.22)', marginLeft: 'auto' }}>
            Planned with bakerhub.app
          </span>
        </div>
      </div>
    </div>
  );
}
