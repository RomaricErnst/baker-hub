'use client';
import { useRef, useState, useEffect } from 'react';
import { PIZZAS, DESSERT_PIZZAS } from '@/app/lib/toppingDatabase';
import type { BakePhoto } from '@/app/lib/supabase/fetchBakeEvents';

interface ShareCardProps {
  styleName: string;
  sessionName?: string | null;
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
  yeastType?: string | null;
  yeastGrams?: number | null;
  bakeDate?: string | null;
  protocolLines?: string[] | null;
  onClose: () => void;
}

function stripTime(name: string): string {
  return name.replace(/\s+\d{1,2}:\d{2}$/, '').trim();
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
  // Pizza ovens — matches OVEN_TYPES keys in data.ts
  pizza_oven:         'Pizza oven',
  home_oven_steel:    'Home oven + stone',
  home_oven_standard: 'Home oven',
  electric_pizza:     'Electric pizza oven',
  // Bread ovens — matches BREAD_OVEN_TYPES keys in data.ts
  wood_fired:         'Wood-fired oven',
  dutch_oven:         'Dutch oven',
  home_oven_bread:    'Home oven',
  combo_cooker:       'Combo cooker',
};
const MIXER_LABEL: Record<string, string> = {
  hand: 'Hand kneaded', stand: 'Stand mixer',
  no_knead: 'No-knead', spiral: 'Spiral mixer',
};

const YEAST_SHORT: Record<string, string> = {
  instant: 'IDY', active_dry: 'ADY',
  fresh: 'Fresh yeast', sourdough: '',
};

export default function ShareCard({
  styleName, sessionName, numItems, itemWeight, hydration, prefLabel, flourLine,
  recipeFlour, recipeWater, recipeSalt, coldH, rtH,
  bakedQtys, localSlots, sessionPhotos, locale, status, bakeType,
  ovenType, mixerType, manualOil, manualSugar, yeastType, yeastGrams, bakeDate, protocolLines, onClose,
}: ShareCardProps) {
  const l = locale === 'fr' ? 'fr' : 'en';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [customTitle, setCustomTitle] = useState<string>(() => {
    const base = stripTime(sessionName ?? styleName);
    if (typeof window === 'undefined') return base;
    return localStorage.getItem(LS_TITLE) ?? base;
  });
  const [bakerName, setBakerName] = useState<string>(
    () => (typeof window !== 'undefined' ? localStorage.getItem(LS_BAKER) ?? '' : '')
  );
  const [template, setTemplate] = useState<'full' | 'two' | 'four' | 'protocol'>('protocol');
  // Export format for photo templates — IG/FB post (4:5), square (1:1), story (9:16)
  const [format, setFormat] = useState<'post' | 'square' | 'story'>('post');
  const [selectedPhotoUrls, setSelectedPhotoUrls] = useState<string[]>([]);
  const [cameraPhotoUrls, setCameraPhotoUrls] = useState<string[]>([]);
  // Per-photo vertical crop anchor — auto center-crop beheaded cornicione
  // close-ups; ⊙/↑/↓ cycles where the slot focuses.
  const [photoCrops, setPhotoCrops] = useState<Record<string, 'center' | 'top' | 'bottom'>>({});
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharedOk, setSharedOk] = useState(false);
  const [imgCopied, setImgCopied] = useState(false);
  const [copyingImg, setCopyingImg] = useState(false);
  const [canCopyImage, setCanCopyImage] = useState(false);
  useEffect(() => {
    // Clipboard image copy — desktop browsers (Chrome/Edge/Safari); pastes
    // straight into IG/FB web composers, faster than download + re-upload.
    setCanCopyImage(
      typeof navigator !== 'undefined' &&
      !!navigator.clipboard && typeof window !== 'undefined' && 'ClipboardItem' in window
    );
  }, []);
  const [previewLoading, setPreviewLoading] = useState(true);
  // Decoded-image cache — without it every redraw re-fetches all photos from
  // Supabase, leaving black photo slots for seconds on each edit.
  const imgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  useEffect(() => { localStorage.setItem(LS_TITLE, customTitle); }, [customTitle]);
  useEffect(() => { localStorage.setItem(LS_BAKER, bakerName); }, [bakerName]);
  useEffect(() => { setCustomTitle(stripTime(sessionName ?? styleName)); }, [sessionName]);

  // ── Content lines ──
  const specLine = [
    `${numItems} × ${itemWeight}g`,
    hydration != null ? `${hydration}%` : null,
    prefLabel,
  ].filter(Boolean).join(' · ');

  const oilStr = manualOil && manualOil > 0 ? ` · ${manualOil}g oil` : '';
  const sugarStr = manualSugar && manualSugar > 0 ? ` · ${manualSugar}g sugar` : '';
  // Inline percentages — merged into weightsLine, no separate pctLine
  const hydPct = recipeWater && recipeFlour
    ? Math.round(recipeWater / recipeFlour * 100)
    : null;
  const saltPct = recipeSalt && recipeFlour
    ? (Math.round(recipeSalt / recipeFlour * 1000) / 10).toFixed(1)
    : null;
  const yeastPct = yeastGrams && recipeFlour && yeastType !== 'sourdough'
    ? (() => {
        const pct = (yeastGrams / recipeFlour) * 100;
        return pct < 0.1 ? pct.toFixed(2) : pct.toFixed(1);
      })()
    : null;

  const waterIngStr = recipeWater
    ? `${recipeWater}g water${hydPct != null ? ` (${hydPct}%)` : ''}`
    : null;
  const yeastIngStr = yeastGrams && yeastGrams > 0 && yeastType !== 'sourdough'
    ? ` · ${Number(yeastGrams).toFixed(1)}g ${YEAST_SHORT[yeastType ?? ''] ?? 'yeast'}${yeastPct != null ? ` (${yeastPct}%)` : ''}`
    : '';
  const saltIngStr = recipeSalt
    ? `${recipeSalt}g salt${saltPct != null ? ` (${saltPct}%)` : ''}`
    : null;

  const weightsLine = recipeFlour && waterIngStr && saltIngStr
    ? `${recipeFlour}g flour · ${waterIngStr}${yeastIngStr} · ${saltIngStr}${oilStr}${sugarStr}`
    : null;
  const pctLine = null; // merged inline above

  const timingLine = [
    coldH > 0 ? `Cold ${formatH(coldH)}` : null,
    rtH > 0 ? `RT ${formatH(rtH)}` : null,
  ].filter(Boolean).join(' · ');

  const gearLine = [
    ovenType ? (OVEN_LABEL[ovenType] ?? ovenType) : null,
    mixerType ? (MIXER_LABEL[mixerType] ?? mixerType) : null,
  ].filter(Boolean).join(' · ') || null;

  // Ready-to-post hashtag block — style/bake aware
  const hashtagLine = (() => {
    const tags: string[] = [];
    const sn = styleName.toLowerCase();
    if (bakeType === 'bread') {
      if (yeastType === 'sourdough') tags.push('#sourdough', '#sourdoughbread');
      tags.push('#bread', '#homemadebread', '#breadbaking');
      if (sn.includes('baguette')) tags.push('#baguette');
      if (sn.includes('focaccia')) tags.push('#focaccia');
      if (sn.includes('brioche')) tags.push('#brioche');
    } else {
      if (sn.includes('neapolitan')) tags.push('#neapolitanpizza');
      if (sn.includes('new york')) tags.push('#newyorkpizza');
      if (sn.includes('roman')) tags.push('#romanpizza');
      if (sn.includes('detroit') || sn.includes('pan')) tags.push('#panpizza');
      tags.push('#pizza', '#homemadepizza', '#pizzanight');
      if (yeastType === 'sourdough') tags.push('#sourdoughpizza');
    }
    tags.push('#bakerhub');
    return tags.join(' ');
  })();

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

  const bodyLineCount = [
    true,                    // specLine always
    flourLine,               // optional
    weightsLine,             // always
    true,                    // timingLine always
    gearLine,                // optional
    ...pizzaDisplayLines,    // 0–n
  ].filter(Boolean).length;

  const LINE_H_CALC = 23 + 14; // 37px
  const panelHeight = Math.max(340,
    28 +                          // top pad
    (bakeDate ? 34 : 0) +         // date line
    44 + 20 +                     // title max + gap
    18 + 18 +                     // divider + gap
    bodyLineCount * LINE_H_CALC + // body lines
    60                            // branding
  );
  const EXPORT_H = format === 'story' ? 1920 : format === 'square' ? 1080 : 1350;
  const photoZoneHeight = EXPORT_H - panelHeight;
  const photoZoneRatio = photoZoneHeight / EXPORT_H;

  const displayTitle = (() => {
    const stripped = customTitle
      .replace(/\s*[·•\-]?\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b.*$/i, '')
      .trim();
    return stripped.length > 3 ? stripped : customTitle;
  })();

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
  const defaultCaption = template === 'protocol' && protocolLines?.length
    ? [...protocolLines, '', hashtagLine].join('\n')
    : [
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
        '',
        hashtagLine,
      ].join('\n');

  const [editableCaption, setEditableCaption] = useState(defaultCaption);

  useEffect(() => {
    setEditableCaption(defaultCaption);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customTitle, bakerName, specLine, weightsLine, timingLine, template, protocolLines]);

  // Re-render preview canvas whenever any input changes
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setPreviewLoading(true);
      try { await document.fonts.ready; } catch { /* ok */ }
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (cancelled) return;
      const canvas = await drawCard();
      if (cancelled || !canvas || !previewCanvasRef.current) return;
      const preview = previewCanvasRef.current;
      const w = preview.clientWidth || preview.parentElement?.clientWidth || 300;
      const scale = w / canvas.width;
      preview.width = w;
      preview.height = Math.round(canvas.height * scale);
      // Explicit CSS height — without it the preview container can collapse
      // to 0px (overflow:hidden parent) and the live preview is never visible.
      preview.style.height = `${Math.round(canvas.height * scale)}px`;
      const ctx = preview.getContext('2d');
      if (!ctx) return;
      ctx.save();
      ctx.scale(scale, scale);
      ctx.drawImage(canvas, 0, 0);
      ctx.restore();
      setPreviewLoading(false);
    };
    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, format, selectedPhotoUrls, photoCrops, customTitle, bakerName, editableCaption, protocolLines,
      specLine, flourLine, weightsLine, timingLine, gearLine, pizzaDisplayLines, bakeDate]);

  // ── Canvas draw ──
  async function drawCard(): Promise<HTMLCanvasElement | null> {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctxOrNull = canvas.getContext('2d');
    if (!ctxOrNull) return null;
    const ctx = ctxOrNull;

    if (template === 'protocol') {
      const lines: string[] = protocolLines?.length
        ? protocolLines
        : [
            customTitle, '',
            specLine,
            ...(flourLine ? [flourLine] : []),
            ...(weightsLine ? [weightsLine] : []),
            timingLine,
            ...(gearLine ? [gearLine] : []),
          ];

      const FONT         = '"DM Mono", monospace';
      const MARGIN       = 72;
      const CONTENT_W_P  = 1080 - MARGIN * 2;
      const BODY_SIZE_P  = 23;
      const INDENT_SIZE  = 21;
      const LINE_GAP     = 14;
      const W            = 1080;

      // Calculate total height
      let totalH = 60;          // top pad
      totalH += bakeDate ? 34 : 0; // date line
      totalH += 44 + 22;        // title + gap
      totalH += 20 + 22;        // divider + gap
      for (const ln of lines) {
        if (ln === '') { totalH += 16; continue; }
        totalH += (ln.startsWith('  ') ? INDENT_SIZE : BODY_SIZE_P) + LINE_GAP;
      }
      totalH += 60;             // bottom branding
      totalH = Math.max(600, totalH);

      canvas.width  = W;
      canvas.height = totalH;

      ctx.fillStyle = '#1A1612';
      ctx.fillRect(0, 0, W, totalH);

      let y = 52;

      // Bake date
      if (bakeDate) {
        ctx.font      = `400 22px ${FONT}`;
        ctx.fillStyle = 'rgba(212,168,83,0.55)';
        ctx.textAlign = 'left';
        ctx.fillText(`Bake: ${bakeDate}`, MARGIN, y);
        y += 34;
      }

      // Title — single line, shrink to fit; ellipsis when even the floor
      // size overflows (long titles used to clip off the card edge)
      {
        let titleSize = 44;
        ctx.font = `bold ${titleSize}px "Playfair Display", Georgia, serif`;
        while (ctx.measureText(displayTitle).width > CONTENT_W_P && titleSize > 26) {
          titleSize--;
          ctx.font = `bold ${titleSize}px "Playfair Display", Georgia, serif`;
        }
        let shownTitle = displayTitle;
        while (shownTitle.length > 4 && ctx.measureText(shownTitle === displayTitle ? shownTitle : `${shownTitle}…`).width > CONTENT_W_P) {
          shownTitle = shownTitle.slice(0, -1).trimEnd();
        }
        if (shownTitle !== displayTitle) shownTitle = `${shownTitle}…`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.fillText(shownTitle, MARGIN, y + titleSize);
        y += titleSize + 22;
      }

      // Divider
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(MARGIN, y);
      ctx.lineTo(W - MARGIN, y);
      ctx.stroke();
      y += 22;

      // Protocol lines
      for (const ln of lines) {
        if (ln === '') { y += 16; continue; }

        const isIndented = ln.startsWith('  ');
        const isHeader   = !isIndented && /^\w{3}\s\d{2}:\d{2}/.test(ln);
        const size       = isIndented ? INDENT_SIZE : BODY_SIZE_P;
        const weight     = isHeader ? '600' : '400';
        const opacity    = isHeader ? 0.92 : isIndented ? 0.60 : 0.80;

        ctx.font      = `${weight} ${size}px ${FONT}`;
        ctx.fillStyle = `rgba(255,255,255,${opacity})`;
        ctx.textAlign = 'left';
        ctx.fillText(ln.trimStart(), MARGIN + (isIndented ? 24 : 0), y);
        y += size + LINE_GAP;
      }

      // Bottom divider
      y += 16;
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(MARGIN, y);
      ctx.lineTo(W - MARGIN, y);
      ctx.stroke();
      y += 28;

      // Branding
      ctx.font      = `400 20px ${FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.textAlign = 'left';
      if (bakerName) ctx.fillText(`Baked by ${bakerName}`, MARGIN, y);
      ctx.textAlign = 'right';
      ctx.fillText('Planned with bakerhub.app', W - MARGIN, y);

      return canvas;
    }

    canvas.width = 1080;
    canvas.height = EXPORT_H;

    ctx.fillStyle = '#1A1612';
    ctx.fillRect(0, 0, 1080, EXPORT_H);

    const imgCache = imgCacheRef.current;
    async function loadImg(url: string): Promise<HTMLImageElement | null> {
      const cached = imgCache.get(url);
      if (cached) return cached;
      try {
        const blob = await fetch(url).then(r => r.blob());
        const blobUrl = URL.createObjectURL(blob);
        return new Promise(resolve => {
          const img = new Image();
          img.onload = () => { URL.revokeObjectURL(blobUrl); imgCache.set(url, img); resolve(img); };
          img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(null); };
          img.src = blobUrl;
        });
      } catch { return null; }
    }

    function drawCover(img: HTMLImageElement, x: number, y: number, w: number, h: number, anchor: 'center' | 'top' | 'bottom' = 'center') {
      const scale = Math.max(w / img.width, h / img.height);
      const iw = img.width * scale;
      const ih = img.height * scale;
      const dy = anchor === 'top' ? 0 : anchor === 'bottom' ? (h - ih) : (h - ih) / 2;
      ctx.drawImage(img, x + (w - iw) / 2, y + dy, iw, ih);
    }

    // Photo zone
    if (template === 'full') {
      if (selectedPhotoUrls[0]) {
        const img = await loadImg(selectedPhotoUrls[0]);
        if (img) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, 1080, photoZoneHeight);
          ctx.clip();
          drawCover(img, 0, 0, 1080, photoZoneHeight, photoCrops[selectedPhotoUrls[0]] ?? 'center');
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
            drawCover(img, x, 0, slotW, photoZoneHeight, photoCrops[selectedPhotoUrls[i]] ?? 'center');
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
            drawCover(img, x, y, slotW, slotH, photoCrops[selectedPhotoUrls[i]] ?? 'center');
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

    // ── Panel content ───────────────────────────────────
    const CONTENT_W  = 1080 - 144; // 936px
    const BODY_SIZE  = 23;
    const LINE_H     = BODY_SIZE + 14; // 37px

    let y = photoZoneHeight + 28;

    // Bake date — gold, subtle
    if (bakeDate) {
      ctx.font      = '400 26px "DM Mono", monospace';
      ctx.fillStyle = 'rgba(212,168,83,0.70)';
      ctx.textAlign = 'left';
      ctx.fillText(bakeDate, 72, y);
      y += 34;
    }

    // Title — Playfair, single line, shrink to fit; ellipsis when even the
    // floor size overflows (long titles used to clip off the card edge)
    {
      let titleSize = 44;
      ctx.font = `bold ${titleSize}px "Playfair Display", Georgia, serif`;
      while (ctx.measureText(displayTitle).width > CONTENT_W && titleSize > 26) {
        titleSize--;
        ctx.font = `bold ${titleSize}px "Playfair Display", Georgia, serif`;
      }
      let shownTitle = displayTitle;
      while (shownTitle.length > 4 && ctx.measureText(shownTitle === displayTitle ? shownTitle : `${shownTitle}…`).width > CONTENT_W) {
        shownTitle = shownTitle.slice(0, -1).trimEnd();
      }
      if (shownTitle !== displayTitle) shownTitle = `${shownTitle}…`;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.fillText(shownTitle, 72, y + titleSize);
      y += titleSize + 20;
    }

    // Gold divider
    ctx.strokeStyle = 'rgba(212,168,83,0.25)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(72, y);
    ctx.lineTo(1080 - 72, y);
    ctx.stroke();
    y += 18;

    // Body lines — all same font, same size, no italic
    function drawBodyLine(text: string, opacity: number) {
      ctx.font      = `400 ${BODY_SIZE}px "DM Mono", monospace`;
      ctx.fillStyle = `rgba(255,255,255,${opacity})`;
      ctx.textAlign = 'left';
      ctx.fillText(text, 72, y);
      y += LINE_H;
    }

    drawBodyLine(specLine, 0.85);
    if (flourLine) drawBodyLine(flourLine, 0.60);
    if (weightsLine) drawBodyLine(weightsLine, 0.85);
    drawBodyLine(timingLine, 0.70);
    if (gearLine) drawBodyLine(gearLine, 0.70);

    if (pizzaDisplayLines.length > 0) {
      y += 4;
      for (const pl of pizzaDisplayLines) {
        drawBodyLine(pl, 0.55);
      }
    }

    // Branding — pinned to bottom of panel
    const brandY = photoZoneHeight + panelHeight - 36;
    ctx.font      = '400 22px "DM Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.textAlign = 'left';
    if (bakerName) ctx.fillText(`Baked by ${bakerName}`, 72, brandY);
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
        setSharedOk(true);
        setTimeout(() => setSharedOk(false), 4000);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'my-bake.png'; a.click();
        URL.revokeObjectURL(url);
        setSharedOk(true);
        setTimeout(() => setSharedOk(false), 4000);
      }
    } catch (e) { console.error('share error:', e); }
    setGenerating(false);
  }

  async function handleCopyImage() {
    setCopyingImg(true);
    try {
      const canvas = await drawCard();
      if (!canvas) return;
      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/png')
      );
      if (!blob) return;
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setImgCopied(true);
      setTimeout(() => setImgCopied(false), 3000);
    } catch (e) { console.error('copy image error:', e); }
    setCopyingImg(false);
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

        {/* Live preview — exact scaled render of export canvas */}
        <div style={{ position: 'relative', width: '100%', minHeight: '160px', borderRadius: '12px', overflow: 'hidden', background: '#1A1612', display: 'flex', justifyContent: 'center' }}>
          <canvas
            ref={previewCanvasRef}
            style={{ maxWidth: '100%', maxHeight: '56vh', width: 'auto', height: 'auto', display: 'block', borderRadius: '12px' }}
          />
          {previewLoading && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(26,22,18,0.55)',
              fontFamily: 'var(--font-dm-mono)', fontSize: '11px',
              color: 'rgba(255,255,255,0.6)', letterSpacing: '.06em',
            }}>
              {l === 'fr' ? 'Aperçu en cours…' : 'Rendering preview…'}
            </div>
          )}
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
            {(['protocol', 'full', 'two', 'four'] as const).map(t => (
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
                  {t === 'protocol' && (
                    <div style={{ position: 'absolute', inset: 0, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '3px', justifyContent: 'center' }}>
                      {[100, 70, 85, 55].map((w, i) => (
                        <div key={i} style={{ height: '3px', background: 'rgba(255,255,255,0.18)', borderRadius: '2px', width: `${w}%` }} />
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '9px', color: 'var(--smoke)', textAlign: 'center', marginTop: '4px' }}>
                  {t === 'full' ? '1 photo' : t === 'two' ? '2 photos' : t === 'four' ? '4 photos' : (l === 'fr' ? 'Protocole' : 'Protocol')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Format picker — photo templates only */}
        {template !== 'protocol' && (
          <div>
            <div style={sectionLbl}>{l === 'fr' ? 'Format' : 'Size'}</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {([
                ['post',   l === 'fr' ? 'Post 4:5' : 'Post 4:5'],
                ['square', l === 'fr' ? 'Carré 1:1' : 'Square 1:1'],
                ['story',  'Story 9:16'],
              ] as const).map(([key, lbl]) => (
                <button
                  key={key}
                  onClick={() => {
                    setFormat(key);
                    // Smart default — free to override: story favours 4 (or 1)
                    // photos, square favours 2, post favours 2 (or 1).
                    const n = allPhotos.length;
                    if (key === 'story') setTemplate(n >= 4 ? 'four' : 'full');
                    else setTemplate(n >= 2 ? 'two' : 'full');
                  }}
                  style={{
                    flex: 1, padding: '8px 6px', borderRadius: '20px',
                    border: format === key ? '1.5px solid var(--gold)' : '1px solid var(--border)',
                    background: format === key ? 'rgba(212,168,83,0.10)' : 'transparent',
                    color: format === key ? 'var(--char)' : 'var(--smoke)',
                    fontFamily: 'var(--font-dm-mono)', fontSize: '11px',
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Photo picker */}
        {template !== 'protocol' && (
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
              {allPhotos.map((p, i) => {
                const selIdx = selectedPhotoUrls.indexOf(p.url);
                const isSel = selIdx !== -1;
                const crop = photoCrops[p.url] ?? 'center';
                const cropGlyph = crop === 'top' ? '↑' : crop === 'bottom' ? '↓' : '⊙';
                const miniBtn: React.CSSProperties = {
                  position: 'absolute', width: '20px', height: '20px',
                  borderRadius: '6px', border: 'none', cursor: 'pointer',
                  background: 'rgba(26,22,18,0.72)', color: '#fff',
                  fontSize: '11px', lineHeight: '20px', textAlign: 'center', padding: 0,
                };
                return (
                <div
                  key={i}
                  onClick={() => togglePhoto(p.url)}
                  style={{
                    width: '72px', height: '72px', borderRadius: '8px', overflow: 'hidden',
                    cursor: 'pointer', position: 'relative', flexShrink: 0,
                    outline: isSel ? '2.5px solid var(--gold)' : '2px solid transparent',
                  }}
                >
                  <img src={p.url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="" />
                  {isSel && (
                    <>
                      {/* Order badge — slot position on the card */}
                      <span style={{
                        position: 'absolute', top: '3px', left: '3px',
                        minWidth: '18px', height: '18px', borderRadius: '9px',
                        background: 'var(--gold)', color: '#1A1612',
                        fontSize: '11px', fontWeight: 700, lineHeight: '18px',
                        textAlign: 'center', padding: '0 4px',
                        fontFamily: 'var(--font-dm-mono)',
                      }}>{selIdx + 1}</span>
                      {/* Make hero — move to slot 1 */}
                      {selIdx > 0 && (
                        <button
                          title={l === 'fr' ? 'Mettre en premier' : 'Make first photo'}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPhotoUrls(prev => [p.url, ...prev.filter(u => u !== p.url)]);
                          }}
                          style={{ ...miniBtn, bottom: '3px', left: '3px' }}
                        >★</button>
                      )}
                      {/* Crop anchor cycle: center → top → bottom */}
                      <button
                        title={l === 'fr' ? 'Cadrage : centre / haut / bas' : 'Crop: centre / top / bottom'}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhotoCrops(prev => ({
                            ...prev,
                            [p.url]: crop === 'center' ? 'top' : crop === 'top' ? 'bottom' : 'center',
                          }));
                        }}
                        style={{ ...miniBtn, bottom: '3px', right: '3px' }}
                      >{cropGlyph}</button>
                    </>
                  )}
                </div>
                );
              })}

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <div style={{ ...sectionLbl, marginBottom: 0 }}>{l === 'fr' ? 'Légende' : 'Caption'}</div>
            <span style={{
              fontFamily: 'var(--font-dm-mono)', fontSize: '10px',
              color: 'var(--smoke)', opacity: 0.4,
            }}>✎ editable</span>
          </div>
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
        {canCopyImage && (
          <button
            onClick={handleCopyImage}
            disabled={copyingImg}
            style={{
              width: '100%', padding: '11px', marginTop: '8px',
              background: 'transparent',
              border: `1px solid ${imgCopied ? 'var(--sage)' : 'var(--border)'}`,
              color: imgCopied ? 'var(--sage)' : 'var(--smoke)',
              borderRadius: '12px',
              fontFamily: 'var(--font-dm-mono)', fontSize: '12px',
              cursor: copyingImg ? 'default' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {imgCopied
              ? (l === 'fr' ? 'Image copiée ✓ — collez-la où vous voulez' : 'Image copied ✓ — paste it anywhere')
              : copyingImg
              ? (l === 'fr' ? 'Copie…' : 'Copying…')
              : (l === 'fr' ? 'Copier l’image' : 'Copy image to clipboard')}
          </button>
        )}
        <p style={{
          fontFamily: 'var(--font-dm-mono)', fontSize: '10px',
          color: sharedOk ? 'var(--sage)' : 'var(--smoke)', textAlign: 'center',
          marginTop: '8px', opacity: sharedOk ? 1 : 0.6,
          transition: 'color 0.2s ease',
        }}>
          {sharedOk
            ? (l === 'fr'
                ? 'Image enregistrée ✓ — collez-la dans votre post'
                : 'Image saved ✓ — drop it into your post')
            : (l === 'fr'
                ? 'Partage natif iOS/Android · Téléchargement PNG sur desktop'
                : 'Native share on iOS/Android · Downloads PNG on desktop')}
        </p>
      </div>
    </div>
  );
}

