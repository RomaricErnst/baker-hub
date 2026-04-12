'use client';
import { useState } from 'react';
import { type ScheduleResult, formatTime, hoursLabel } from '../utils';
import { MIXER_TYPES, type MixerType } from '../data';
import LearnModal from './LearnModal';
import { IconPreferment, IconStarter, IconMix, IconBulk, IconCold, IconDivide, IconProof, IconPreheat, IconBake } from './StepIcons';

interface BakeGuideProps {
  schedule: ScheduleResult;
  mixerType: MixerType;
  styleKey: string;
  kitchenTemp: number;
  numItems: number;
  prefermentType?: string;
  oil: number;
  hydration: number;
  ovenType?: string;
  prefStartTime?: Date | null;
  feedTime?: Date | null;
}

// ── Design tokens ────────────────────────────────────
const D = {
  char: '#1A1612', ash: '#3D3530', cream: '#F5F0E8',
  terra: '#C4522A', gold: '#D4A853', sage: '#6B7A5A',
  smoke: '#8A7F78', border: '#E8E0D5', warm: '#FDFBF7',
};

// ── Section sub-component ────────────────────────────
function Section({ icon, title, children }: {
  icon: string; title: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{
        fontSize: '.68rem', fontWeight: 600, color: D.smoke,
        textTransform: 'uppercase', letterSpacing: '.07em',
        fontFamily: 'var(--font-dm-mono)', marginBottom: '.5rem',
        display: 'flex', alignItems: 'center', gap: '.35rem',
      }}>
        <span>{icon}</span>{title}
      </div>
      <div style={{ fontSize: '.82rem', color: D.ash, lineHeight: 1.65, fontFamily: 'var(--font-dm-sans)' }}>
        {children}
      </div>
    </div>
  );
}

// ── Bullet list ──────────────────────────────────────
function Bullets({ items }: { items: (string | React.ReactNode)[] }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start' }}>
          <span style={{ color: D.terra, flexShrink: 0, marginTop: '.1rem' }}>·</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Numbered steps ───────────────────────────────────
function Steps({ items }: { items: { bold: string; note: string }[] }) {
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: '.55rem', alignItems: 'flex-start' }}>
          <span style={{
            fontSize: '.65rem', fontFamily: 'var(--font-dm-mono)',
            color: D.smoke, flexShrink: 0, minWidth: '16px', marginTop: '.15rem',
          }}>{i + 1}.</span>
          <span>
            <strong style={{ color: D.char }}>{item.bold}</strong>
            {item.note && <em style={{ color: D.smoke }}>{' — '}{item.note}</em>}
          </span>
        </li>
      ))}
    </ol>
  );
}

// ── Pumpkin shape SVG (spiral mixer) ────────────────
function PumpkinSVG() {
  return (
    <svg viewBox="0 0 200 140" style={{ width: '100%', maxWidth: '200px', margin: '.5rem auto', display: 'block' }}>
      {/* Bowl outline */}
      <ellipse cx="100" cy="110" rx="85" ry="22" fill="none" stroke="#C8B898" strokeWidth="2" strokeDasharray="4 3" />
      <path d="M 15 110 Q 15 60 100 55 Q 185 60 185 110" fill="none" stroke="#C8B898" strokeWidth="2" strokeDasharray="4 3" />
      {/* Breaker bar */}
      <rect x="94" y="20" width="12" height="90" rx="6" fill="#8A7F78" />
      {/* Dough pumpkin wrapped around bar */}
      <ellipse cx="100" cy="80" rx="38" ry="28" fill="#E8D4A8" stroke="#C4A030" strokeWidth="1.5" />
      <ellipse cx="100" cy="65" rx="28" ry="20" fill="#E8D4A8" stroke="#C4A030" strokeWidth="1.5" />
      <ellipse cx="100" cy="52" rx="18" ry="13" fill="#E8D4A8" stroke="#C4A030" strokeWidth="1.5" />
      {/* Dough ribs/segments */}
      <path d="M 80 80 Q 90 65 85 50" fill="none" stroke="#C4A030" strokeWidth="1" strokeOpacity="0.5" />
      <path d="M 120 80 Q 110 65 115 50" fill="none" stroke="#C4A030" strokeWidth="1" strokeOpacity="0.5" />
      {/* Label */}
      <text x="100" y="130" textAnchor="middle" fontSize="10" fill="#8A7F78" fontFamily="DM Mono, monospace">
        target shape
      </text>
    </svg>
  );
}

// ── Pill tag ─────────────────────────────────────────
function Pill({ label, color }: { label: string; color?: string }) {
  return (
    <span style={{
      display: 'inline-block',
      background: color ? `${color}18` : '#F5F0E820',
      border: `1px solid ${color ?? D.border}40`,
      borderRadius: '20px',
      padding: '.15rem .6rem',
      fontSize: '.7rem',
      fontFamily: 'var(--font-dm-mono)',
      color: color ?? D.smoke,
      marginLeft: '.5rem',
    }}>{label}</span>
  );
}

// ── Step card ────────────────────────────────────────
function StepCard({
  number, icon, title, time, duration, accent = D.terra, children,
}: {
  number: number; icon: React.ReactNode; title: string;
  time?: Date; duration?: number | null;
  accent?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{
      background: D.warm, borderRadius: '18px',
      border: `1px solid ${D.border}`,
      overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(26,22,18,0.06)',
    }}>
      {/* Card header */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '.75rem',
          padding: '1rem 1.25rem', cursor: 'pointer',
          borderLeft: `4px solid ${accent}`,
        }}
      >
        <span style={{
          width: '28px', height: '28px', borderRadius: '50%',
          background: `${accent}18`, border: `1.5px solid ${accent}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '.75rem', fontFamily: 'var(--font-dm-mono)',
          color: accent, fontWeight: 700, flexShrink: 0,
        }}>{number}</span>
        <span style={{ width: '22px', height: '22px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accent }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-playfair)', fontSize: '1rem',
            fontWeight: 700, color: D.char,
          }}>{title}</div>
          {time && (
            <div style={{ fontSize: '.72rem', color: D.smoke, fontFamily: 'var(--font-dm-mono)', marginTop: '.1rem' }}>
              {formatTime(time)}
              {duration ? ` · ${hoursLabel(duration)}` : ''}
            </div>
          )}
        </div>
        <span style={{ color: D.smoke, fontSize: '.8rem', flexShrink: 0 }}>
          {open ? '▲' : '▼'}
        </span>
      </div>
      {/* Card body */}
      {open && (
        <div style={{ padding: '0 1.25rem 1.25rem', borderTop: `1px solid ${D.border}` }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Learn link ───────────────────────────────────────
function LearnLink({ term, label, onOpen }: { term: string; label: string; onOpen: (t: string) => void }) {
  return (
    <button
      onClick={() => onOpen(term)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: D.terra, fontSize: '.78rem',
        fontFamily: 'var(--font-dm-sans)',
        textDecoration: 'underline', textUnderlineOffset: '2px',
        padding: 0,
      }}
    >{label} →</button>
  );
}

// ── External link ────────────────────────────────────
function ExtLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{
      color: D.terra, fontSize: '.78rem',
      fontFamily: 'var(--font-dm-sans)',
      textDecoration: 'underline', textUnderlineOffset: '2px',
    }}>{label} →</a>
  );
}

// ── Main component ───────────────────────────────────
export default function BakeGuide({
  schedule, mixerType, styleKey, kitchenTemp, numItems,
  prefermentType, oil, hydration, ovenType, prefStartTime, feedTime,
}: BakeGuideProps) {
  const [learnTerm, setLearnTerm] = useState<string | null>(null);

  const isSourdough   = styleKey === 'sourdough' || styleKey === 'pain_levain';
  const isBread       = ['pain_campagne','pain_levain','baguette','pain_complet','pain_seigle','fougasse','brioche','pain_mie','pain_viennois','sourdough'].includes(styleKey);
  const isNeapolitan  = styleKey === 'neapolitan';
  const isSpiral      = mixerType === 'spiral';
  const hasPref       = !!prefermentType && prefermentType !== 'none';
  const isPoolish     = prefermentType === 'poolish';
  const isBiga        = prefermentType === 'biga';
  const isTwoPhase    = schedule.coldRetard2Start !== null;
  const hasCold       = (schedule.coldRetardHours ?? 0) > 0;
  const extraBalls    = Math.max(0, numItems - 4);
  const divideMin     = 15 + 2 * extraBalls;

  let stepNum = 0;
  const n = () => ++stepNum;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Header ──────────────────────────────────── */}
      <div style={{ marginBottom: '.25rem' }}>
        <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '1.2rem', fontWeight: 700, color: D.char }}>
          Step-by-step bake guide
        </div>
        <div style={{ fontSize: '.75rem', color: D.smoke, fontFamily: 'var(--font-dm-mono)', marginTop: '.2rem' }}>
          {formatTime(schedule.bulkFermStart)} → {formatTime(schedule.bakeStart)} · {hoursLabel((schedule.bakeStart.getTime() - schedule.bulkFermStart.getTime()) / 3600000)} total
        </div>
      </div>

      {/* ── STEP: Make Poolish / Biga ───────────────── */}
      {hasPref && prefStartTime && (
        <StepCard number={n()} icon={<IconPreferment />}
          title={isPoolish ? 'Make your Poolish' : 'Make your Biga'}
          time={prefStartTime} accent={D.gold}>

          <Section icon="🥄" title="What to do">
            {isPoolish ? (
              <Steps items={[
                { bold: 'Weigh equal parts flour and water', note: 'see recipe for exact amounts — 100% hydration' },
                { bold: 'Add a pinch of IDY', note: 'very small amount — poolish ferments slowly' },
                { bold: 'Stir vigorously until no dry flour remains', note: '~2 min — smooth, thick batter consistency' },
                { bold: 'Cover tightly with cling film', note: 'press it to the surface to prevent skin' },
                { bold: kitchenTemp >= 26 ? 'Place in fridge (4°C)' : 'Leave at room temperature', note: kitchenTemp >= 26 ? 'tropical kitchen — fridge prevents over-fermentation' : `${kitchenTemp}°C is ideal for a slow room temp poolish` },
              ]} />
            ) : (
              <Steps items={[
                { bold: 'Weigh flour and water', note: 'see recipe — biga is ~50-60% hydration, stiffer than poolish' },
                { bold: 'Add a tiny amount of IDY', note: '0.1-0.2% of flour — biga ferments very slowly' },
                { bold: 'Mix roughly until just combined', note: 'biga is intentionally shaggy — do not over-mix' },
                { bold: 'Cover loosely', note: 'biga needs some air exchange unlike poolish' },
                { bold: 'Place in fridge (4°C)', note: 'biga always ferments cold — never at room temp' },
              ]} />
            )}
          </Section>

          <Section icon="👁️" title="Watch for — it's ready when">
            <Bullets items={[
              isPoolish
                ? 'Surface is domed and bubbly — looks like a lava lamp slowly bubbling'
                : 'Surface has small cracks and bubbles — smells yeasty and slightly alcoholic',
              'Slightly pulling away from the sides of the container',
              isPoolish ? 'Just starting to flatten (use it now — don\'t wait for full collapse)' : 'Has increased in volume by roughly 50%',
            ]} />
          </Section>

          <Section icon="⚠️" title="Pitfalls">
            <Bullets items={[
              'Over-fermented: strong alcohol smell, flat surface, watery — discard and start again',
              isPoolish ? 'Fully collapsed poolish loses strength — check before the centre drops' : 'Biga that smells like acetone is over-fermented',
              'Using warm water — use room temp or cold water for slow controlled fermentation',
            ]} />
          </Section>
        </StepCard>
      )}

      {/* ── STEP: Feed Starter (sourdough) ──────────── */}
      {isSourdough && feedTime && (
        <StepCard number={n()} icon={<IconStarter />} title="Feed your starter" time={feedTime} accent="#6A7FA8">
          <Section icon="🥄" title="What to do">
            <Steps items={[
              { bold: 'Discard all but 50g of starter', note: 'fresh ratio ferments faster and more predictably' },
              { bold: 'Add 50g flour + 50g water (1:1:1)', note: 'adjust ratio for your target peak time' },
              { bold: 'Stir vigorously until smooth', note: 'no lumps' },
              { bold: 'Mark the jar with a rubber band', note: 'tracks rise visually' },
              { bold: 'Leave uncovered or lightly covered', note: 'starter needs air' },
            ]} />
          </Section>
          <Section icon="👁️" title="Ready when">
            <Bullets items={[
              `Doubled in size — at ${kitchenTemp}°C expect ${kitchenTemp >= 28 ? '3-5h' : kitchenTemp >= 24 ? '4-7h' : '6-10h'}`,
              'Domed top with visible bubbles on surface and sides',
              'Float test: drop a small piece in water — if it floats, it\'s ready',
              'Smells tangy and yeasty — not alcoholic',
            ]} />
          </Section>
          <Section icon="⚠️" title="Pitfalls">
            <Bullets items={[
              'Using starter past peak — it will have less strength and your dough will rise slowly',
              'Hooch (dark liquid on top) means starter was hungry — pour it off, feed, wait for full rise before using',
            ]} />
          </Section>
        </StepCard>
      )}

      {/* ── STEP: Mix Dough ─────────────────────────── */}
      <StepCard number={n()} icon={<IconMix />} title="Mix your dough"
        time={schedule.bulkFermStart} duration={schedule.mixingDurationH} accent={D.ash}>

        <Section icon="🥄" title="Mixing order">
          {mixerType === 'hand' && !isSourdough && (
            <Steps items={hydration > 70 ? [
              // >70%: autolyse, then yeast+salt, brief knead, then bassinage, then full knead
              { bold: 'Flour + 90% of your water', note: 'mix until no dry flour — ~2 min' },
              { bold: 'Cover and rest 20 min', note: 'autolyse — gluten forms without kneading' },
              { bold: 'Add yeast', note: 'mix to combine — 2 min' },
              { bold: 'Add salt', note: 'mix until absorbed — 2 min' },
              ...(hasPref ? [{ bold: `Add your ${prefermentType} (all of it)`, note: 'mix until fully incorporated' }] : []),
              { bold: 'Knead 5 min to build base structure', note: 'dough should feel cohesive before adding remaining water' },
              { bold: 'Add remaining 10% water gradually', note: 'bassinage — small splash at a time, knead until absorbed, repeat' },
              ...(oil > 0 ? [{ bold: 'Add oil last', note: 'mix 1 min — oil added late preserves gluten' }] : []),
              { bold: 'Continue kneading until smooth and elastic', note: 'windowpane test — typically 5–8 min more' },
            ] : [
              // ≤70%: autolyse, yeast, salt, remaining water, then full knead
              { bold: 'Flour + 90% of your water', note: 'mix until no dry flour — ~2 min' },
              { bold: 'Cover and rest 20 min', note: 'autolyse — gluten forms without kneading' },
              { bold: 'Add yeast', note: 'mix to combine — 2 min' },
              { bold: 'Add salt', note: 'mix until absorbed — 2 min' },
              ...(hasPref ? [{ bold: `Add your ${prefermentType} (all of it)`, note: 'mix until fully incorporated' }] : []),
              { bold: 'Add remaining 10% water', note: 'mix until absorbed — ~1 min' },
              ...(oil > 0 ? [{ bold: 'Add oil last', note: 'mix 1 min — oil added late preserves gluten' }] : []),
              { bold: 'Knead 8–12 min until smooth and elastic', note: 'windowpane test' },
            ]} />
          )}
          {mixerType === 'stand' && !isSourdough && (
            <Steps items={hydration > 70 ? [
              // >70%: build structure first, then bassinage, then final Speed 2
              { bold: 'Flour + 90% of water', note: 'Speed 1, 2 min to combine' },
              ...(hasPref ? [{ bold: `Add ${prefermentType}`, note: 'Speed 1, mix until incorporated' }] : []),
              { bold: 'Add yeast', note: 'Speed 1, 2 min' },
              { bold: 'Add salt', note: 'Speed 1, 2 min until absorbed' },
              { bold: 'Speed 2 — 4–5 min', note: 'build gluten structure before adding remaining water' },
              { bold: 'Add remaining 10% water gradually at Speed 2', note: 'bassinage — small additions, wait for absorption between each' },
              { bold: 'Continue Speed 2', note: 'until dough clears the bowl — windowpane test' },
              ...(oil > 0 ? [{ bold: 'Add oil last', note: 'Speed 1, 1 min' }] : []),
            ] : [
              // ≤70%: remaining water before Speed 2
              { bold: 'Flour + 90% of water', note: 'Speed 1, 2 min to combine' },
              ...(hasPref ? [{ bold: `Add ${prefermentType}`, note: 'Speed 1, mix until incorporated' }] : []),
              { bold: 'Add yeast', note: 'Speed 1, 2 min' },
              { bold: 'Add salt', note: 'Speed 1, 2 min until absorbed' },
              { bold: 'Add remaining 10% water', note: 'Speed 1, mix until absorbed — ~1 min' },
              { bold: 'Speed 2 — 6–10 min', note: 'until dough clears the bowl — windowpane test' },
              ...(oil > 0 ? [{ bold: 'Add oil last', note: 'Speed 1, 1 min' }] : []),
            ]} />
          )}
          {mixerType === 'spiral' && !isSourdough && (
            <>
              <Steps items={hydration > 70 ? [
                // >70%: pumpkin first, bassinage after
                { bold: 'Flour + 90% water + yeast', note: 'Speed 1, 3 min to combine' },
                ...(hasPref ? [{ bold: `Add ${prefermentType}`, note: 'Speed 1, mix until incorporated' }] : []),
                { bold: 'Add salt', note: 'Speed 1, 2 min' },
                { bold: 'Speed 2 until pumpkin shape forms', note: 'typically 10–15 min — stop if FDT exceeds 28°C' },
                { bold: 'Once pumpkin is stable — add remaining 10% water gradually', note: 'bassinage — small additions, wait for pumpkin to reform each time' },
                ...(oil > 0 ? [{ bold: 'Add oil last', note: 'Speed 1, 1 min' }] : []),
              ] : [
                // ≤70%: remaining water before Speed 2
                { bold: 'Flour + 90% water + yeast', note: 'Speed 1, 3 min to combine' },
                ...(hasPref ? [{ bold: `Add ${prefermentType}`, note: 'Speed 1, mix until incorporated' }] : []),
                { bold: 'Add salt', note: 'Speed 1, 2 min' },
                { bold: 'Add remaining 10% water', note: 'Speed 1, mix until absorbed — ~1 min' },
                { bold: 'Speed 2 until pumpkin shape forms', note: 'typically 10–15 min — stop if FDT exceeds 28°C' },
                ...(oil > 0 ? [{ bold: 'Add oil last', note: 'Speed 1, 1 min' }] : []),
              ]} />
              <div style={{ marginTop: '.75rem' }}>
                <div style={{ fontSize: '.72rem', color: D.smoke, fontFamily: 'var(--font-dm-mono)', marginBottom: '.25rem' }}>TARGET SHAPE</div>
                <PumpkinSVG />
              </div>
            </>
          )}
          {mixerType === 'no_knead' && (
            <Steps items={[
              { bold: 'Combine all ingredients including salt', note: 'mix just until no dry flour remains — ~2 min' },
              ...(hasPref ? [{ bold: `Add ${prefermentType}`, note: 'mix until incorporated' }] : []),
              { bold: 'Cover and rest', note: 'stretch & folds every 30 min for the first 2 hours' },
            ]} />
          )}
          {isSourdough && (
            <Steps items={[
              { bold: 'Flour + 90% of water', note: 'mix 2 min until no dry flour' },
              { bold: 'Add your starter at peak', note: 'mix to combine' },
              { bold: 'Add salt + remaining 10% water', note: 'mix until fully absorbed' },
              ...(oil > 0 ? [{ bold: 'Add oil last', note: 'preserves gluten structure' }] : []),
            ]} />
          )}
        </Section>

        <Section icon="🌡️" title="Water temperature">
          <Bullets items={[
            `Target Final Dough Temperature (FDT): ${isNeapolitan ? '23°C' : isBread ? '24°C' : '24°C'}`,
            'Use the water temperature from your recipe — Baker Hub calculated this accounting for your kitchen and mixer',
            'Check FDT with a thermometer right after mixing — dough should feel cool to the touch',
            'FDT above 28°C: refrigerate dough for 15 min before bulk fermentation',
          ]} />
          <div style={{ marginTop: '.5rem' }}>
            <LearnLink term="fdt" label="What is FDT?" onOpen={setLearnTerm} />
          </div>
        </Section>

        <Section icon="👁️" title="Watch for">
          <Bullets items={[
            mixerType === 'spiral'
              ? 'Pumpkin shape: dough wraps around the breaker bar, pulls cleanly from bowl walls'
              : 'Smooth, elastic ball — slightly tacky but not sticky',
            'Windowpane test: stretch a small piece until light shows through without tearing',
            'Skin looks smooth and slightly shiny',
          ]} />
          <div style={{ marginTop: '.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <LearnLink term="windowpane" label="Windowpane test" onOpen={setLearnTerm} />
            {mixerType === 'hand' && !isSourdough && <LearnLink term="autolyse" label="Autolyse" onOpen={setLearnTerm} />}
            {isSpiral && <LearnLink term="pumpkin" label="Pumpkin shape" onOpen={setLearnTerm} />}
            {hydration > 70 && <LearnLink term="bassinage" label="Bassinage" onOpen={setLearnTerm} />}
          </div>
        </Section>

        <Section icon="⚠️" title="Pitfalls">
          <Bullets items={[
            'Adding salt and yeast at the same time — salt kills yeast on contact, always add separately',
            'Over-kneading by hand is nearly impossible — but over-mixing in a stand mixer is not, stop when windowpane passes',
            isSpiral ? 'Ignoring FDT — spiral mixers generate heat, dough can exceed 28°C without noticing' : '',
            'Adding oil before gluten develops — oil coats proteins and blocks gluten formation',
          ].filter(Boolean)} />
        </Section>
      </StepCard>

      {/* ── STEP: Bulk Fermentation ──────────────────── */}
      <StepCard number={n()} icon={<IconBulk />} title="Bulk Fermentation"
        time={schedule.bulkFermStart} duration={schedule.bulkFermHours} accent={D.terra}>

        <Section icon="🥄" title="What to do">
          <Steps items={[
            { bold: 'Transfer dough to a lightly oiled container with a lid', note: 'clear container lets you monitor rise' },
            { bold: 'Mark the level with a rubber band', note: 'tracks 50-75% rise target' },
            ...(schedule.bulkFermHours >= 1.5 ? [
              { bold: 'Set 1 — after 30 min: stretch & fold', note: 'wet hand, grab one side, stretch up then fold over centre. Rotate 90° and repeat x4' },
              { bold: 'Set 2 — after 1h: stretch & fold', note: 'dough should feel more cohesive and resist tearing' },
              ...(schedule.bulkFermHours >= 2 ? [
                { bold: 'Set 3 — after 1h30: stretch & fold', note: 'dough will feel smooth and strong' },
                { bold: 'Set 4 — after 2h: final fold', note: 'then leave undisturbed until bulk is done' },
              ] : []),
            ] : schedule.bulkFermHours >= 0.5 ? [
              { bold: 'After 15 min: one set of stretch & folds', note: 'then cover and rest — short bulk goes straight to cold' },
            ] : [
              { bold: 'Cover immediately and place in fridge', note: 'bulk is very short — dough goes cold right away' },
            ]),
          ]} />
        </Section>

        <Section icon="👁️" title="Watch for — bulk is done when">
          <Bullets items={[
            'Dough has grown 50-75% (not doubled — pizza dough bulk is shorter than bread)',
            'Slightly domed, bubbly surface',
            'Jiggles like jelly when you shake the container',
            'Feels airy and lighter than when you started',
          ]} />
          <div style={{ marginTop: '.5rem' }}>
            <LearnLink term="bulk_fermentation" label="Bulk fermentation guide" onOpen={setLearnTerm} />
          </div>
        </Section>

        <Section icon="⚠️" title="Pitfalls">
          <Bullets items={[
            'Bulk in a warm spot above 26°C — dough ferments too fast, less flavour',
            'Over-bulk: more than 75% rise means gluten has started to break down — dough will be slack and tear during shaping',
            'Under-bulk: less than 30% rise — not enough gas development, dough will be dense',
            'Skipping stretch & folds — they build gluten strength that makes shaping much easier',
          ]} />
        </Section>
      </StepCard>

      {/* ── STEP: Cold Retard 1 ──────────────────────── */}
      {hasCold && schedule.coldRetard1Start && schedule.coldRetard1End && (
        <StepCard number={n()} icon={<IconCold />}
          title={isTwoPhase ? 'Cold Retard — Whole Dough' : 'Cold Retard'}
          time={schedule.coldRetard1Start}
          duration={(schedule.coldRetard1End.getTime() - schedule.coldRetard1Start.getTime()) / 3600000}
          accent="#6A7FA8">

          <Section icon="🥄" title="What to do">
            <Steps items={[
              { bold: 'Cover container tightly with cling film', note: 'press to the surface — dough skin is the enemy' },
              { bold: 'Place on a middle shelf at the back of the fridge', note: 'back of fridge is coldest and most consistent — avoid the door' },
              { bold: 'Set your alarm for Divide & Ball time', note: formatTime(schedule.divideBallTime ?? schedule.coldRetard1End) },
              { bold: 'No need to check the dough', note: 'cold fermentation is slow and forgiving' },
            ]} />
          </Section>

          <Section icon="👁️" title="What to expect">
            <Bullets items={[
              'Dough will grow slowly — 20-30% rise during cold retard is normal',
              'Surface may look slightly domed and have small bubbles — this is perfect',
              'Cold dough is stiff straight from the fridge — this is correct, it makes divide & ball easier',
            ]} />
          </Section>

          <Section icon="⚠️" title="Pitfalls">
            <Bullets items={[
              'Leaving uncovered: dough skin forms, tears during shaping and creates uneven balls',
              'Fridge temperature above 8°C: dough over-ferments during retard — check your fridge',
              'Rushing the cold phase: minimum cold time is important for flavour and gluten relaxation',
            ]} />
          </Section>
        </StepCard>
      )}

      {/* ── STEP: Divide & Ball ──────────────────────── */}
      {schedule.divideBallTime && (
        <StepCard number={n()} icon={<IconDivide />} title="Divide & Ball"
          time={schedule.divideBallTime} duration={divideMin / 60} accent="#8A6A4A">

          <Section icon="🥄" title="What to do">
            <Steps items={[
              { bold: `Weigh dough and divide into ${numItems} equal pieces`, note: 'use a scale — eyeballing leads to uneven baking' },
              { bold: 'Pre-shape each piece into a rough round', note: 'fold edges to centre, flip seam-side down' },
              { bold: 'Tuck and drag: cup your hand over the ball', note: 'drag it toward you on an unfloured surface — creates surface tension' },
              { bold: 'Place in individual dough boxes or bowls', note: 'seam side down, well-spaced' },
              ...(isTwoPhase ? [{ bold: 'Cover and return to fridge immediately', note: 'balls go back cold for phase 2' }] : [
                { bold: 'Cover and leave at room temperature', note: 'final proof begins now' },
              ]),
            ]} />
          </Section>

          <Section icon="👁️" title="Watch for — a good ball">
            <Bullets items={[
              'Smooth, taut skin with no tears or folds visible on top',
              'Holds its round shape — doesn\'t immediately spread flat (if it does, gluten is weak)',
              `At ${kitchenTemp}°C, work within ${kitchenTemp >= 30 ? '15 min' : kitchenTemp >= 26 ? '20 min' : '30 min'} — warm kitchens make balls proof quickly`,
            ]} />
          </Section>

          <Section icon="⚠️" title="Pitfalls">
            <Bullets items={[
              'Flouring the surface: reduces friction, ball won\'t get surface tension — use bare, slightly damp surface',
              'Tearing the skin during shaping — pre-shape roughly first, rest 5 min, then final ball',
              `Hot kitchen (${kitchenTemp >= 30 ? 'like yours at ' + kitchenTemp + '°C' : '≥30°C'}): get balls into their boxes fast — they proof very quickly at warm temps`,
            ]} />
          </Section>
        </StepCard>
      )}

      {/* ── STEP: Cold Retard 2 (two-phase) ─────────── */}
      {isTwoPhase && schedule.coldRetard2Start && schedule.coldRetard2End && (
        <StepCard number={n()} icon={<IconCold />} title="Cold Retard — Balls"
          time={schedule.coldRetard2Start}
          duration={(schedule.coldRetard2End.getTime() - schedule.coldRetard2Start.getTime()) / 3600000}
          accent="#6A7FA8">

          <Section icon="🥄" title="What to do">
            <Steps items={[
              { bold: 'Cover each dough box tightly', note: 'balls must not dry out during cold retard' },
              { bold: 'Stack in the fridge — back shelf', note: 'temperature consistency is critical' },
              { bold: 'Set your alarm for warmup time', note: schedule.rtWarmupStart ? formatTime(schedule.rtWarmupStart) : 'see schedule' },
            ]} />
          </Section>

          <Section icon="👁️" title="What to expect">
            <Bullets items={[
              'Balls will grow slightly in the fridge — 20-40% rise is normal',
              'Cold balls are firm and easy to handle — this is exactly what you want',
              'After 24h+ the balls will have relaxed gluten and will be extremely extensible when warm',
            ]} />
          </Section>

          <Section icon="⚠️" title="Pitfalls">
            <Bullets items={[
              'Over-retarding: balls that have risen more than 100% in the fridge are over-fermented — bake immediately when removed',
              'Cold balls that tear on stretching: need more warmup time — never stretch cold dough',
            ]} />
          </Section>
        </StepCard>
      )}

      {/* ── STEP: Final Proof (merged warmup + proof for cold-retard styles) */}
      {(schedule.finalProofHours > 0 || schedule.restRtHours > 0 || schedule.rtWarmupStart) && (
        <StepCard number={n()} icon={<IconProof />} title="Final Proof"
          time={schedule.rtWarmupStart ?? schedule.coldRetardEnd ?? schedule.finalProofStart}
          duration={(() => {
            const proofEnd = schedule.bakeStart;
            const proofStart = schedule.rtWarmupStart ?? schedule.coldRetardEnd ?? schedule.finalProofStart;
            if (!proofStart || !proofEnd) return schedule.finalProofHours;
            return Math.max(0, (proofEnd.getTime() - proofStart.getTime()) / 3600000);
          })()}
          accent="#7A8C6E">

          <Section icon="🥄" title="What to do">
            <Steps items={[
              ...(hasCold ? [
                { bold: 'Remove balls from fridge', note: 'keep covered — do not stretch yet, gluten is cold and tight' },
                { bold: `Rest ${kitchenTemp >= 30 ? '20–30' : kitchenTemp >= 26 ? '30–45' : '45–60'} min at room temperature`, note: 'warmup only — proofing begins naturally as dough relaxes' },
              ] : [
                ...(!isTwoPhase ? [{ bold: 'Shape dough balls', note: 'tuck and drag — taut skin' }] : [
                  { bold: 'Balls are already shaped', note: 'just monitor proofing' },
                ]),
              ]),
              { bold: 'Keep covered at room temperature', note: 'no heat source needed' },
              { bold: 'Start poke test after warmup — every 15–20 min', note: 'do not go by time — go by feel' },
              { bold: `Start preheating your oven ${hoursLabel(schedule.preheatStart ? (schedule.bakeStart.getTime() - schedule.preheatStart.getTime()) / 3600000 : 0.75)} before bake time`, note: 'oven heats while dough finishes proofing — they finish together' },
            ]} />
          </Section>

          <Section icon="👁️" title="Poke test — the three responses">
            <Bullets items={[
              'Springs back immediately, feels tight — needs more time',
              'Springs back slowly and partially — ready to bake',
              'Does not spring back, feels slack — over-proofed, bake immediately',
            ]} />
            <div style={{ marginTop: '.5rem' }}>
              <LearnLink term="poke_test" label="Full poke test guide" onOpen={setLearnTerm} />
            </div>
          </Section>

          <Section icon="⚠️" title="Pitfalls">
            <Bullets items={[
              'Stretching cold dough — wait for warmup, cold gluten tears',
              'Going by time instead of feel — always use the poke test',
              `Warm kitchen (${kitchenTemp}°C): proof can complete in ${kitchenTemp >= 30 ? '15–25 min' : kitchenTemp >= 26 ? '20–35 min' : '30–60 min'} after warmup — check early`,
              'Over-proofed balls collapse in the oven and lose oven spring',
            ]} />
          </Section>
        </StepCard>
      )}

      {/* ── STEP: Preheat Oven ───────────────────────── */}
      <StepCard number={n()} icon={<IconPreheat />} title="Preheat Oven"
        time={schedule.preheatStart} accent={D.gold}>

        <div style={{ fontSize: '.75rem', color: D.smoke, fontStyle: 'italic',
          fontFamily: 'var(--font-dm-sans)', padding: '.75rem 0 0' }}>
          Start preheating while dough finishes its final proof — they should be ready at the same time.
        </div>

        <Section icon="🥄" title="What to do">
          {isBread ? (
            <Steps items={ovenType === 'dutch_oven' ? [
              { bold: 'Place Dutch oven (with lid) inside your oven', note: 'both pot and lid must be scorching hot' },
              { bold: 'Set oven to 240–250°C with fan', note: 'full preheat — 45 min minimum' },
              { bold: 'Do not open the oven during preheat', note: 'every opening loses 20–30°C' },
            ] : ovenType === 'home_oven_stone_bread' ? [
              { bold: 'Place baking stone or steel on middle rack', note: 'stone needs 45–60 min to fully absorb heat' },
              { bold: 'Place an empty metal tray on the rack below', note: 'for steam — you will add ice cubes at load time' },
              { bold: 'Set oven to 240–250°C with fan', note: 'as hot as your oven allows' },
              { bold: 'Do not open the oven during preheat', note: 'every opening loses 20–30°C' },
            ] : ovenType === 'steam_oven' ? [
              { bold: 'Set steam oven to 240°C with 100% steam', note: 'steam programme for first phase' },
              { bold: 'Allow full preheat — 20–30 min', note: 'cavity must be fully saturated with steam' },
            ] : ovenType === 'wood_fired' ? [
              { bold: 'Build fire and let it burn to embers', note: 'aim for 280–320°C floor temperature' },
              { bold: 'Push embers to one side — test floor temp with a hand', note: '3 seconds before pulling away = ready' },
              { bold: 'Let temperature stabilise before loading', note: 'even heat is more important than peak heat' },
            ] : [
              // standard_bread fallback
              { bold: 'Set oven to 220–230°C with fan', note: 'max your oven allows' },
              { bold: 'Place an empty metal tray on the rack below', note: 'for steam — add ice cubes or boiling water at load time' },
              { bold: 'Do not open during preheat', note: 'every opening loses 20–30°C' },
            ]} />
          ) : ovenType === 'pizza_oven' ? (
            <Steps items={[
              { bold: 'Light the fire and build to a high flame', note: 'target 450–500°C floor temperature' },
              { bold: 'Push fire to back or side — let floor recover', note: 'floor temp drops when loading — give it time' },
              { bold: 'Check floor with infrared thermometer', note: 'never guess — launch only when floor is at temp' },
              { bold: 'Allow full 45 min — flame active throughout', note: 'stone must be saturated, not just surface-hot' },
            ]} />
          ) : ovenType === 'electric_pizza' ? (
            <Steps items={[
              { bold: 'Set both top and bottom elements to maximum', note: 'target 400°C+ — most models reach this in 20–25 min' },
              { bold: 'Do not open lid during preheat', note: 'electric ovens lose heat fast — keep closed until ready' },
              { bold: 'Check stone temp with infrared thermometer', note: 'stone should read 380°C+ before launching' },
            ]} />
          ) : ovenType === 'home_oven_steel' ? (
            <Steps items={[
              { bold: 'Place stone or steel on the top rack', note: 'close to the top element — top heat drives leoparding' },
              { bold: 'Set oven to maximum temperature with fan', note: 'typically 250–280°C — full 60 min preheat' },
              { bold: 'Switch to grill/broil for the last 10 min', note: 'supercharges the top element for better char' },
              { bold: 'Do not open during preheat', note: 'every opening loses 20–30°C' },
            ]} />
          ) : ovenType === 'home_oven_standard' ? (
            <Steps items={[
              { bold: 'Set oven to maximum temperature', note: 'typically 240–260°C — standard ovens lose heat quickly' },
              { bold: 'Preheat pizza tray or heavy baking sheet', note: 'place directly on middle rack — must be hot' },
              { bold: 'Allow 30 min minimum', note: 'thin trays heat fast but lose heat fast too — longer is better' },
            ]} />
          ) : (
            <Steps items={[
              { bold: 'Set oven to maximum temperature', note: 'as hot as it goes' },
              { bold: 'Preheat your baking surface fully', note: 'full preheat time is non-negotiable' },
              { bold: 'Do not open the oven during preheat', note: 'every opening loses 20–30°C' },
            ]} />
          )}
        </Section>

        <Section icon="⚠️" title="Pitfalls">
          <Bullets items={isBread ? (
            ovenType === 'dutch_oven' ? [
              'Skipping the lid: steam is what creates the ear and glossy crust — lid on for first 20 min is non-negotiable',
              'Cold Dutch oven: pot must be scorching hot or the bottom will not colour properly',
            ] : ovenType === 'home_oven_stone_bread' ? [
              'Cutting preheat short: stone needs 45–60 min of heat to absorb enough thermal mass',
              'Forgetting the steam tray: without steam the crust sets before oven spring finishes',
            ] : ovenType === 'steam_oven' ? [
              'Under-saturating the cavity: run full preheat with steam before loading',
              'Switching off steam too early: keep steam on for the full first 20 min',
            ] : ovenType === 'wood_fired' ? [
              'Loading on a hot floor: let it recover after clearing embers, or the bottom burns',
              'Uneven heat: rotate the loaf halfway through for even crust colour',
            ] : [
              'Forgetting steam: without it the crust sets too early — no ear, pale and tough',
              'Too low a temperature: standard ovens struggle — always use max',
            ]
          ) : ovenType === 'pizza_oven' ? [
            'Launching on a cold floor: always check with a thermometer — looks hot does not mean it is hot',
            'Flame too high at launch: push back the fire before loading or the top burns before the base is cooked',
            'Forgetting to rotate: wood-fired ovens have a hot side — turn the pizza every 20–30 seconds',
          ] : ovenType === 'electric_pizza' ? [
            'Not preheating long enough: stone needs 20–25 min even if the display says ready',
            'Opening lid mid-bake: electric ovens have a small cavity — every opening drops temp significantly',
            'Over-baking: at 400°C+ things move fast — stay close and watch the cornicione',
          ] : ovenType === 'home_oven_steel' ? [
            'Stone too low in the oven: top heat is what drives leoparding — use the top rack',
            'Skipping the pre-grill phase: 10 min on grill/broil before launch supercharges the top element',
            'Cutting preheat short: steel needs 45–60 min to absorb enough heat',
          ] : [
            'Thin baking tray: loses heat instantly at load — use the heaviest tray you have',
            'Not preheating the tray: cold tray = white soggy bottom',
            'Over-topping: heavy toppings prevent the base from cooking through',
          ]} />
        </Section>
      </StepCard>

      {/* ── STEP: Bake & Eat ─────────────────────────── */}
      <StepCard number={n()} icon={<IconBake />} title="Bake & Eat!" time={schedule.bakeStart} accent="#5A9A50">

        <Section icon="🥄" title="What to do">
          {isBread ? (
            ovenType === 'dutch_oven' ? (
              <Steps items={[
                { bold: 'Score the dough — single slash or cross', note: 'sharp lame or razor at 30–45° angle — confident single motion' },
                { bold: 'Lower dough into Dutch oven using parchment', note: 'work quickly — every second counts' },
                { bold: 'Bake covered at 240°C — 20 min', note: 'steam trapped inside creates the ear and oven spring' },
                { bold: 'Remove lid — bake 20–25 min more', note: 'crust browns and crisps — internal temp 95–98°C' },
                { bold: 'Cool on a wire rack — minimum 30 min', note: 'crumb is still cooking from residual heat — cutting hot makes it gummy' },
              ]} />
            ) : ovenType === 'home_oven_stone_bread' ? (
              <Steps items={[
                { bold: 'Score the dough', note: 'sharp lame, 30–45° angle, confident motion' },
                { bold: 'Add ice cubes to steam tray immediately', note: 'do this just before or just after loading — not before' },
                { bold: 'Load onto hot stone — close oven fast', note: 'confident single motion with a peel or parchment' },
                { bold: 'Bake 20 min with steam', note: 'do not open the door — steam must stay in' },
                { bold: 'Remove steam tray — bake 20–25 min more', note: 'crust browns and crisps — internal temp 95–98°C' },
                { bold: 'Cool on a wire rack — minimum 30 min', note: 'cutting hot makes the crumb gummy' },
              ]} />
            ) : ovenType === 'steam_oven' ? (
              <Steps items={[
                { bold: 'Score the dough', note: 'sharp lame, 30–45° angle' },
                { bold: 'Load into steam oven — 240°C, 100% steam', note: 'bake 20 min — steam does the work of a Dutch oven' },
                { bold: 'Switch to dry heat — 220°C', note: 'bake 20–25 min more until deep brown and hollow-sounding' },
                { bold: 'Cool on a wire rack — minimum 30 min', note: 'cutting hot makes the crumb gummy' },
              ]} />
            ) : ovenType === 'wood_fired' ? (
              <Steps items={[
                { bold: 'Score the dough', note: 'sharp lame, 30–45° angle' },
                { bold: 'Load using a long-handled peel', note: 'confident single forward motion — slide, do not push' },
                { bold: 'Close oven door or damper for first 15 min', note: 'retain steam from the dough — creates ear' },
                { bold: 'Rotate loaf halfway — bake until deep brown', note: 'total 40–50 min at 220–250°C — internal temp 95–98°C' },
                { bold: 'Cool on a wire rack — minimum 30 min', note: 'cutting hot makes the crumb gummy' },
              ]} />
            ) : (
              <Steps items={[
                { bold: 'Score the dough', note: 'sharp lame or razor, 30–45° angle' },
                { bold: 'Add boiling water or ice to steam tray, load quickly', note: 'close oven door immediately to keep steam in' },
                { bold: 'Bake 20 min — do not open door', note: 'steam keeps crust extensible for oven spring' },
                { bold: 'Remove steam tray — bake 20–25 min more', note: 'internal temp 95–98°C — deep brown crust' },
                { bold: 'Cool on a wire rack — minimum 30 min', note: 'cutting hot makes the crumb gummy' },
              ]} />
            )
          ) : ovenType === 'pizza_oven' ? (
            <Steps items={[
              { bold: 'Stretch dough to target size', note: 'no rolling pin — knuckles and gravity only' },
              { bold: 'Top quickly — sauce, cheese, minimal toppings', note: 'work fast — wet toppings stick the base to the peel' },
              { bold: 'Check floor temp one last time', note: 'launch only above 400°C floor — ideally 450–480°C' },
              { bold: 'Launch with a confident forward motion', note: 'hesitation causes sticking — one smooth push' },
              { bold: 'Rotate every 20–30 sec with a turning peel', note: 'wood fire has a hot side — constant rotation is key' },
              { bold: 'Total bake: 60–90 sec', note: 'leoparding on cornicione + slight char on base = done' },
            ]} />
          ) : ovenType === 'electric_pizza' ? (
            <Steps items={[
              { bold: 'Stretch dough to target size', note: 'no rolling pin — electric ovens are forgiving but thin bases still benefit from hand stretching' },
              { bold: 'Top and launch onto hot stone', note: 'flour or fine semolina on peel — work quickly' },
              { bold: 'Close lid immediately', note: 'electric ovens have small cavities — heat escapes fast' },
              { bold: 'Bake 3–5 min at 400°C+', note: 'watch the cornicione — colour goes from pale to brown fast' },
              { bold: 'Rotate halfway for even colour', note: 'electric elements can have hot spots near the edges' },
            ]} />
          ) : ovenType === 'home_oven_steel' ? (
            <Steps items={[
              { bold: 'Stretch dough on a floured peel', note: 'semolina or flour — not too much or the base will be dusty' },
              { bold: 'Top quickly and launch onto hot stone', note: 'confident single forward motion — hesitation causes sticking' },
              { bold: 'Switch to grill/broil immediately after launch', note: 'top heat is what drives leoparding in a home oven' },
              { bold: 'Bake 5–7 min', note: 'watch the cheese and cornicione — grill moves fast' },
              { bold: 'Check base with a palette knife or spatula', note: 'should be golden with some colour, not white' },
            ]} />
          ) : ovenType === 'home_oven_standard' ? (
            <Steps items={[
              { bold: 'Stretch dough on a floured surface', note: 'thicker styles work best here — Detroit, pan, Roman' },
              { bold: 'Top generously — standard ovens suit loaded styles', note: 'toppings help retain moisture and colour evenly' },
              { bold: 'Place on preheated tray — bake at max temperature', note: '8–15 min depending on thickness' },
              { bold: 'Rotate halfway through', note: 'all home ovens have hot spots near the element' },
              { bold: 'Check base: lift edge with a spatula', note: 'base should be golden and set, not white or soft' },
            ]} />
          ) : (
            <Steps items={[
              { bold: 'Stretch or shape dough', note: 'use your preferred method' },
              { bold: 'Top and bake at maximum temperature', note: 'time depends on oven and thickness' },
              { bold: 'Rotate halfway for even bake', note: 'all ovens have hot spots' },
            ]} />
          )}
        </Section>

        <Section icon="👁️" title="Watch for">
          {isBread ? (
            <Bullets items={[
              'Oven spring: bread grows noticeably in first 10 min — this is the yeast\'s last burst',
              'Ear: the scoring line opens up and creates a defined ridge — sign of good fermentation and steam',
              'Colour: deep mahogany brown — pale bread is under-baked regardless of time',
              'Hollow sound: tap the bottom — should sound hollow when fully baked',
            ]} />
          ) : ovenType === 'pizza_oven' ? (
            <Bullets items={[
              'Leoparding: dark spots on the cornicione — sign of proper fermentation and high heat',
              'Puffing: dough bubbles up in the centre — normal and desirable for Neapolitan',
              'Base colour: golden with some dark spots — check with turning peel',
              'Cheese: melted and slightly golden at edges — not bubbling brown',
            ]} />
          ) : ovenType === 'electric_pizza' ? (
            <Bullets items={[
              'Cornicione: starts pale, then yellows, then browns — pull when it starts showing spots',
              'Base: check by lifting edge — should be golden brown with some colour',
              'Speed: at 400°C things move fast — do not walk away',
            ]} />
          ) : ovenType === 'home_oven_steel' ? (
            <Bullets items={[
              'Top colour from the grill: cornicione should show dark spots within 5–7 min',
              'Base: lift with a spatula — golden and firm, not pale or soft',
              'Cheese: bubbling and golden — if cheese is done but cornicione is pale, flash it under grill',
            ]} />
          ) : (
            <Bullets items={[
              'Base: lift edge with a spatula — should be golden and set',
              'Cheese: melted and beginning to colour at edges',
              'Crust: golden and puffed at the rim — pale crust means more time or higher heat needed',
            ]} />
          )}
        </Section>

        <Section icon="⚠️" title="Pitfalls">
          <Bullets items={isBread ? [
            'Scoring too shallow: less than 0.5cm — won\'t open properly, creates side blowouts',
            ovenType === 'dutch_oven'
              ? 'Removing lid too early: steam needs the full 20 min to form the ear — patience'
              : ovenType === 'home_oven_stone_bread' || ovenType === 'standard_bread'
              ? 'Opening the oven in the first 20 min: steam escapes, crust sets too early, no ear'
              : 'Not managing steam in the first phase: ear and oven spring both depend on it',
            'Cutting bread hot: steam still inside — crumb will be gummy and dense',
          ] : ovenType === 'pizza_oven' ? [
            'Cold floor at launch: always check with a thermometer — looks hot is not enough',
            'Flame too close: push fire back before launching or the top burns before the base is done',
            'Not rotating: wood-fired ovens have a hot side — rotate every 20–30 sec or expect uneven char',
          ] : ovenType === 'electric_pizza' ? [
            'Opening lid mid-bake: small cavity loses heat very quickly',
            'Under-preheating: stone needs 20–25 min — do not trust the oven\'s ready indicator alone',
            'Thick bases: electric pizza ovens suit thin Neapolitan and NY — thicker styles may under-bake the base',
          ] : ovenType === 'home_oven_steel' ? [
            'Skipping the grill/broil phase: top heat is what drives leoparding — without it the pizza looks pale',
            'Stone too low: must be on the top rack to get close to the top element',
            'Cutting preheat short: steel needs 45–60 min to absorb enough thermal mass',
          ] : [
            'Cold tray: must be preheated or the base will be pale and soft',
            'Over-topping: too many wet toppings prevent the base from cooking through',
            'Low temperature: always use the highest temperature your oven reaches',
          ]} />
        </Section>

        {isBread && (
          <Section icon="🎓" title="Learn more">
            <ExtLink href="https://www.theperfectloaf.com/guides/how-to-score-bread-dough/" label="Scoring technique guide" />
          </Section>
        )}
      </StepCard>

      {learnTerm && <LearnModal term={learnTerm} onClose={() => setLearnTerm(null)} />}
    </div>
  );
}
