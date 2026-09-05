'use client';
import { useRef, useState, useEffect } from 'react';
import { PIZZAS, DESSERT_PIZZAS } from '@/app/lib/toppingDatabase';
import type { BakePhoto } from '@/app/lib/supabase/fetchBakeEvents';

/* next/font generates an obfuscated family name, so the canvas cannot ask for
   the UI family by name the way it used to ask for "Playfair Display". Reading the
   CSS variable gives the real family list. Without this the share card would
   have quietly fallen back to a system serif the moment Playfair stopped being
   loaded — a silent typeface change on the one artefact that leaves the app. */
// Crop is stored per slot as a transform, not as a three-position anchor.
// centre/top/bottom was a coarse approximation of a continuous problem, and
// its control was a 20px glyph below the 44px rule.
type SlotCrop = { scale: number; offsetX: number; offsetY: number };
const NO_CROP: SlotCrop = { scale: 1, offsetX: 0, offsetY: 0 };
type CardLine = { key: string; text: string; dim?: boolean };
type LineGroup = { key: string; name: string; lines: CardLine[] };

function displayFontFamily(): string {
  try {
    const v = getComputedStyle(document.body).getPropertyValue('--font-ui').trim();
    return v ? `${v}, sans-serif` : 'system-ui, sans-serif';
  } catch {
    return 'system-ui, sans-serif';
  }
}


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
  // "Caputo Nuvola" reads as a mystery word off-app — say flour/farine
  // unless the name already does, or it's a % blend (already technical).
  // Guards against "Bread Flour flour".
  const flourShareLine = flourLine
    ? (/(flour|farine|blend|%)/i.test(flourLine)
        ? flourLine
        : l === 'fr' ? `Farine ${flourLine}` : `${flourLine} flour`)
    : null;
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
  // Shape only. The Template picker is gone: layout is a consequence of how
  // many photos are selected, not a second question. The two used to fight —
  // picking a size rewrote the template, and a caption had to explain that it
  // had. In French both pickers were even labelled "Format".
  const [format, setFormat] = useState<'post' | 'square' | 'story'>('post');
  const [selectedPhotoUrls, setSelectedPhotoUrls] = useState<string[]>([]);
  const [cameraPhotoUrls, setCameraPhotoUrls] = useState<string[]>([]);
  // Crop is per SLOT, not per photo. The same photo cropped as the hero is
  // wrong once it becomes slot 2, so the key is position.
  const [slotCrops, setSlotCrops] = useState<Record<number, SlotCrop>>({});
  // Which content lines are on. Keys come from LINE_GROUPS below.
  const [lineOn, setLineOn] = useState<Record<string, boolean>>({});
  const [flowMode, setFlowMode] = useState<'pages' | 'long'>('pages');
  const [previewPage, setPreviewPage] = useState(0);
  const [showLines, setShowLines] = useState(false);
  const [cropSlot, setCropSlot] = useState<number | null>(null);
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
  // ≥720px: two-column sheet — sticky preview left, controls right
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 720px)');
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
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
    // Custom slots aren't in the DB — prettify the raw preset id
    // (custom_la_special_1784346299010 → "La Special") instead of leaking it.
    const name = p
      ? ((p.name as Record<string, string>)[l] ?? (p.name as Record<string, string>).en ?? id)
      : id.startsWith('custom_')
        ? id.replace(/^custom_/, '').replace(/_\d+$/, '').split('_')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        : id;
    return qty > 1 ? `${name} ×${qty}` : name;
  });

  const pizzaDisplayLines: string[] =
    pizzaLines.length <= 3
      ? pizzaLines.length > 0 ? [pizzaLines.join(' · ')] : []
      : Array.from({ length: Math.ceil(pizzaLines.length / 2) }, (_, i) =>
          pizzaLines.slice(i * 2, i * 2 + 2).join('  ·  ')
        );

  // ── Content, grouped ──
  // A group is the unit a page break respects. The schedule used to be a
  // separate card template, which meant every layout change had to be kept
  // in sync across two kinds of card. It is a group now.
  const scheduleLines = (protocolLines ?? []).filter(Boolean);
  const LINE_GROUPS: LineGroup[] = [
    {
      key: 'recipe',
      name: l === 'fr' ? 'Recette' : 'Recipe',
      lines: [
        ...(bakeDate ? [{ key: 'date', text: bakeDate, dim: true }] : []),
        { key: 'spec', text: specLine },
        ...(flourShareLine ? [{ key: 'flour', text: flourShareLine, dim: true }] : []),
        ...(weightsLine ? [{ key: 'weights', text: weightsLine }] : []),
        ...(timingLine ? [{ key: 'timing', text: timingLine, dim: true }] : []),
        ...(gearLine ? [{ key: 'gear', text: gearLine, dim: true }] : []),
        ...pizzaDisplayLines.map((t, i) => ({ key: 'pizzas' + i, text: t, dim: true })),
      ],
    },
    ...(scheduleLines.length
      ? [{
          key: 'schedule',
          name: l === 'fr' ? 'Déroulé' : 'Schedule',
          lines: scheduleLines.map((t, i) => ({ key: 'sched' + i, text: t })),
        }]
      : []),
  ];

  // Default: recipe on, schedule off. Anything new defaults to its group's
  // rule rather than silently appearing.
  const isOn = (groupKey: string, lineKey: string) =>
    lineOn[lineKey] ?? (groupKey !== 'schedule');

  const liveGroups = LINE_GROUPS
    .map(g => ({ ...g, lines: g.lines.filter(li => isOn(g.key, li.key)) }))
    .filter(g => g.lines.length > 0);
  const totalLines = liveGroups.reduce((a, g) => a + g.lines.length, 0);

  const photoCount = Math.min(4, selectedPhotoUrls.length);

  // ── Geometry ──
  // Photo zone is a fixed share of the card per photo count; the panel takes
  // what is left. Body type then sizes itself to fill that panel — few lines
  // set large, many lines set small, and pagination takes over rather than
  // letting type fall below readable.
  const PHOTO_ZONE_RATIO: Record<number, number> =
    { 0: 0, 1: 0.55, 2: 0.42, 3: 0.52, 4: 0.50 };
  const BODY_MIN = 18;
  const BODY_MAX = 27;
  const LEADING = 14;
  const baseH = format === 'story' ? 1920 : format === 'square' ? 1080 : 1350;
  const photoZoneHeight = Math.round(baseH * (PHOTO_ZONE_RATIO[photoCount] ?? 0));

  // Fixed chrome inside the panel: pad, date, title, rule, branding. The date
  // has to be in this budget — it is drawn above the title and counted in the
  // block that gets centred, so leaving it out made every dated card overrun
  // its branding line by exactly 34px worth of slack.
  const PANEL_CHROME = 28 + (bakeDate ? 34 : 0) + 44 + 20 + 18 + 18 + 60;
  const basePanelH = baseH - photoZoneHeight;
  const availBody = Math.max(80, basePanelH - PANEL_CHROME);
  const capacity = Math.max(2, Math.floor(availBody / (BODY_MIN + LEADING)));

  // Break on group boundaries. A group only splits when it alone overflows —
  // never to save a line of whitespace, because a schedule cut in half reads
  // as damage rather than as a second card.
  const pages: { name: string | null; lines: CardLine[] }[] = (() => {
    if (flowMode === 'long') {
      return [{ name: null, lines: liveGroups.flatMap(g => g.lines) }];
    }
    const out: { name: string | null; lines: CardLine[] }[] = [];
    let cur: { name: string | null; lines: CardLine[] } | null = null;
    for (const g of liveGroups) {
      if (g.lines.length > capacity) {
        if (cur) { out.push(cur); cur = null; }
        for (let i = 0; i < g.lines.length; i += capacity) {
          out.push({ name: g.name, lines: g.lines.slice(i, i + capacity) });
        }
        continue;
      }
      if (cur && cur.lines.length + g.lines.length <= capacity) {
        cur.lines = cur.lines.concat(g.lines);
        if (cur.name !== g.name) cur.name = null;
      } else {
        if (cur) out.push(cur);
        cur = { name: g.name, lines: g.lines.slice() };
      }
    }
    if (cur) out.push(cur);
    return out.length ? out : [{ name: null, lines: [] }];
  })();

  // Would it paginate whatever mode we are in? The overflow control's
  // visibility must not depend on the control's own value, or choosing "long"
  // hides the only way back to pages.
  const wouldPaginate = (() => {
    let used = 0, n = 1;
    for (const g of liveGroups) {
      const k = g.lines.length;
      if (k > capacity) { if (used) { n++; used = 0; } n += Math.ceil(k / capacity) - 1; used = k % capacity || capacity; continue; }
      if (used + k <= capacity) used += k; else { n++; used = k; }
    }
    return n > 1;
  })();

  const pageCount = pages.length;
  const safePage = Math.min(previewPage, pageCount - 1);

  // Long mode grows the panel instead of paginating.
  const longPanelH = PANEL_CHROME + totalLines * (23 + LEADING);
  const EXPORT_H = flowMode === 'long'
    ? photoZoneHeight + Math.max(basePanelH, longPanelH)
    : baseH;
  const panelHeight = EXPORT_H - photoZoneHeight;

  // Type size for a given page: fill the panel, never below BODY_MIN or above
  // BODY_MAX. This is what keeps a four-line card from looking lost and a
  // twelve-line one from turning into fine print.
  function bodySizeFor(lineCount: number): number {
    if (lineCount <= 0) return 23;
    const avail = Math.max(80, panelHeight - PANEL_CHROME);
    const perLine = Math.floor(avail / lineCount);
    return Math.max(BODY_MIN, Math.min(BODY_MAX, perLine - LEADING));
  }

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

  const maxPhotos = 4;

  // Session-card photos flow into the card automatically — dark slots until
  // manual taps was a trap. First 4 pre-select once photos arrive; every
  // thumbnail stays tappable to change the picks.
  useEffect(() => {
    if (selectedPhotoUrls.length > 0) return;
    const urls = [
      ...sessionPhotos.map(p => p.photo_url),
      ...cameraPhotoUrls,
    ].filter(Boolean).slice(0, 4);
    if (urls.length) setSelectedPhotoUrls(urls);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionPhotos.length, cameraPhotoUrls.length]);

  function togglePhoto(url: string) {
    setSelectedPhotoUrls(prev => {
      if (prev.includes(url)) return prev.filter(u => u !== url);
      if (prev.length >= maxPhotos) return [...prev.slice(1), url];
      return [...prev, url];
    });
  }

  // ── Editable caption ──
  // The caption says what the card says. It used to be one of two fixed
  // shapes chosen by template; now it follows the lines that are switched on,
  // so turning the schedule off does not leave it in the text.
  const defaultCaption = [
    customTitle,
    '',
    ...liveGroups.flatMap(g =>
      g.key === 'schedule' ? ['', ...g.lines.map(li => li.text)] : g.lines.map(li => li.text)),
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
  }, [customTitle, bakerName, specLine, weightsLine, timingLine, lineOn, protocolLines]);

  // Re-render preview canvas whenever any input changes
  // Content-derived key: arrays like protocolLines are rebuilt every render;
  // depending on their identity made the effect cancel itself in a loop
  // (permanent 'Aperçu en cours…', stale canvas). Serialise once instead.
  const previewKey = JSON.stringify([format, selectedPhotoUrls, slotCrops, customTitle,
    bakerName, editableCaption, protocolLines, specLine, flourLine, weightsLine, timingLine,
    gearLine, pizzaDisplayLines, bakeDate, lineOn, flowMode, safePage]);
    useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setPreviewLoading(true);
      try { await document.fonts.ready; } catch { /* ok */ }
      // rAF is paused in hidden/occluded tabs — race it with a timer so the
      // preview also renders when the baker switches away mid-open.
      await Promise.race([
        new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
        new Promise<void>(resolve => setTimeout(resolve, 150)),
      ]);
      if (cancelled) return;
      try {
        const canvas = await drawPage(safePage);
        if (cancelled || !canvas || !previewCanvasRef.current) return;
        const preview = previewCanvasRef.current;
        // Copy at full export resolution — CSS owns the displayed size
        // (aspect-ratio + max-width/max-height contain-fit). JS layout
        // measurement here (parent clientWidth mid-sheet-animation,
        // innerHeight with the keyboard open) produced wrong preview boxes
        // on real devices; a failed run also left the canvas at its default
        // 300×150 — a small wide rectangle regardless of format.
        preview.width = canvas.width;
        preview.height = canvas.height;
        // Clear inline px sizes a previous version may have left behind
        preview.style.removeProperty('width');
        preview.style.removeProperty('height');
        const ctx = preview.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(canvas, 0, 0);
      } catch (e) {
        console.error('Preview render failed:', e);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  // ── Canvas draw ──
  // One renderer. The preview is this exact canvas copied pixel for pixel,
  // so what is previewed is what is exported — there is no second drawing
  // path that can drift.
  async function drawPage(pageIdx: number): Promise<HTMLCanvasElement | null> {
    const canvas = pageIdx === 0
      ? (canvasRef.current ?? document.createElement('canvas'))
      : document.createElement('canvas');
    const ctxOrNull = canvas.getContext('2d');
    if (!ctxOrNull) return null;
    const ctx = ctxOrNull;
    const page = pages[Math.min(pageIdx, pages.length - 1)] ?? { name: null, lines: [] };
    const showPhotos = pageIdx === 0 && photoCount > 0;
    const zoneH = showPhotos ? photoZoneHeight : 0;
    const panelH = EXPORT_H - zoneH;

    canvas.width = 1080;
    canvas.height = zoneH + panelH;

    ctx.fillStyle = '#2B2420';
    ctx.fillRect(0, 0, 1080, zoneH + panelH);

    const imgCache = imgCacheRef.current;
    async function loadImg(url: string): Promise<HTMLImageElement | null> {
      try {
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
    } catch { return null; }
    }

    // Cover-fit, then apply the slot's own zoom and offset. Offsets are
    // fractions of the slot so a crop survives a change of shape.
    function drawSlot(img: HTMLImageElement, x: number, y: number, w: number, h: number, c: SlotCrop) {
      const base = Math.max(w / img.width, h / img.height);
      const scale = base * (c.scale || 1);
      const iw = img.width * scale;
      const ih = img.height * scale;
      const cx = x + (w - iw) / 2 + (c.offsetX || 0) * w;
      const cy = y + (h - ih) / 2 + (c.offsetY || 0) * h;
      ctx.drawImage(img, cx, cy, iw, ih);
    }
    async function paint(i: number, x: number, y: number, w: number, h: number) {
      ctx.fillStyle = '#2D2420';
      ctx.fillRect(x, y, w, h);
      const url = selectedPhotoUrls[i];
      if (!url) return;
      const img = await loadImg(url);
      if (!img) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      drawSlot(img, x, y, w, h, slotCrops[i] ?? NO_CROP);
      ctx.restore();
    }

    // Layout follows the count. Three is the only asymmetric case: a hero
    // plus a pair, because three equal bands crop a round pizza top and
    // bottom and three equal columns turn it into a slice. Square puts the
    // hero on the left, where the zone is short and wide.
    if (showPhotos) {
      const G = 2;
      if (photoCount === 1) {
        await paint(0, 0, 0, 1080, zoneH);
      } else if (photoCount === 2) {
        const w = (1080 - G) / 2;
        await paint(0, 0, 0, w, zoneH);
        await paint(1, w + G, 0, w, zoneH);
      } else if (photoCount === 3) {
        if (format === 'square') {
          const heroW = Math.round((1080 - G) * 0.57);
          const sideW = 1080 - G - heroW;
          const sideH = (zoneH - G) / 2;
          await paint(0, 0, 0, heroW, zoneH);
          await paint(1, heroW + G, 0, sideW, sideH);
          await paint(2, heroW + G, sideH + G, sideW, sideH);
        } else {
          const heroH = Math.round((zoneH - G) * 0.57);
          const restH = zoneH - G - heroH;
          const w = (1080 - G) / 2;
          await paint(0, 0, 0, 1080, heroH);
          await paint(1, 0, heroH + G, w, restH);
          await paint(2, w + G, heroH + G, w, restH);
        }
      } else {
        const w = (1080 - G) / 2;
        const h = (zoneH - G) / 2;
        for (let i = 0; i < 4; i++) {
          await paint(i, (i % 2) * (w + G), Math.floor(i / 2) * (h + G), w, h);
        }
      }
      const grad = ctx.createLinearGradient(0, zoneH * 0.6, 0, zoneH);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.66)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, zoneH);
    }

    // Dark panel
    ctx.fillStyle = '#2B2420';
    ctx.fillRect(0, zoneH, 1080, panelH);

    // ── Panel content ───────────────────────────────────
    const CONTENT_W  = 1080 - 144; // 936px
    // Type sizes itself to the panel: a four-line card sets large, a twelve
    // line one sets small, and below BODY_MIN the content paginates instead
    // of shrinking into fine print.
    const BODY_SIZE  = bodySizeFor(page.lines.length);
    const LINE_H     = BODY_SIZE + 14;

    let y = zoneH + 28;

    // Type stops growing at BODY_MAX, so a short card leaves slack — a
    // no-photo protocol card has room for 36 lines and may carry six. Top
    // aligning it stranded the text under the title with a third of the card
    // empty beneath. Centre the block in the space it actually has; the
    // branding stays pinned to the bottom either way.
    {
      const bodyCount = page.lines.filter(li => li.key !== 'date').length;
      const hasDate = pageIdx === 0 && !!bakeDate && page.lines.some(li => li.key === 'date');
      const contentH = (hasDate ? 34 : 0) + 44 + 20 + 18 + 18 + bodyCount * LINE_H;
      const slack = (panelH - 60) - contentH;
      if (slack > 0) y = zoneH + 28 + Math.floor(slack / 2);
    }

    // Bake date — gold, subtle. Page one only; it belongs to the bake, not
    // to every card the bake produced.
    if (bakeDate && pageIdx === 0 && page.lines.some(li => li.key === 'date')) {
      ctx.font      = '400 26px "DM Mono", monospace';
      ctx.fillStyle = 'rgba(156, 130, 72,0.70)';
      ctx.textAlign = 'left';
      ctx.fillText(bakeDate, 72, y);
      y += 34;
    }

    // Title — display face, single line, shrink to fit; ellipsis when even the
    // floor size overflows (long titles used to clip off the card edge)
    {
      // Page two is named by what it holds, never "continued". A schedule
      // card that gets forwarded on its own has to read as a schedule.
      const pageTitle = pageIdx === 0 || !page.name
        ? displayTitle
        : `${displayTitle} · ${page.name}`;
      let titleSize = 44;
      ctx.font = `bold ${titleSize}px ${displayFontFamily()}`;
      while (ctx.measureText(pageTitle).width > CONTENT_W && titleSize > 26) {
        titleSize--;
        ctx.font = `bold ${titleSize}px ${displayFontFamily()}`;
      }
      let shownTitle = pageTitle;
      while (shownTitle.length > 4 && ctx.measureText(shownTitle === pageTitle ? shownTitle : `${shownTitle}…`).width > CONTENT_W) {
        shownTitle = shownTitle.slice(0, -1).trimEnd();
      }
      if (shownTitle !== pageTitle) shownTitle = `${shownTitle}…`;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.fillText(shownTitle, 72, y + titleSize);
      y += titleSize + 20;
    }

    // Gold divider
    ctx.strokeStyle = 'rgba(156, 130, 72,0.25)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(72, y);
    ctx.lineTo(1080 - 72, y);
    ctx.stroke();
    y += 18;

    // Body lines — all same font, no italic. Shrink-to-fit like the title:
    // long ingredient lines (oil/sugar suffixes) used to run off the card
    // edge ("2g oi…"). Line height stays constant so the panel math holds.
    function drawBodyLine(text: string, opacity: number) {
      let size = BODY_SIZE;
      ctx.font = `400 ${size}px "DM Mono", monospace`;
      while (ctx.measureText(text).width > CONTENT_W && size > 15) {
        size--;
        ctx.font = `400 ${size}px "DM Mono", monospace`;
      }
      ctx.fillStyle = `rgba(255,255,255,${opacity})`;
      ctx.textAlign = 'left';
      ctx.fillText(text, 72, y);
      y += LINE_H;
    }

    for (const li of page.lines) {
      if (li.key === 'date') continue; // already drawn above the title
      drawBodyLine(li.text, li.dim ? 0.60 : 0.85);
    }

    // Branding — pinned to bottom of panel
    const brandY = zoneH + panelH - 36;
    ctx.font      = '400 22px "DM Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.textAlign = 'left';
    if (bakerName) ctx.fillText(`Baked by ${bakerName}`, 72, brandY);
    ctx.textAlign = 'right';
    ctx.fillText('Planned with bakerhub.app', 1080 - 72, brandY);

    return canvas;
  }

  async function renderAllPages(): Promise<Blob[]> {
    const out: Blob[] = [];
    for (let i = 0; i < pages.length; i++) {
      const canvas = await drawPage(i);
      if (!canvas) continue;
      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/png')
      );
      if (blob) out.push(blob);
    }
    return out;
  }

  async function handleShare() {
    setGenerating(true);
    try {
      const blobs = await renderAllPages();
      if (!blobs.length) return;
      const files = blobs.map((b, i) => new File(
        [b], blobs.length > 1 ? `my-bake-${i + 1}.png` : 'my-bake.png',
        { type: 'image/png' },
      ));
      // Multi-file share is native, and Instagram reads it as a carousel —
      // which is the whole reason overflow paginates rather than producing
      // one tall image a feed would crop.
      if (typeof navigator !== 'undefined' && navigator.share &&
          navigator.canShare && navigator.canShare({ files })) {
        await navigator.share({ files, title: customTitle });
      } else {
        files.forEach(f => {
          const url = URL.createObjectURL(f);
          const a = document.createElement('a');
          a.href = url; a.download = f.name; a.click();
          URL.revokeObjectURL(url);
        });
      }
      setSharedOk(true);
      setTimeout(() => setSharedOk(false), 4000);
    } catch (e) { console.error('share error:', e); }
    setGenerating(false);
  }

  async function handleCopyImage() {
    setCopyingImg(true);
    try {
      // The clipboard holds one image; copy the page on screen.
      const canvas = await drawPage(safePage);
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

  // Where each page starts, so the editor can show the break in place
  // rather than making the baker discover it from the preview.
  const pageStartKey: Record<string, number> = {};
  if (flowMode === 'pages') {
    pages.forEach((pg, i) => { if (i > 0 && pg.lines[0]) pageStartKey[pg.lines[0].key] = i + 1; });
  }

  const cropOf = (i: number): SlotCrop => slotCrops[i] ?? NO_CROP;
  function setCrop(i: number, next: Partial<SlotCrop>) {
    setSlotCrops(prev => ({ ...prev, [i]: { ...(prev[i] ?? NO_CROP), ...next } }));
  }

  // The slot this photo will actually fill, so the crop frame is the real
  // shape and not a generic square that lies about the result.
  function slotAspect(i: number): number {
    const shape = format === 'story' ? 9 / 16 : format === 'square' ? 1 : 4 / 5;
    const zone = PHOTO_ZONE_RATIO[photoCount] ?? 0.5;
    if (photoCount === 1) return shape / zone;
    if (photoCount === 2) return (shape / 2) / zone;
    if (photoCount === 3) {
      if (format === 'square') return i === 0 ? (shape * 0.57) / zone : (shape * 0.43) / (zone / 2);
      return i === 0 ? shape / (zone * 0.57) : (shape / 2) / (zone * 0.43);
    }
    return (shape / 2) / (zone / 2);
  }

  const sheetStyle: React.CSSProperties = {
    position: 'absolute', inset: 0, background: 'var(--cream)', zIndex: 20,
    display: 'flex', flexDirection: 'column', borderRadius: '20px 20px 0 0',
  };

  const inputStyle: React.CSSProperties = {
    fontFamily: 'var(--font-ui)', fontSize: '12px',
    padding: '8px 12px', borderRadius: '16px',
    border: '1px solid var(--border)',
    background: 'var(--cream)', color: 'var(--char)',
    width: '100%', boxSizing: 'border-box',
    outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-ui)', fontSize: '11px',
    color: 'var(--smoke)', textTransform: 'uppercase',
    letterSpacing: '.08em', marginBottom: '4px', display: 'block',
  };
  const sectionLbl: React.CSSProperties = {
    fontFamily: 'var(--font-ui)', fontSize: '11px',
    color: 'var(--smoke)', textTransform: 'uppercase',
    letterSpacing: '.08em', marginBottom: '12px',
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
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 700, color: 'var(--char)', margin: 0 }}>
          {l === 'fr' ? 'Partager cette fournée' : 'Share this bake'}
        </p>
        <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--smoke)', fontSize: '17px', width: '44px', height: '44px', marginRight: '-10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      </div>

      {/* Scrollable body — single column on phones, preview left + sticky
          on ≥720px so the card stays in view while editing */}
      <div style={{
        overflowY: 'auto', flex: 1, padding: '16px 20px 24px',
        display: wide ? 'grid' : 'flex',
        ...(wide
          ? { gridTemplateColumns: 'minmax(280px, 44%) 1fr', columnGap: '24px', alignItems: 'start' }
          : { flexDirection: 'column' as const, gap: '20px' }),
      }}>

        {/* Live preview — exact scaled render of export canvas. The dark
            frame hugs the card (fit-content): no unused side gutters, its
            width always matches the chosen format. */}
        <div style={wide ? { position: 'sticky' as const, top: 0 } : undefined}>
          <div style={{
            position: 'relative', width: 'fit-content', maxWidth: '100%',
            margin: '0 auto', minWidth: '140px', minHeight: '140px',
            borderRadius: '16px', overflow: 'hidden', background: '#2B2420',
          }}>
          <canvas
            ref={previewCanvasRef}
            style={{
              display: 'block', borderRadius: '16px',
              // CSS-driven contain-fit: the box shape comes from the format,
              // not from JS measurements — Story previews tall (9:16) even
              // before the first draw lands. Protocol cards have a dynamic
              // height, so they use the canvas's intrinsic ratio instead.
              width: 'auto', height: 'auto',
              maxWidth: '100%', maxHeight: '58dvh',
              // Long cards have a computed height, so let the canvas's own
              // ratio drive the box rather than asserting a shape it is not.
              ...(flowMode === 'long' ? {} : { aspectRatio: `1080 / ${EXPORT_H}` }),
            }}
          />
          {previewLoading && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(43, 36, 32,0.55)',
              fontFamily: 'var(--font-ui)', fontSize: '11px',
              color: 'rgba(255,255,255,0.6)', letterSpacing: '.06em',
            }}>
              {l === 'fr' ? 'Aperçu en cours…' : 'Rendering preview…'}
            </div>
          )}
          </div>

          {/* Pager — only when there is more than one card */}
          {pageCount > 1 && flowMode === 'pages' && (
            <div style={{
              display: 'flex', gap: '6px', justifyContent: 'center',
              alignItems: 'center', marginTop: '10px',
            }}>
              {pages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPreviewPage(i)}
                  aria-current={i === safePage}
                  aria-label={`${l === 'fr' ? 'Carte' : 'Card'} ${i + 1}`}
                  style={{
                    width: '44px', height: '44px', border: 'none', background: 'none',
                    cursor: 'pointer', padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: i === safePage ? 'var(--gold)' : 'var(--border)',
                    display: 'block',
                  }} />
                </button>
              ))}
            </div>
          )}

          {/* The preview is the way in to editing. Tapping the card itself
              would need 44px targets on lines that are ~12px at this scale,
              so the card opens the editor rather than becoming one. */}
          <button
            onClick={() => setShowLines(true)}
            style={{
              width: '100%', minHeight: '44px', marginTop: '6px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: '11px',
              color: 'var(--smoke)', letterSpacing: '.04em',
            }}
          >
            {pageCount > 1 && flowMode === 'pages'
              ? (l === 'fr'
                  ? `${pageCount} images — choisir le contenu`
                  : `Shares as ${pageCount} images — choose what it says`)
              : (l === 'fr' ? 'Choisir ce que dit la carte' : 'Choose what the card says')}
          </button>
        </div>

        {/* Controls column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>

        {/* Editable fields */}
        <div>
          <div style={sectionLbl}>{l === 'fr' ? 'Personnaliser' : 'Customise'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                fontFamily: 'var(--font-ui)', fontSize: '11px',
                color: 'var(--smoke)', opacity: 0.5, marginTop: '3px',
              }}>
                {l === 'fr' ? 'Apparaît en bas à gauche de la carte' : 'Appears bottom-left on the card'}
              </div>
            </div>
          </div>
        </div>

        {/* Shape. One question, one label — the Template/Size pair both read
            "Format" in French and one silently rewrote the other. */}
        <div>
          <div style={sectionLbl}>{l === 'fr' ? 'Destination' : 'Where it is going'}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {([
              ['post',   'Post 4:5'],
              ['square', l === 'fr' ? 'Carré 1:1' : 'Square 1:1'],
              ['story',  'Story 9:16'],
            ] as const).map(([key, lbl]) => (
              <button
                key={key}
                onClick={() => { setFormat(key); setPreviewPage(0); }}
                aria-pressed={format === key}
                style={{
                  flex: 1, padding: '8px', minHeight: '44px', borderRadius: '20px',
                  border: format === key ? '1.5px solid var(--gold)' : '1px solid var(--border)',
                  background: format === key ? 'rgba(156, 130, 72,0.10)' : 'transparent',
                  color: format === key ? 'var(--char)' : 'var(--smoke)',
                  fontFamily: 'var(--font-ui)', fontSize: '11px',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}
              >{lbl}</button>
            ))}
          </div>
        </div>

        {/* Overflow — only when there is overflow. A permanent control asking
            what to do if it does not fit is a question with no stakes on most
            sessions. The test is "would it paginate", not "is it paginated":
            keying off the current mode would hide the way back out of long. */}
        {wouldPaginate && (
          <div>
            <div style={sectionLbl}>
              {flowMode === 'long'
                ? (l === 'fr' ? 'Trop long pour une carte' : 'Too tall for one card')
                : (l === 'fr' ? `${pageCount} cartes nécessaires` : `Needs ${pageCount} cards`)}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {([
                ['pages', l === 'fr' ? 'Plusieurs cartes' : 'Pages'],
                ['long',  l === 'fr' ? 'Une carte longue' : 'One long card'],
              ] as const).map(([key, lbl]) => (
                <button
                  key={key}
                  onClick={() => { setFlowMode(key); setPreviewPage(0); }}
                  aria-pressed={flowMode === key}
                  style={{
                    flex: 1, padding: '8px', minHeight: '44px', borderRadius: '20px',
                    border: flowMode === key ? '1.5px solid var(--gold)' : '1px solid var(--border)',
                    background: flowMode === key ? 'rgba(156, 130, 72,0.10)' : 'transparent',
                    color: flowMode === key ? 'var(--char)' : 'var(--smoke)',
                    fontFamily: 'var(--font-ui)', fontSize: '11px', cursor: 'pointer',
                  }}
                >{lbl}</button>
              ))}
            </div>
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: '11px',
              color: 'var(--smoke)', opacity: 0.6, marginTop: '8px', lineHeight: 1.5,
            }}>
              {flowMode === 'long'
                ? (l === 'fr'
                    ? 'Une seule image haute. Parfait dans WhatsApp ; un post la recadrera.'
                    : 'One tall image. Good in WhatsApp and Messages; a feed post will crop it.')
                : (l === 'fr'
                    ? 'Se poursuit sur une seconde carte, même format. Publié en carrousel.'
                    : 'Spills onto a second card, same shape. Posts as a carousel.')}
            </div>
          </div>
        )}

        {/* Photo picker. Always shown: no photos is a valid card, not a
            template you have to go and choose. */}
        {(
          <div>
            <div style={sectionLbl}>
              {l === 'fr' ? 'Photos' : 'Photos'}
              <span style={{ opacity: 0.5, marginLeft: '6px', textTransform: 'none' as const, letterSpacing: 0 }}>
                {photoCount === 0
                  ? (l === 'fr' ? '(aucune — carte protocole)' : '(none — protocol card)')
                  : (l === 'fr' ? `(${photoCount} sur ${maxPhotos})` : `(${photoCount} of ${maxPhotos})`)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {allPhotos.map((p, i) => {
                const selIdx = selectedPhotoUrls.indexOf(p.url);
                const isSel = selIdx !== -1;
                const miniBtn: React.CSSProperties = {
                  position: 'absolute', width: '20px', height: '20px',
                  borderRadius: '12px', border: 'none', cursor: 'pointer',
                  background: 'rgba(43, 36, 32,0.72)', color: '#fff',
                  fontSize: '11px', lineHeight: '20px', textAlign: 'center', padding: 0,
                };
                return (
                <div
                  key={i}
                  onClick={() => togglePhoto(p.url)}
                  style={{
                    width: '72px', height: '72px', borderRadius: '16px', overflow: 'hidden',
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
                        minWidth: '18px', height: '18px', borderRadius: '8px',
                        background: 'var(--gold)', color: '#2B2420',
                        fontSize: '11px', fontWeight: 700, lineHeight: '18px',
                        textAlign: 'center', padding: '0 4px',
                        fontFamily: 'var(--font-ui)',
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
                        ></button>
                      )}
                      {/* Opens the slot's own crop pane. The old ⊙/↑/↓ cycle
                          was three positions for a continuous problem, on a
                          20px target. */}
                      <button
                        title={l === 'fr' ? 'Recadrer' : 'Reframe'}
                        onClick={(e) => { e.stopPropagation(); setCropSlot(selIdx); }}
                        style={{ ...miniBtn, bottom: '3px', right: '3px' }}
                      >⤢</button>
                    </>
                  )}
                </div>
                );
              })}

              <label style={{
                width: '72px', height: '72px', borderRadius: '12px',
                border: '1.5px dashed var(--border)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', gap: '4px', flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--smoke)" strokeWidth="1.5">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <circle cx="12" cy="12" r="3.5" />
                </svg>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--smoke)', textAlign: 'center' }}>
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
                        if (prev.length < 4) return [...prev, url];
                        return [...prev.slice(1), url];
                      });
                    });
                    e.target.value = '';
                  }}
                />
              </label>

              {allPhotos.length === 0 && (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--smoke)', fontStyle: 'italic', alignSelf: 'center' }}>
                  {l === 'fr' ? 'Aucune photo — choisissez depuis la pellicule' : 'No session photos — pick from camera roll'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Caption */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ ...sectionLbl, marginBottom: 0 }}>{l === 'fr' ? 'Légende' : 'Caption'}</div>
            <span style={{
              fontFamily: 'var(--font-ui)', fontSize: '11px',
              color: 'var(--smoke)', opacity: 0.4,
            }}>editable</span>
          </div>
          <textarea
            value={editableCaption}
            onChange={e => setEditableCaption(e.target.value)}
            rows={9}
            style={{
              width: '100%', padding: '12px 12px',
              fontFamily: 'var(--font-ui)', fontSize: '11px',
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
              marginTop: '8px', padding: '8px 16px',
              borderRadius: '12px',
              background: 'transparent',
              border: `1px solid ${copied ? 'var(--terra)' : 'var(--border)'}`,
              color: copied ? 'var(--terra)' : 'var(--smoke)',
              fontFamily: 'var(--font-ui)', fontSize: '11px',
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            {copied ? (l === 'fr' ? 'Copié ! ✓' : 'Copied! ✓') : (l === 'fr' ? 'Copier la légende' : 'Copy caption')}
          </button>
        </div>

        </div>{/* /Controls column */}

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
            width: '100%', padding: '16px',
            background: generating ? 'var(--smoke)' : 'var(--terra)',
            color: 'white', border: 'none', borderRadius: '12px',
            fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 700,
            cursor: generating ? 'default' : 'pointer',
            boxShadow: '0 2px 8px rgba(107, 68, 35,0.25)',
          }}
        >
          {generating
            ? (l === 'fr' ? 'Génération...' : 'Generating...')
            : (l === 'fr' ? 'Partager' : 'Share this bake')}
        </button>
        {canCopyImage && (
          <button
            onClick={handleCopyImage}
            disabled={copyingImg}
            style={{
              width: '100%', padding: '16px', minHeight: '44px', marginTop: '8px',
              background: 'transparent',
              border: `1px solid ${imgCopied ? 'var(--sage)' : 'var(--border)'}`,
              color: imgCopied ? 'var(--sage)' : 'var(--smoke)',
              borderRadius: '12px',
              fontFamily: 'var(--font-ui)', fontSize: '12px',
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
          fontFamily: 'var(--font-ui)', fontSize: '11px',
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

      {/* ── What the card says ─────────────────────────────── */}
      {showLines && (
        <div style={sheetStyle}>
          <div style={{
            padding: '16px 20px 10px', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center',
            borderBottom: '1px solid var(--border)', flexShrink: 0,
          }}>
            <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 700, color: 'var(--char)' }}>
              {l === 'fr' ? 'Ce que dit la carte' : 'What the card says'}
            </p>
            <button onClick={() => setShowLines(false)} aria-label="Done" style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--smoke)',
              fontSize: '17px', width: '44px', height: '44px',
            }}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 18px' }}>
            <div style={{ background: '#2B2420', borderRadius: '15px', padding: '14px 12px' }}>
              {/* Title, edited in place on the card. 16px so iOS does not
                  zoom the viewport on focus. */}
              <input
                value={customTitle}
                onChange={e => setCustomTitle(e.target.value)}
                placeholder={styleName}
                aria-label={l === 'fr' ? 'Titre' : 'Title'}
                style={{
                  width: '100%', minHeight: '44px', padding: '9px 10px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.16)', borderRadius: '8px',
                  color: '#fff', fontFamily: 'var(--font-ui)', fontSize: '16px',
                  fontWeight: 700, outline: 'none', boxSizing: 'border-box',
                }}
              />
              <div style={{ height: '1px', background: 'rgba(156, 130, 72,0.3)', margin: '10px 6px 8px' }} />

              {LINE_GROUPS.map(g => (
                <div key={g.key}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 8px 4px', gap: '10px',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-ui)', fontSize: '10px',
                      color: 'rgba(156, 130, 72,0.9)', textTransform: 'uppercase',
                      letterSpacing: '.09em',
                    }}>{g.name}</span>
                    <button
                      onClick={() => {
                        const allOn = g.lines.every(li => isOn(g.key, li.key));
                        setLineOn(prev => {
                          const next = { ...prev };
                          g.lines.forEach(li => { next[li.key] = !allOn; });
                          return next;
                        });
                        setPreviewPage(0);
                      }}
                      style={{
                        background: 'none', border: '1px solid rgba(255,255,255,0.2)',
                        color: 'rgba(255,255,255,0.65)', fontFamily: 'var(--font-ui)',
                        fontSize: '11px', borderRadius: '8px', padding: '0 10px',
                        minHeight: '34px', cursor: 'pointer', flexShrink: 0,
                      }}
                    >
                      {g.lines.every(li => isOn(g.key, li.key))
                        ? (l === 'fr' ? 'Tout retirer' : 'Turn off')
                        : (l === 'fr' ? 'Tout ajouter' : 'Turn on')}
                    </button>
                  </div>

                  {g.lines.map(li => {
                    const on = isOn(g.key, li.key);
                    const startsPage = pageStartKey[li.key];
                    return (
                      <div key={li.key}>
                        {on && startsPage && (
                          <div style={{
                            fontFamily: 'var(--font-ui)', fontSize: '10px',
                            color: 'rgba(156, 130, 72,0.85)', letterSpacing: '.06em',
                            padding: '12px 8px 2px', marginTop: '8px',
                            borderTop: '1px dashed rgba(156, 130, 72,0.3)',
                          }}>
                            {l === 'fr' ? `CARTE ${startsPage} À PARTIR D’ICI` : `CARD ${startsPage} STARTS HERE`}
                          </div>
                        )}
                        {/* Off is not deleted — the line stays legible and
                            struck through, so what was left out is visible
                            and can come back. */}
                        <button
                          onClick={() => {
                            setLineOn(prev => ({ ...prev, [li.key]: !on }));
                            setPreviewPage(0);
                          }}
                          aria-pressed={on}
                          style={{
                            minHeight: '44px', display: 'flex', alignItems: 'center',
                            gap: '10px', width: '100%', padding: '5px 8px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            textAlign: 'left', borderRadius: '8px', fontFamily: 'var(--font-ui)',
                          }}
                        >
                          <span style={{
                            width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
                            border: on ? '1.5px solid var(--gold)' : '1.5px solid rgba(255,255,255,0.28)',
                            background: on ? 'var(--gold)' : 'transparent',
                            color: '#2B2420', fontSize: '11px', fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>{on ? '✓' : ''}</span>
                          <span style={{
                            flex: 1, fontSize: '12.5px', lineHeight: 1.35,
                            color: on ? '#fff' : 'rgba(255,255,255,0.22)',
                            textDecoration: on ? 'none' : 'line-through',
                          }}>{li.text}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <p style={{
              fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--smoke)',
              lineHeight: 1.55, marginTop: '12px',
            }}>
              {flowMode === 'long'
                ? (l === 'fr' ? 'Une seule carte longue : tout sur une image.' : 'One long card: everything on a single tall image.')
                : pageCount > 1
                  ? (l === 'fr'
                      ? `${pageCount} cartes actuellement. Retirez des lignes pour revenir à une seule.`
                      : `Currently ${pageCount} cards. Turn lines off to bring it back to one.`)
                  : (l === 'fr' ? 'Tout tient sur une carte.' : 'Everything fits on one card.')}
            </p>
          </div>

          <div style={{
            padding: '11px 20px', flexShrink: 0, background: 'var(--warm)',
            borderTop: '1px solid var(--border)',
            paddingBottom: 'calc(11px + env(safe-area-inset-bottom, 0px))',
          }}>
            <button onClick={() => setShowLines(false)} style={{
              width: '100%', minHeight: '44px', padding: '14px', border: 'none',
              borderRadius: '12px', background: 'var(--terra)', color: '#fff',
              fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
            }}>{l === 'fr' ? 'Terminé' : 'Done'}</button>
          </div>
        </div>
      )}

      {/* ── Reframe a slot ─────────────────────────────────── */}
      {cropSlot !== null && selectedPhotoUrls[cropSlot] && (
        <div style={sheetStyle}>
          <div style={{
            padding: '16px 20px 10px', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center',
            borderBottom: '1px solid var(--border)', flexShrink: 0,
          }}>
            <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 700, color: 'var(--char)' }}>
              {photoCount === 3 && cropSlot === 0
                ? (l === 'fr' ? 'Photo principale' : 'Hero photo')
                : (l === 'fr' ? `Photo ${cropSlot + 1} sur ${photoCount}` : `Photo ${cropSlot + 1} of ${photoCount}`)}
            </p>
            <button onClick={() => setCropSlot(null)} aria-label="Done" style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--smoke)',
              fontSize: '17px', width: '44px', height: '44px',
            }}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            <CropFrame
              url={selectedPhotoUrls[cropSlot]}
              aspect={slotAspect(cropSlot)}
              crop={cropOf(cropSlot)}
              onChange={next => setCrop(cropSlot, next)}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--smoke)', width: '34px' }}>
                {l === 'fr' ? 'Zoom' : 'Zoom'}
              </span>
              <input
                type="range" min={100} max={260}
                value={Math.round(cropOf(cropSlot).scale * 100)}
                onChange={e => setCrop(cropSlot, { scale: Number(e.target.value) / 100 })}
                aria-label="Zoom"
                style={{ flex: 1, height: '44px', accentColor: 'var(--gold)' }}
              />
              <span style={{
                fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--smoke)',
                width: '34px', fontVariantNumeric: 'tabular-nums',
              }}>{cropOf(cropSlot).scale.toFixed(1)}×</span>
            </div>
            <p style={{
              fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--smoke)',
              lineHeight: 1.55, marginTop: '12px',
            }}>
              {l === 'fr'
                ? 'Faites glisser pour cadrer, pincez ou utilisez le curseur pour zoomer. Le cadre est la place que cette photo occupera.'
                : 'Drag to position, pinch or use the slider to zoom. The frame is the slot this photo will fill.'}
            </p>
          </div>

          <div style={{
            padding: '11px 20px', flexShrink: 0, background: 'var(--warm)',
            borderTop: '1px solid var(--border)', display: 'flex', gap: '10px',
            paddingBottom: 'calc(11px + env(safe-area-inset-bottom, 0px))',
          }}>
            <button
              onClick={() => setSlotCrops(prev => ({ ...prev, [cropSlot]: { ...NO_CROP } }))}
              style={{
                flex: 1, minHeight: '44px', padding: '13px',
                border: '1px solid var(--border)', borderRadius: '12px',
                background: 'var(--cream)', color: 'var(--ash)',
                fontFamily: 'var(--font-ui)', fontSize: '14px', cursor: 'pointer',
              }}
            >{l === 'fr' ? 'Réinitialiser' : 'Reset'}</button>
            <button onClick={() => setCropSlot(null)} style={{
              flex: 1, minHeight: '44px', padding: '14px', border: 'none',
              borderRadius: '12px', background: 'var(--terra)', color: '#fff',
              fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
            }}>{l === 'fr' ? 'Terminé' : 'Done'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Drag to position, pinch to zoom. The same {scale, offsetX, offsetY} the
// canvas consumes, so the frame here and the slot there cannot disagree.
function CropFrame({ url, aspect, crop, onChange }: {
  url: string;
  aspect: number;
  crop: SlotCrop;
  onChange: (next: Partial<SlotCrop>) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const pts = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragFrom = useRef<{ x: number; y: number; c: SlotCrop } | null>(null);
  const pinchFrom = useRef<{ d: number; scale: number } | null>(null);

  const W = 300;
  const H = Math.max(120, Math.min(320, Math.round(W / Math.max(0.35, aspect))));

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    boxRef.current?.setPointerCapture(e.pointerId);
    const list = [...pts.current.values()];
    if (list.length === 1) {
      dragFrom.current = { x: e.clientX, y: e.clientY, c: { ...crop } };
    } else if (list.length === 2) {
      dragFrom.current = null;
      pinchFrom.current = {
        d: Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y),
        scale: crop.scale,
      };
    }
  }
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const list = [...pts.current.values()];
    if (list.length >= 2 && pinchFrom.current) {
      const d = Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y);
      const next = pinchFrom.current.scale * (d / (pinchFrom.current.d || 1));
      onChange({ scale: Math.max(1, Math.min(2.6, next)) });
    } else if (dragFrom.current) {
      onChange({
        offsetX: dragFrom.current.c.offsetX + (e.clientX - dragFrom.current.x) / W,
        offsetY: dragFrom.current.c.offsetY + (e.clientY - dragFrom.current.y) / H,
      });
    }
  }
  function onUp(e: React.PointerEvent<HTMLDivElement>) {
    pts.current.delete(e.pointerId);
    dragFrom.current = null;
    pinchFrom.current = null;
  }

  return (
    <div
      ref={boxRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      style={{
        position: 'relative', overflow: 'hidden', borderRadius: '12px',
        background: '#2B2420', margin: '0 auto', touchAction: 'none',
        width: `${W}px`, height: `${H}px`, cursor: 'grab',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(${url})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${crop.scale * 100}% auto`,
        backgroundPosition: `calc(50% + ${crop.offsetX * W}px) calc(50% + ${crop.offsetY * H}px)`,
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.28)',
      }} />
    </div>
  );
}

