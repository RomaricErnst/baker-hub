'use client';
import { type RecipeResult, type YeastResult } from '../utils';
import { YEAST_TYPES } from '../data';

interface RecipeOutputProps {
  result: RecipeResult;
  numItems: number;
  itemWeight: number;
  styleName: string;
  styleEmoji: string;
  mixerType: string;
  kitchenTemp: number;
  fermEquivHours: number;
}

// ── Helpers ──────────────────────────────────
function pctStr(n: number): string {
  return n < 1
    ? `${parseFloat(n.toFixed(3))}%`
    : `${parseFloat(n.toFixed(1))}%`;
}

function gStr(n: number): string {
  return n < 1
    ? `${parseFloat(n.toFixed(2))} g`
    : `${Math.round(n)} g`;
}

// ── Theme tokens for dark card ────────────────
const D = {
  line:   'rgba(212,168,83,0.16)',   // gold-tinted dividers — warm, not cold
  muted:  'rgba(245,240,232,0.60)',  // readable ingredient labels
  sub:    'rgba(245,240,232,0.38)',  // secondary / column headers
};

// ── Ingredient row ────────────────────────────
function IngRow({
  label, sub, grams, pct, highlight = false, range = false,
}: {
  label: string;
  sub?: string;
  grams: string;
  pct: string;
  highlight?: boolean;
  range?: boolean;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto auto',
      gap: '0 1.5rem',
      alignItems: 'center',
      padding: '.6rem .1rem',
      borderBottom: `1px solid ${D.line}`,
    }}>
      <div>
        <div style={{
          fontSize: '.82rem',
          fontWeight: highlight ? 600 : 400,
          color: highlight ? 'var(--cream)' : D.muted,
          letterSpacing: '.02em',
        }}>
          {label}
        </div>
        {sub && (
          <div style={{
            fontSize: '.78rem',
            color: 'rgba(255,255,255,.7)',
            fontFamily: 'var(--font-dm-mono)',
            marginTop: '.1rem',
            lineHeight: 1.5,
          }}>
            {sub}
          </div>
        )}
      </div>

      <div style={{
        fontFamily: 'var(--font-dm-mono)',
        fontSize: range ? '.82rem' : '1rem',
        fontWeight: 700,
        color: highlight ? 'var(--cream)' : 'rgba(245,240,232,0.88)',
        textAlign: 'right',
        whiteSpace: 'nowrap',
      }}>
        {grams}
      </div>

      <div style={{
        fontFamily: 'var(--font-dm-mono)',
        fontSize: '.72rem',
        color: 'var(--gold)',
        textAlign: 'right',
        minWidth: '4rem',
        whiteSpace: 'nowrap',
      }}>
        {pct}
      </div>
    </div>
  );
}

// ── Info cards (light) ────────────────────────
function InfoCard({
  icon, title, body, level = 'info',
}: {
  icon: string;
  title: string;
  body: React.ReactNode;
  level?: 'info' | 'warn' | 'alert' | 'good' | 'poolish';
}) {
  const THEMES = {
    info:    { bg: '#EEF2FA', border: '#C4CDE0', titleColor: '#3A4A6A', bodyColor: 'var(--ash)' },
    warn:    { bg: '#FFF8E8', border: '#E8D080', titleColor: '#7A5A10', bodyColor: '#5A4010' },
    alert:   { bg: '#FEF4EF', border: '#F5C4B0', titleColor: 'var(--terra)', bodyColor: 'var(--ash)' },
    good:    { bg: '#F2FAF0', border: '#B8D8B0', titleColor: '#3A6A30', bodyColor: '#2A4A22' },
    poolish: { bg: '#FDFBF2', border: '#E8D890', titleColor: '#6A5A10', bodyColor: '#4A3A10' },
  };
  const th = THEMES[level];
  return (
    <div style={{
      border: `1.5px solid ${th.border}`,
      borderRadius: '12px',
      padding: '.85rem 1rem',
      background: th.bg,
    }}>
      <div style={{ display: 'flex', gap: '.55rem', alignItems: 'center', marginBottom: '.35rem' }}>
        <span style={{ fontSize: '1rem' }}>{icon}</span>
        <span style={{ fontSize: '.82rem', fontWeight: 600, color: th.titleColor }}>{title}</span>
      </div>
      <div style={{ fontSize: '.78rem', color: th.bodyColor, lineHeight: 1.6, paddingLeft: '1.55rem' }}>
        {body}
      </div>
    </div>
  );
}

// ── Water sub-line ────────────────────────────
function buildWaterSub(
  targetTemp: number,
  waterGrams: number,
  ambientTemp: number,
  isSpiral: boolean,
): string {
  // Physics-based ice split: ice needed to cool tap water from ambient down to target
  // Using heat balance: iceWeight × 80 + iceWeight × target = tapWater × (ambient - target)
  // → iceWeight = waterGrams × (ambient - target) / (target + 80)
  const rawIce = waterGrams * (ambientTemp - targetTemp) / (targetTemp + 80);
  const iceGrams = Math.max(0, Math.round(rawIce));
  const tapGrams = waterGrams - iceGrams;
  const needsIce = iceGrams > 0;

  let guidance: string;
  if (needsIce) {
    if (isSpiral) {
      guidance = `${iceGrams}g ice + ${tapGrams}g tap water — add ice directly to mixing bowl`;
    } else {
      guidance = `fill jug with ${iceGrams}g ice + ${tapGrams}g water, stir 1 min, strain — use chilled water only`;
    }
  } else if (targetTemp <= 13) {
    guidance = 'very cold fridge water — chill 2h before mixing';
  } else if (targetTemp <= 19) {
    guidance = 'cold fridge water';
  } else {
    guidance = 'room temperature tap water';
  }

  return `💧 Use at ${targetTemp}°C · ${guidance}`;
}

// ── Component ─────────────────────────────────
export default function RecipeOutput({
  result, numItems, itemWeight, styleName, styleEmoji, mixerType, kitchenTemp, fermEquivHours,
}: RecipeOutputProps) {
  const { flour, water, salt, yeast, sourdough, oil, sugar, waterTemp, hydration, totalDough } = result;

  const yeastInfo = yeast as YeastResult | null;
  const yeastTypeName = yeastInfo ? YEAST_TYPES[yeastInfo.yeastType]?.name ?? yeastInfo.yeastType : '';

  // Baker's percentages (relative to flour)
  const waterPct  = Math.round(water  / flour * 1000) / 10;
  const saltPct   = Math.round(salt   / flour * 1000) / 10;
  const oilPct    = oil   > 0 ? Math.round(oil   / flour * 1000) / 10 : 0;
  const sugarPct  = sugar > 0 ? Math.round(sugar / flour * 1000) / 10 : 0;

  // Computed ingredient total (excl. starter)
  const ingredientTotal = flour + water + salt
    + (yeastInfo ? yeastInfo.convertedGrams : 0)
    + oil + sugar;

  const itemLabel = numItems === 1 ? 'ball / loaf' : numItems <= 4 ? 'balls' : 'pieces';

  const isSpiral = mixerType === 'spiral';
  const waterSub = buildWaterSub(waterTemp, water, kitchenTemp, isSpiral);

  // Yeast sub-line: IDY conversion + optional precision scale note
  const yeastSub = yeastInfo
    ? (() => {
        const isInstant = yeastInfo.yeastType === 'instant';
        const needsPrecision = yeastInfo.convertedGrams < 0.5;
        const idyPart = !isInstant ? `= ${gStr(yeastInfo.grams)} IDY` : null;
        const scalePart = needsPrecision ? '→ precision scale (0.1g) needed to measure this amount' : null;
        return [idyPart, scalePart].filter(Boolean).join(' · ') || undefined;
      })()
    : undefined;

  // Allowlist approach: only keep warnings about structural issues, never temperature context
  const WARN_ALLOWLIST = ['precision scale', 'poolish', 'not recommended', 'dilution'];
  function isAllowedWarning(w: string): boolean {
    const lw = w.toLowerCase();
    return WARN_ALLOWLIST.some(term => lw.includes(term));
  }

  const filteredWarnings = yeastInfo
    ? yeastInfo.warnings
        .filter(isAllowedWarning)
        .filter(w => !yeastInfo.notRecommended || !w.toLowerCase().includes('not recommended'))
    : [];

  // Suppress explanation if it's purely temperature context
  const EXPLANATION_BLOCKLIST = [
    'kitchen', 'warm', 'hot', 'cool', 'cold', '°c', 'reduced',
    'yeast activity', 'temperature', 'ferment faster', 'ferment more',
  ];
  const showExplanation = yeastInfo
    ? !EXPLANATION_BLOCKLIST.some(term => yeastInfo.explanation.toLowerCase().includes(term))
    : false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Summary callout ──────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '.75rem',
        background: 'var(--terra)',
        borderRadius: '18px',
        padding: '1.1rem 1.4rem',
      }}>
        <div>
          <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.7)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '.2rem' }}>
            {styleEmoji} {styleName}
          </div>
          <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '1.25rem', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
            <span style={{ fontFamily: 'var(--font-dm-mono)' }}>{numItems}</span>
            {' × '}
            <span style={{ fontFamily: 'var(--font-dm-mono)' }}>{itemWeight}</span>
            {' g = '}
            <span style={{ fontFamily: 'var(--font-dm-mono)' }}>{totalDough}</span>
            {' g total'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <span style={{
            background: 'rgba(255,255,255,.18)', borderRadius: '20px',
            padding: '.3rem .8rem', fontSize: '.75rem',
            fontFamily: 'var(--font-dm-mono)', color: '#fff',
          }}>
            {hydration}% hydration
          </span>
          <span style={{
            background: 'rgba(255,255,255,.18)', borderRadius: '20px',
            padding: '.3rem .8rem', fontSize: '.75rem',
            fontFamily: 'var(--font-dm-mono)', color: '#fff',
          }}>
            {numItems} {itemLabel}
          </span>
        </div>
      </div>

      {/* ── Ingredients card (dark) ───────────────── */}
      <div style={{
        background: 'var(--char)',
        borderRadius: '18px',
        padding: '1.5rem 1.6rem',
        border: '1px solid rgba(212,168,83,0.12)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.14)',
      }}>
        {/* Card header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginBottom: '1rem',
        }}>
          <div style={{
            fontFamily: 'var(--font-playfair)',
            fontSize: '1.1rem', fontWeight: 700,
            color: 'var(--cream)',
          }}>
            Ingredients
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto auto',
            gap: '0 1.5rem', width: '100%', maxWidth: '75%',
          }}>
            <span />
            <span style={{ fontSize: '.65rem', color: D.sub, fontFamily: 'var(--font-dm-mono)', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '.06em' }}>Weight</span>
            <span style={{ fontSize: '.65rem', color: D.sub, fontFamily: 'var(--font-dm-mono)', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '.06em', minWidth: '4rem' }}>Baker&apos;s %</span>
          </div>
        </div>

        {/* Rows */}
        <IngRow label="Flour" grams={gStr(flour)} pct="100%" highlight />
        <IngRow label="Water" grams={gStr(water)} pct={pctStr(waterPct)} sub={waterSub} />
        <IngRow label="Salt"  grams={gStr(salt)}  pct={pctStr(saltPct)} />

        {/* Yeast — commercial */}
        {yeastInfo && (
          <IngRow
            label={yeastTypeName}
            sub={yeastSub}
            grams={gStr(yeastInfo.convertedGrams)}
            pct={pctStr(yeastInfo.convertedPct)}
          />
        )}

        {/* Yeast — sourdough starter range */}
        {sourdough && (
          <IngRow
            label="Sourdough Starter"
            sub="add to flour + water"
            grams={`${sourdough.starterGramsMin}–${sourdough.starterGramsMax} g`}
            pct={`${sourdough.starterPctMin}–${sourdough.starterPctMax}%`}
            range
          />
        )}

        {/* Optional: oil */}
        {oil > 0 && (
          <IngRow label="Olive Oil" grams={gStr(oil)} pct={pctStr(oilPct)} />
        )}

        {/* Optional: sugar */}
        {sugar > 0 && (
          <IngRow label="Sugar" grams={gStr(sugar)} pct={pctStr(sugarPct)} />
        )}

        {/* Total row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto auto',
          gap: '0 1.5rem',
          alignItems: 'center',
          padding: '.65rem .1rem 0',
          marginTop: '.1rem',
        }}>
          <div style={{ fontSize: '.75rem', color: D.muted, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)' }}>
            Total{sourdough ? ' (excl. starter)' : ''}
          </div>
          <div style={{
            fontFamily: 'var(--font-dm-mono)',
            fontSize: '1rem', fontWeight: 700,
            color: 'var(--gold)', textAlign: 'right', whiteSpace: 'nowrap',
          }}>
            {sourdough
              ? `~${Math.round(ingredientTotal)} g`
              : gStr(ingredientTotal)
            }
          </div>
          <div style={{ minWidth: '4rem' }} />
        </div>
      </div>

      {/* ── Flour note ────────────────────────────── */}
      {(() => {
        let main: string;
        if (fermEquivHours < 8) {
          main = 'Pizza or bread flour works well for this plan.';
        } else if (fermEquivHours < 24) {
          main = 'Pizza flour gives the best results — 00 or T45 forte if you have it 🌾';
        } else {
          main = 'Strong pizza flour recommended for this long fermentation — 00 W270+ or T45 forte 🌾';
        }
        return (
          <div style={{
            background: 'var(--warm)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--sage)',
            borderRadius: '12px',
            padding: '.85rem 1.1rem',
          }}>
            <div style={{ fontSize: '.82rem', color: 'var(--char)', lineHeight: 1.55 }}>
              {main}
            </div>
            <div style={{ fontSize: '.75rem', color: 'var(--smoke)', marginTop: '.3rem' }}>
              Using plain flour or T55? Tap to adapt →
            </div>
          </div>
        );
      })()}

      {/* ── Yeast details ─────────────────────────── */}
      {yeastInfo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>

          {/* Explanation */}
          {showExplanation && (
            <div style={{
              fontSize: '.8rem', color: 'var(--smoke)',
              background: 'var(--warm)', border: '1px solid var(--border)',
              borderRadius: '10px', padding: '.65rem .9rem',
              fontFamily: 'var(--font-dm-mono)', lineHeight: 1.55,
            }}>
              {yeastInfo.explanation}
            </div>
          )}

          {/* Dilution tip */}
          {yeastInfo.dilutionTip && (
            <InfoCard
              icon="🧪"
              level="info"
              title="Dilution required — amount too small to weigh directly"
              body={yeastInfo.dilutionTip}
            />
          )}

          {/* Poolish recommendation */}
          {yeastInfo.recommendPoolish && (
            <InfoCard
              icon="🏺"
              level="poolish"
              title="Poolish preferment recommended"
              body={
                <>
                  Long room-temperature fermentation is hard to control. A poolish gives you better
                  flavour and more predictable timing. Mix 50% of your flour with an equal weight of water
                  and a pinch of yeast 8–16h before baking.
                </>
              }
            />
          )}

          {/* Not recommended warning */}
          {yeastInfo.notRecommended && (
            <InfoCard
              icon="⚠️"
              level="alert"
              title="This fermentation schedule is not recommended"
              body="The combination of time and temperature will likely cause over-fermentation. Add a cold retard phase or shorten room-temperature time."
            />
          )}

          {/* Filtered warnings */}
          {filteredWarnings.map((w, i) => (
            <InfoCard key={i} icon="⚠️" level="warn" title="Watch out" body={w} />
          ))}
        </div>
      )}

      {/* ── Sourdough guidance ────────────────────── */}
      {sourdough && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>

          {/* Starter range */}
          <div style={{
            background: 'var(--char)',
            borderRadius: '18px',
            padding: '1.2rem 1.4rem',
            border: '1px solid rgba(212,168,83,0.12)',
          }}>
            <div style={{ fontSize: '.7rem', color: D.sub, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)', marginBottom: '.5rem' }}>
              Sourdough Starter 🫙
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--gold)' }}>
                {sourdough.starterGramsMin}–{sourdough.starterGramsMax} g
              </span>
              <span style={{ fontSize: '.8rem', color: D.muted }}>
                ({sourdough.starterPctMin}–{sourdough.starterPctMax}% of flour)
              </span>
            </div>
            <div style={{ fontSize: '.75rem', color: D.sub, marginTop: '.4rem', lineHeight: 1.5 }}>
              Feed your starter 4–12h before mixing. Use it at peak activity — doubled in size, domed on top.
            </div>
          </div>


          {/* Bulk fermentation cues */}
          <div style={{
            border: '1.5px solid var(--border)',
            borderRadius: '13px',
            padding: '1rem 1.2rem',
            background: 'var(--warm)',
          }}>
            <div style={{
              fontSize: '.72rem', color: 'var(--smoke)',
              textTransform: 'uppercase', letterSpacing: '.06em',
              fontFamily: 'var(--font-dm-mono)', marginBottom: '.7rem',
            }}>
              Bulk fermentation is ready when…
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.45rem' }}>
              {sourdough.bulkCues.map((cue, i) => (
                <div key={i} style={{ display: 'flex', gap: '.65rem', alignItems: 'flex-start' }}>
                  <span style={{
                    width: '18px', height: '18px', borderRadius: '50%',
                    border: '1.5px solid var(--border)',
                    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '.6rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)',
                    marginTop: '.05rem',
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: '.8rem', color: 'var(--ash)', lineHeight: 1.55 }}>{cue}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
