'use client';
import { type RecipeResult, type YeastResult } from '../utils';
import { YEAST_TYPES } from '../data';

interface RecipeOutputProps {
  result: RecipeResult;
  numItems: number;
  itemWeight: number;
  styleName: string;
  styleEmoji: string;
}

// ── Helpers ──────────────────────────────────
function pctStr(n: number): string {
  // Tidy baker's % — no trailing zeros
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
  row:    'rgba(245,240,232,0.055)',
  line:   'rgba(245,240,232,0.10)',
  muted:  'rgba(245,240,232,0.45)',
  sub:    'rgba(245,240,232,0.30)',
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
            fontSize: '.68rem',
            color: D.sub,
            fontFamily: 'var(--font-dm-mono)',
            marginTop: '.1rem',
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

// ── Component ─────────────────────────────────
export default function RecipeOutput({
  result, numItems, itemWeight, styleName, styleEmoji,
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Summary callout ──────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '.75rem',
        background: 'var(--terra)',
        borderRadius: '13px',
        padding: '1rem 1.35rem',
      }}>
        <div>
          <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.7)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '.15rem' }}>
            {styleEmoji} {styleName}
          </div>
          <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
            {numItems} × {itemWeight} g = {totalDough} g total
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
        borderRadius: '16px',
        padding: '1.4rem 1.5rem',
        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
      }}>
        {/* Card header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginBottom: '.85rem',
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
            <span style={{ fontSize: '.65rem', color: D.sub, fontFamily: 'var(--font-dm-mono)', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '.06em', minWidth: '4rem' }}>Baker's %</span>
          </div>
        </div>

        {/* Rows */}
        <IngRow label="Flour"  grams={gStr(flour)}  pct="100%"          highlight />
        <IngRow label="Water"  grams={gStr(water)}  pct={pctStr(waterPct)} />
        <IngRow label="Salt"   grams={gStr(salt)}   pct={pctStr(saltPct)} />

        {/* Yeast — commercial */}
        {yeastInfo && (() => {
          const isInstant = yeastInfo.yeastType === 'instant';
          return (
            <IngRow
              label={yeastTypeName}
              sub={!isInstant ? `= ${gStr(yeastInfo.grams)} IDY` : undefined}
              grams={gStr(yeastInfo.convertedGrams)}
              pct={pctStr(yeastInfo.convertedPct)}
            />
          );
        })()}

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

      {/* ── Water temperature ─────────────────────── */}
      <div style={{
        border: '1.5px solid var(--border)',
        borderRadius: '13px',
        padding: '1rem 1.2rem',
        background: waterTemp <= 10 ? '#EEF2FA' : waterTemp <= 18 ? 'var(--warm)' : '#FFF8E8',
        borderColor: waterTemp <= 10 ? '#C4CDE0' : waterTemp <= 18 ? 'var(--border)' : '#E8D080',
        display: 'flex', alignItems: 'flex-start', gap: '1rem',
      }}>
        <span style={{ fontSize: '1.6rem', lineHeight: 1, flexShrink: 0 }}>
          {waterTemp <= 10 ? '🧊' : waterTemp <= 18 ? '💧' : '♨️'}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '.6rem', marginBottom: '.3rem' }}>
            <span style={{ fontWeight: 600, fontSize: '.9rem', color: 'var(--char)' }}>
              Water temperature
            </span>
            <span style={{
              fontFamily: 'var(--font-dm-mono)',
              fontSize: '1.15rem', fontWeight: 700,
              color: waterTemp <= 10 ? '#3A5A8A' : waterTemp <= 18 ? 'var(--sage)' : 'var(--terra)',
            }}>
              {waterTemp}°C
            </span>
          </div>
          <div style={{ fontSize: '.76rem', color: 'var(--smoke)', lineHeight: 1.6 }}>
            <strong>DDT method</strong> — targets a Final Dough Temperature of 24°C.
            {' '}Formula: (24 × 3) − room temp − flour temp − 3 (friction) = <strong>{waterTemp}°C</strong>.
          </div>
          {waterTemp <= 6 && (
            <div style={{ fontSize: '.74rem', color: '#3A5A8A', marginTop: '.4rem', fontWeight: 500 }}>
              Use water straight from the fridge, or add a few ice cubes.
            </div>
          )}
          {waterTemp >= 34 && (
            <div style={{ fontSize: '.74rem', color: 'var(--terra)', marginTop: '.4rem', fontWeight: 500 }}>
              Never use water above 40°C — it will kill the yeast.
            </div>
          )}
        </div>
      </div>

      {/* ── Yeast details ─────────────────────────── */}
      {yeastInfo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>

          {/* Explanation */}
          <div style={{
            fontSize: '.8rem', color: 'var(--smoke)',
            background: 'var(--warm)', border: '1px solid var(--border)',
            borderRadius: '10px', padding: '.65rem .9rem',
            fontFamily: 'var(--font-dm-mono)', lineHeight: 1.55,
          }}>
            {yeastInfo.explanation}
          </div>

          {/* Scale tip */}
          <div style={{
            display: 'flex', gap: '.5rem', alignItems: 'center',
            fontSize: '.78rem', color: 'var(--smoke)',
            background: 'var(--cream)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '.5rem .85rem',
          }}>
            <span>⚖️</span>
            <span>{yeastInfo.scaleNeeded}</span>
          </div>

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

          {/* Warnings */}
          {yeastInfo.warnings.filter(w => !yeastInfo.notRecommended || !w.includes('not recommended')).map((w, i) => (
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
            borderRadius: '13px',
            padding: '1.1rem 1.3rem',
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

          {/* Sourdough warning */}
          {sourdough.warning && (
            <InfoCard icon="🌡️" level="warn" title="Hot kitchen — watch your starter" body={sourdough.warning} />
          )}

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
