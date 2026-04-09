'use client';
import { useState } from 'react';
import { type ScheduleResult, formatTime, hoursLabel } from '../utils';
import { MIXER_TYPES, type MixerType } from '../data';
import LearnModal from './LearnModal';

interface BakeGuideProps {
  schedule: ScheduleResult;
  mixerType: MixerType;
  styleKey: string;
  kitchenTemp: number;
  numItems: number;
  prefermentType?: string;
  oil: number;
  hydration: number;
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
  number: number; icon: string; title: string;
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
        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{icon}</span>
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
  prefermentType, oil, hydration, prefStartTime, feedTime,
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
        <StepCard number={n()} icon={isPoolish ? '🏺' : '🧱'}
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
        <StepCard number={n()} icon="🫙" title="Feed your starter" time={feedTime} accent="#6A7FA8">
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
      <StepCard number={n()} icon="🤲" title="Mix your dough"
        time={schedule.bulkFermStart} duration={schedule.mixingDurationH} accent={D.ash}>

        <Section icon="🥄" title="Mixing order">
          {mixerType === 'hand' && !isSourdough && (
            <Steps items={[
              { bold: 'Flour + 90% of your water', note: 'mix until no dry flour — ~2 min' },
              { bold: 'Cover and rest 20 min', note: 'autolyse — gluten forms without kneading' },
              { bold: 'Add yeast', note: 'mix to combine — 2 min' },
              { bold: 'Add salt', note: 'mix until absorbed — 2 min' },
              ...(hydration > 70 ? [{ bold: 'Add remaining 10% water gradually', note: 'bassinage — wait for absorption between additions' }] : []),
              ...(hasPref ? [{ bold: `Add your ${prefermentType} (all of it)`, note: 'mix until fully incorporated' }] : []),
              ...(oil > 0 ? [{ bold: 'Add oil last', note: 'mix 1 min — oil added late preserves gluten' }] : []),
              { bold: 'Knead 8-12 min until smooth and elastic', note: 'passes windowpane test' },
            ]} />
          )}
          {mixerType === 'stand' && !isSourdough && (
            <Steps items={[
              { bold: 'Flour + 90% of water', note: 'Speed 1, 2 min to combine' },
              ...(hasPref ? [{ bold: `Add ${prefermentType}`, note: 'Speed 1, mix until incorporated' }] : []),
              { bold: 'Add yeast', note: 'Speed 1, 2 min' },
              { bold: 'Add salt', note: 'Speed 1, 2 min until absorbed' },
              { bold: 'Speed 2 — 6-10 min', note: 'until dough clears the bowl — passes windowpane test' },
              ...(hydration > 70 ? [{ bold: 'Add remaining water at Speed 2', note: 'slowly — bassinage' }] : []),
              ...(oil > 0 ? [{ bold: 'Add oil last', note: 'Speed 1, 1 min' }] : []),
            ]} />
          )}
          {mixerType === 'spiral' && !isSourdough && (
            <>
              <Steps items={[
                { bold: 'Flour + 90% water + yeast', note: 'Speed 1, 3 min to combine' },
                ...(hasPref ? [{ bold: `Add ${prefermentType}`, note: 'Speed 1, mix until incorporated' }] : []),
                { bold: 'Add salt', note: 'Speed 1, 2 min' },
                { bold: 'Speed 2 until pumpkin shape forms', note: 'typically 10-15 min — stop if FDT exceeds 28°C' },
                ...(hydration > 70 ? [{ bold: 'Add remaining water gradually once pumpkin is stable', note: 'wait for pumpkin to reform after each addition' }] : []),
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
            {isSpiral && <LearnLink term="pumpkin" label="Pumpkin shape" onOpen={setLearnTerm} />}
            {hydration > 70 && <LearnLink term="bassinage" label="Bassinage technique" onOpen={setLearnTerm} />}
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
      <StepCard number={n()} icon="🌡️" title="Bulk Fermentation"
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
        <StepCard number={n()} icon="❄️"
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
        <StepCard number={n()} icon="⚖️" title="Divide & Ball"
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
        <StepCard number={n()} icon="❄️" title="Cold Retard — Balls"
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
        <StepCard number={n()} icon="⏰" title="Final Proof"
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
      <StepCard number={n()} icon="🔥" title="Preheat Oven"
        time={schedule.preheatStart} accent={D.gold}>

        <div style={{ fontSize: '.75rem', color: D.smoke, fontStyle: 'italic',
          fontFamily: 'var(--font-dm-sans)', padding: '.75rem 0 0' }}>
          Start preheating while dough finishes its final proof — they should be ready at the same time.
        </div>

        <Section icon="🥄" title="What to do">
          <Steps items={[
            { bold: 'Set oven to maximum temperature', note: isBread ? '230-250°C with fan' : 'as hot as it goes — 300°C+ for pizza' },
            ...(!isBread ? [
              { bold: 'Place baking stone or steel on top rack', note: 'must be fully saturated with heat — full preheat time is non-negotiable' },
            ] : [
              { bold: 'Place Dutch oven or baking stone inside', note: 'must be scorching hot when bread goes in' },
              { bold: 'If using Dutch oven: place lid on too', note: 'traps steam — creates ear and open crumb' },
            ]),
            { bold: 'Do not open the oven during preheat', note: 'every opening loses 20-30°C' },
          ]} />
        </Section>

        <Section icon="⚠️" title="Pitfalls">
          <Bullets items={[
            'Cutting preheat short — a baking stone needs 45-60 min to fully absorb heat, not just the air temperature indicator',
            isBread ? 'Skipping the Dutch oven lid: steam is what creates the ear and glossy crust' : 'Stone too low in the oven — top heat is important for leoparding',
          ]} />
        </Section>
      </StepCard>

      {/* ── STEP: Bake & Eat ─────────────────────────── */}
      <StepCard number={n()} icon="🍕" title="Bake & Eat!" time={schedule.bakeStart} accent="#5A9A50">

        <Section icon="🥄" title="What to do">
          {isBread ? (
            <Steps items={[
              { bold: 'Score the dough — single slash or cross', note: 'use a sharp lame or razor at 30-45° angle — confident single motion' },
              { bold: 'Load into Dutch oven or onto stone', note: 'work quickly — don\'t let heat escape' },
              { bold: isBread ? 'Bake covered 20 min (Dutch oven)' : 'Bake with steam for first 15 min', note: 'steam keeps crust soft for oven spring' },
              { bold: 'Remove lid — bake 20-25 min more', note: 'crust browns and crisps — internal temp 95-98°C' },
              { bold: 'Cool on a wire rack — minimum 30 min', note: 'crumb is still cooking from residual heat — cutting too early makes it gummy' },
            ]} />
          ) : isNeapolitan ? (
            <Steps items={[
              { bold: 'Stretch dough to 30-32cm', note: 'no rolling pin — use knuckles, let gravity do the work' },
              { bold: 'Top quickly — sauce + cheese only', note: 'heavy toppings sink a Neapolitan — less is more' },
              { bold: 'Launch onto hot stone', note: 'confident single motion — hesitation causes sticking' },
              { bold: 'Bake 60-90 sec at 450°C+ (pizza oven)', note: 'or 5-7 min at oven max — watch for leoparding on cornicione' },
              { bold: 'Rotate halfway for even char', note: 'use a turning peel or tongs' },
            ]} />
          ) : (
            <Steps items={[
              { bold: 'Stretch or roll dough to target size', note: 'use your preferred method' },
              { bold: 'Top and launch onto stone', note: 'flour or semolina on peel prevents sticking' },
              { bold: 'Bake until crust is golden and cheese is bubbling', note: '8-15 min depending on oven temperature' },
              { bold: 'Rotate halfway through for even bake', note: 'all home ovens have hot spots' },
            ]} />
          )}
        </Section>

        <Section icon="👁️" title="Watch for">
          {isBread ? (
            <Bullets items={[
              'Oven spring: bread grows noticeably in first 10 min — this is the yeast\'s last burst',
              'Ear: the scoring line opens up and creates a defined ridge — sign of good fermentation',
              'Colour: deep mahogany brown — pale bread is under-baked',
              'Hollow sound: tap the bottom — should sound hollow when fully baked',
            ]} />
          ) : (
            <Bullets items={[
              'Leoparding: dark spots on the cornicione (edge) — sign of proper fermentation and high heat',
              'Bubbling: dough puffs up in spots — perfectly normal for Neapolitan',
              'Cheese: melted and slightly golden at edges',
              'Bottom: check with a turning peel — should be golden, not white',
            ]} />
          )}
        </Section>

        <Section icon="⚠️" title="Pitfalls">
          <Bullets items={isBread ? [
            'Scoring too shallow: <0.5cm — won\'t open properly, creates blowouts on the side',
            'Opening oven door in first 15 min: steam escapes, crust sets too early, no ear',
            'Cutting bread hot: steam still inside, crumb will be gummy',
          ] : [
            'Over-topping: too many toppings = soggy centre, can\'t get proper char',
            'Pizza sticking to peel: use enough flour/semolina, work quickly after topping',
            'Pale bottom: stone wasn\'t hot enough — longer preheat next time',
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
