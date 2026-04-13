'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { type ScheduleResult, formatTime, hoursLabel } from '../utils';
import { MIXER_TYPES, type MixerType } from '../data';
import LearnModal from './LearnModal';
import { IconPreferment, IconStarter, IconMix, IconBulk, IconCold, IconDivide, IconProof, IconPreheat, IconBake } from './StepIcons';
import { type UnitSystem, displayTemp, tempC, tempRange } from '../utils/units';

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
  units?: UnitSystem;
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
  return null;
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
  prefermentType, oil, hydration, ovenType, prefStartTime, feedTime, units,
}: BakeGuideProps) {
  const u = units ?? 'metric';
  const [learnTerm, setLearnTerm] = useState<string | null>(null);
  const t = useTranslations('bakeGuide');

  const isSourdough   = styleKey === 'sourdough' || styleKey === 'pain_levain';
  const isBread       = ['pain_campagne','pain_levain','baguette','pain_complet','pain_seigle','fougasse','brioche','pain_mie','pain_viennois','sourdough'].includes(styleKey);
  const isNeapolitan  = styleKey === 'neapolitan';
  const isFougasse    = styleKey === 'fougasse';
  const isBaguette    = styleKey === 'baguette';
  const isLoafTin     = ['brioche','pain_mie','pain_viennois','pain_seigle'].includes(styleKey);
  const isBoule       = ['pain_campagne','pain_levain','sourdough','pain_complet'].includes(styleKey);
  // Shaping label: what we call the shaped piece
  const breadPieceLabel = isFougasse ? 'piece' : isBaguette ? 'baguette' : isLoafTin ? 'loaf' : 'loaf';
  const breadPiecePlural = numItems === 1 ? breadPieceLabel : (isBaguette ? 'baguettes' : isLoafTin ? 'loaves' : 'loaves');
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
          title={isPoolish ? t('stepTitles.makePoolish') : t('stepTitles.makeBiga')}
          time={prefStartTime} accent={D.gold}>

          <Section icon="🥄" title={t('sectionTitles.whatToDo')}>
            {isPoolish ? (
              <Steps items={t.raw(kitchenTemp >= 26 ? 'poolish.stepsFridge' : 'poolish.stepsRT') as { bold: string; note: string }[]} />
            ) : (
              <Steps items={t.raw('biga.steps') as { bold: string; note: string }[]} />
            )}
          </Section>

          <Section icon="👁️" title={t('sectionTitles.watchForReady')}>
            <Bullets items={t.raw(isPoolish ? 'poolish.readyWhen' : 'biga.readyWhen') as string[]} />
          </Section>

          <Section icon="⚠️" title={t('sectionTitles.pitfalls')}>
            <Bullets items={t.raw(isPoolish ? 'poolish.pitfalls' : 'biga.pitfalls') as string[]} />
          </Section>
        </StepCard>
      )}

      {/* ── STEP: Feed Starter (sourdough) ──────────── */}
      {isSourdough && feedTime && (
        <StepCard number={n()} icon={<IconStarter />} title={t('stepTitles.feedStarter')} time={feedTime} accent="#6A7FA8">
          <Section icon="🥄" title={t('sectionTitles.whatToDo')}>
            <Steps items={t.raw('starter.steps') as { bold: string; note: string }[]} />
          </Section>
          <Section icon="👁️" title={t('sectionTitles.readyWhen')}>
            <Bullets items={[
              `Doubled in size — at ${displayTemp(kitchenTemp, u)} expect ${kitchenTemp >= 28 ? '3-5h' : kitchenTemp >= 24 ? '4-7h' : '6-10h'}`,
              ...(t.raw('starter.readyWhen') as string[]),
            ]} />
          </Section>
          <Section icon="⚠️" title={t('sectionTitles.pitfalls')}>
            <Bullets items={t.raw('starter.pitfalls') as string[]} />
          </Section>
        </StepCard>
      )}

      {/* ── STEP: Mix Dough ─────────────────────────── */}
      <StepCard number={n()} icon={<IconMix />} title={t('stepTitles.mixDough')}
        time={schedule.bulkFermStart} duration={schedule.mixingDurationH} accent={D.ash}>

        <Section icon="🥄" title={t('sectionTitles.mixingOrder')}>
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
                { bold: 'Speed 2 until pumpkin shape forms', note: `typically 10–15 min — stop if FDT exceeds ${tempC(28, u)}` },
                { bold: 'Once pumpkin is stable — add remaining 10% water gradually', note: 'bassinage — small additions, wait for pumpkin to reform each time' },
                ...(oil > 0 ? [{ bold: 'Add oil last', note: 'Speed 1, 1 min' }] : []),
              ] : [
                // ≤70%: remaining water before Speed 2
                { bold: 'Flour + 90% water + yeast', note: 'Speed 1, 3 min to combine' },
                ...(hasPref ? [{ bold: `Add ${prefermentType}`, note: 'Speed 1, mix until incorporated' }] : []),
                { bold: 'Add salt', note: 'Speed 1, 2 min' },
                { bold: 'Add remaining 10% water', note: 'Speed 1, mix until absorbed — ~1 min' },
                { bold: 'Speed 2 until pumpkin shape forms', note: `typically 10–15 min — stop if FDT exceeds ${tempC(28, u)}` },
                ...(oil > 0 ? [{ bold: 'Add oil last', note: 'Speed 1, 1 min' }] : []),
              ]} />
              <div style={{ marginTop: '.75rem' }}>
                <ExtLink href="https://www.theperfectloaf.com/how-to-mix-bread-and-pizza-dough-with-a-ooni-halo-pro-spiral-mixer/" label="See pumpkin shape photos →" />
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

        <Section icon="🌡️" title={t('sectionTitles.waterTemp')}>
          <Bullets items={[
            `Target Final Dough Temperature (FDT): ${isNeapolitan ? tempC(23, u) : tempC(24, u)}`,
            ...(t.raw('mix.waterTempBullets') as string[]),
            `FDT above ${tempC(28, u)}: refrigerate dough for 15 min before bulk fermentation`,
          ]} />
          <div style={{ marginTop: '.5rem' }}>
            <LearnLink term="fdt" label="What is FDT?" onOpen={setLearnTerm} />
          </div>
        </Section>

        <Section icon="👁️" title={t('sectionTitles.watchFor')}>
          <Bullets items={[
            mixerType === 'spiral'
              ? t('mix.watchForPumpkin')
              : t('mix.watchForSmooth'),
            ...(t.raw('mix.watchForAll') as string[]),
          ]} />
          <div style={{ marginTop: '.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <LearnLink term="windowpane" label="Windowpane test" onOpen={setLearnTerm} />
            {mixerType === 'hand' && !isSourdough && <LearnLink term="autolyse" label="Autolyse" onOpen={setLearnTerm} />}
            {isSpiral && <LearnLink term="pumpkin" label="Pumpkin shape" onOpen={setLearnTerm} />}
            {hydration > 70 && <LearnLink term="bassinage" label="Bassinage" onOpen={setLearnTerm} />}
          </div>
        </Section>

        <Section icon="⚠️" title={t('sectionTitles.pitfalls')}>
          <Bullets items={[
            ...(t.raw('mix.pitfalls') as string[]).slice(0, 2),
            isSpiral ? `Ignoring FDT — spiral mixers generate heat, dough can exceed ${tempC(28, u)} without noticing` : '',
            (t.raw('mix.pitfalls') as string[])[2],
          ].filter(Boolean)} />
        </Section>
      </StepCard>

      {/* ── STEP: Bulk Fermentation ──────────────────── */}
      <StepCard number={n()} icon={<IconBulk />} title={t('stepTitles.bulkFerm')}
        time={schedule.bulkFermStart} duration={schedule.bulkFermHours} accent={D.terra}>

        <Section icon="🥄" title={t('sectionTitles.whatToDo')}>
          <Steps items={[
            ...(t.raw('bulk.stepsBase') as { bold: string; note: string }[]),
            ...(schedule.bulkFermHours >= 1.5 ? [
              t.raw('bulk.set1') as { bold: string; note: string },
              t.raw('bulk.set2') as { bold: string; note: string },
              ...(schedule.bulkFermHours >= 2 ? [
                t.raw('bulk.set3') as { bold: string; note: string },
                t.raw('bulk.set4') as { bold: string; note: string },
              ] : []),
            ] : schedule.bulkFermHours >= 0.5 ? [
              t.raw('bulk.setShort') as { bold: string; note: string },
            ] : [
              t.raw('bulk.setVeryShort') as { bold: string; note: string },
            ]),
          ]} />
        </Section>

        <Section icon="👁️" title="Watch for — bulk is done when">
          <Bullets items={t.raw('bulk.watchFor') as string[]} />
          <div style={{ marginTop: '.5rem' }}>
            <LearnLink term="bulk_fermentation" label="Bulk fermentation guide" onOpen={setLearnTerm} />
          </div>
        </Section>

        <Section icon="⚠️" title={t('sectionTitles.pitfalls')}>
          <Bullets items={[
            ...(hydration >= 70 ? [
              oil > 0
                ? `Enriched dough at ${hydration}%: use lightly oiled hands for stretch & folds — fat in the dough means oil is a better barrier than water`
                : hydration >= 75
                ? `At ${hydration}% hydration, sticky is expected — keep a bowl of water nearby and wet your hands before every fold. Never add flour to the bench. Quick, confident movements stick less than slow hesitant ones.`
                : `Wet hands for stretch & folds — dip your hands in water before each set. Avoids sticking without altering hydration like bench flour would.`,
            ] : []),
            `Bulk in a warm spot above ${tempC(26, u)} — dough ferments too fast, less flavour`,
            ...(t.raw('bulk.pitfallsBase') as string[]),
          ]} />
        </Section>
      </StepCard>

      {/* ── STEP: Cold Retard 1 ──────────────────────── */}
      {hasCold && schedule.coldRetard1Start && schedule.coldRetard1End && (
        <StepCard number={n()} icon={<IconCold />}
          title={isTwoPhase ? t('stepTitles.coldRetardWhole') : t('stepTitles.coldRetard')}
          time={schedule.coldRetard1Start}
          duration={(schedule.coldRetard1End.getTime() - schedule.coldRetard1Start.getTime()) / 3600000}
          accent="#6A7FA8">

          <Section icon="🥄" title={t('sectionTitles.whatToDo')}>
            <Steps items={[
              ...(t.raw('coldRetard.steps') as { bold: string; note: string }[]).slice(0, 2),
              { bold: 'Set your alarm for Divide & Ball time', note: formatTime(schedule.divideBallTime ?? schedule.coldRetard1End) },
              (t.raw('coldRetard.steps') as { bold: string; note: string }[])[2],
            ]} />
          </Section>

          <Section icon="👁️" title={t('sectionTitles.whatToExpect')}>
            <Bullets items={t.raw('coldRetard.watchFor') as string[]} />
          </Section>

          <Section icon="⚠️" title={t('sectionTitles.pitfalls')}>
            <Bullets items={[
              (t.raw('coldRetard.pitfalls') as string[])[0],
              `Fridge temperature above ${tempC(8, u)}: dough over-ferments during retard — check your fridge`,
              (t.raw('coldRetard.pitfalls') as string[])[1],
            ]} />
          </Section>
        </StepCard>
      )}

      {/* ── STEP: Divide & Shape (bread) / Divide & Ball (pizza) ── */}
      {schedule.divideBallTime && (
        <StepCard number={n()} icon={<IconDivide />}
          title={isBread ? t('stepTitles.divideShape') : t('stepTitles.divideBall')}
          time={schedule.divideBallTime} duration={divideMin / 60} accent="#8A6A4A">

          <Section icon="🥄" title={t('sectionTitles.whatToDo')}>
            {isBread ? (
              <Steps items={isFougasse ? [
                { bold: `Divide into ${numItems} equal ${breadPiecePlural}`, note: (t.raw('divide.fougasse.steps') as { bold: string; note: string }[])[0].note },
                ...(t.raw('divide.fougasse.steps') as { bold: string; note: string }[]).slice(1),
              ] : isBaguette ? [
                { bold: `Divide into ${numItems} equal pieces`, note: (t.raw('divide.baguette.steps') as { bold: string; note: string }[])[0].note },
                ...(t.raw('divide.baguette.steps') as { bold: string; note: string }[]).slice(1),
                ...(isTwoPhase ? [t.raw('divide.coverCold') as { bold: string; note: string }] : [t.raw('divide.coverRT') as { bold: string; note: string }]),
              ] : isLoafTin ? [
                { bold: `Divide into ${numItems} equal pieces`, note: (t.raw('divide.loafTin.steps') as { bold: string; note: string }[])[0].note },
                ...(t.raw('divide.loafTin.steps') as { bold: string; note: string }[]).slice(1),
                ...(isTwoPhase ? [t.raw('divide.coverCold') as { bold: string; note: string }] : [t.raw('divide.coverRT') as { bold: string; note: string }]),
              ] : [
                // Boule / pain campagne / pain levain / sourdough
                { bold: `Divide into ${numItems} equal pieces`, note: (t.raw('divide.boule.steps') as { bold: string; note: string }[])[0].note },
                ...(t.raw('divide.boule.steps') as { bold: string; note: string }[]).slice(1),
                ...(isTwoPhase ? [t.raw('divide.coverCold') as { bold: string; note: string }] : [t.raw('divide.coverRT') as { bold: string; note: string }]),
              ]} />
            ) : (
              <Steps items={[
                { bold: `Weigh dough and divide into ${numItems} equal pieces`, note: (t.raw('divide.pizza.steps') as { bold: string; note: string }[])[0].note },
                ...(t.raw('divide.pizza.steps') as { bold: string; note: string }[]).slice(1),
                ...(isTwoPhase ? [t.raw('divide.coverCold') as { bold: string; note: string }] : [t.raw('divide.coverRT') as { bold: string; note: string }]),
              ]} />
            )}
          </Section>

          <Section icon="👁️" title={isBread ? t('sectionTitles.watchFor') : t('sectionTitles.watchForBall')}>
            <Bullets items={isFougasse
              ? (t.raw('divide.fougasse.watchFor') as string[])
              : isBaguette
              ? (t.raw('divide.baguette.watchFor') as string[])
              : isLoafTin
              ? (t.raw('divide.loafTin.watchFor') as string[])
              : isBread
              ? (t.raw('divide.boule.watchFor') as string[])
              : [
                ...(t.raw('divide.pizza.watchFor') as string[]),
                `At ${displayTemp(kitchenTemp, u)}, work within ${kitchenTemp >= 30 ? '15 min' : kitchenTemp >= 26 ? '20 min' : '30 min'} — warm kitchens make balls proof quickly`,
              ]
            } />
          </Section>

          <Section icon="⚠️" title={t('sectionTitles.pitfalls')}>
            <Bullets items={isFougasse
              ? (t.raw('divide.fougasse.pitfalls') as string[])
              : isBaguette
              ? (t.raw('divide.baguette.pitfalls') as string[])
              : isLoafTin
              ? (t.raw('divide.loafTin.pitfalls') as string[])
              : isBread ? [
                ...(hydration >= 70 ? [
                  oil > 0
                    ? `Enriched dough at ${hydration}%: use lightly oiled hands for shaping — fat in the dough means oil is a better barrier than water`
                    : hydration >= 75
                    ? `At ${hydration}% hydration, sticky is normal. Keep a bowl of water nearby and wet your hands before handling — never use bench flour. Use a bench scraper to lift pieces. Move quickly and with confidence.`
                    : `Wet hands prevent sticking at this hydration. Keep a small bowl of water nearby and dip your hands before each touch. Avoid bench flour — it hydrates instantly and makes things worse.`,
                ] : []),
                ...(t.raw('divide.boule.pitfalls') as string[]),
              ] : [
                ...(t.raw('divide.pizza.pitfalls') as string[]),
                `Hot kitchen (${kitchenTemp >= 30 ? 'like yours at ' + displayTemp(kitchenTemp, u) : '≥' + tempC(30, u)}): get balls into their boxes fast — they proof very quickly at warm temps`,
              ]
            } />
          </Section>
        </StepCard>
      )}

      {/* ── STEP: Cold Retard 2 (two-phase) ─────────── */}
      {isTwoPhase && schedule.coldRetard2Start && schedule.coldRetard2End &&
        (schedule.coldRetard2End.getTime() - schedule.coldRetard2Start.getTime()) > 0 && (
        <StepCard number={n()} icon={<IconCold />}
          title={isBread ? t('stepTitles.coldProof') : t('stepTitles.coldRetardBalls')}
          time={schedule.coldRetard2Start}
          duration={(schedule.coldRetard2End.getTime() - schedule.coldRetard2Start.getTime()) / 3600000}
          accent="#6A7FA8">

          <Section icon="🥄" title={t('sectionTitles.whatToDo')}>
            <Steps items={[
              ...(t.raw('coldBalls.steps') as { bold: string; note: string }[]),
              { bold: 'Set your alarm for warmup time', note: schedule.rtWarmupStart ? formatTime(schedule.rtWarmupStart) : 'see schedule' },
            ]} />
          </Section>

          <Section icon="👁️" title={t('sectionTitles.whatToExpect')}>
            <Bullets items={t.raw('coldBalls.watchFor') as string[]} />
          </Section>

          <Section icon="⚠️" title={t('sectionTitles.pitfalls')}>
            <Bullets items={t.raw('coldBalls.pitfalls') as string[]} />
          </Section>
        </StepCard>
      )}

      {/* ── STEP: Final Proof (merged warmup + proof for cold-retard styles) */}
      {(schedule.finalProofHours > 0 || schedule.restRtHours > 0 || schedule.rtWarmupStart) && (
        <StepCard number={n()} icon={<IconProof />} title={t('stepTitles.finalProof')}
          time={schedule.rtWarmupStart ?? schedule.coldRetardEnd ?? schedule.finalProofStart}
          duration={(() => {
            const proofEnd = schedule.bakeStart;
            const proofStart = schedule.rtWarmupStart ?? schedule.coldRetardEnd ?? schedule.finalProofStart;
            if (!proofStart || !proofEnd) return schedule.finalProofHours;
            return Math.max(0, (proofEnd.getTime() - proofStart.getTime()) / 3600000);
          })()}
          accent="#7A8C6E">

          <Section icon="🥄" title={t('sectionTitles.whatToDo')}>
            <Steps items={[
              ...(hasCold ? [
                t.raw('finalProof.removeFridge') as { bold: string; note: string },
                { bold: `Rest ${kitchenTemp >= 30 ? '20–30' : kitchenTemp >= 26 ? '30–45' : '45–60'} min at room temperature`, note: 'warmup only — proofing begins naturally as dough relaxes' },
              ] : [
                ...(!isTwoPhase ? [t.raw('finalProof.shapeBalls') as { bold: string; note: string }] : [
                  t.raw('finalProof.alreadyShaped') as { bold: string; note: string },
                ]),
              ]),
              t.raw('finalProof.keepCovered') as { bold: string; note: string },
              t.raw('finalProof.pokeTest') as { bold: string; note: string },
              { bold: `Start preheating your oven ${hoursLabel(schedule.preheatStart ? (schedule.bakeStart.getTime() - schedule.preheatStart.getTime()) / 3600000 : 0.75)} before bake time`, note: 'oven heats while dough finishes proofing — they finish together' },
            ]} />
          </Section>

          <Section icon="👁️" title={t('sectionTitles.pokeTest')}>
            <Bullets items={t.raw('finalProof.pokeResponses') as string[]} />
            <div style={{ marginTop: '.5rem' }}>
              <LearnLink term="poke_test" label="Full poke test guide" onOpen={setLearnTerm} />
            </div>
          </Section>

          <Section icon="⚠️" title={t('sectionTitles.pitfalls')}>
            <Bullets items={[
              (t.raw('finalProof.pitfalls') as string[])[0],
              (t.raw('finalProof.pitfalls') as string[])[1],
              `Warm kitchen (${displayTemp(kitchenTemp, u)}): proof can complete in ${kitchenTemp >= 30 ? '15–25 min' : kitchenTemp >= 26 ? '20–35 min' : '30–60 min'} after warmup — check early`,
              (t.raw('finalProof.pitfalls') as string[])[2],
            ]} />
          </Section>
        </StepCard>
      )}

      {/* ── STEP: Preheat Oven ───────────────────────── */}
      <StepCard number={n()} icon={<IconPreheat />} title={t('stepTitles.preheatOven')}
        time={schedule.preheatStart} accent={D.gold}>

        <div style={{ fontSize: '.75rem', color: D.smoke, fontStyle: 'italic',
          fontFamily: 'var(--font-dm-sans)', padding: '.75rem 0 0' }}>
          {t('preheatNote')}
        </div>

        <Section icon="🥄" title={t('sectionTitles.whatToDo')}>
          {isBread ? (
            <Steps items={(t.raw(
              ovenType === 'dutch_oven' ? 'preheat.dutch.steps' :
              ovenType === 'home_oven_stone_bread' ? 'preheat.stoneBread.steps' :
              ovenType === 'steam_oven' ? 'preheat.steam.steps' :
              ovenType === 'wood_fired' ? 'preheat.woodBread.steps' :
              'preheat.standardBread.steps'
            ) as { bold: string; note: string }[])} />
          ) : ovenType === 'pizza_oven' ? (
            <Steps items={t.raw('preheat.pizzaOven.steps') as { bold: string; note: string }[]} />
          ) : ovenType === 'electric_pizza' ? (
            <Steps items={t.raw('preheat.electricPizza.steps') as { bold: string; note: string }[]} />
          ) : ovenType === 'home_oven_steel' ? (
            <Steps items={t.raw('preheat.homeSteel.steps') as { bold: string; note: string }[]} />
          ) : (
            <Steps items={t.raw('preheat.homeStandard.steps') as { bold: string; note: string }[]} />
          )}
        </Section>

        <Section icon="⚠️" title={t('sectionTitles.pitfalls')}>
          <Bullets items={isBread
            ? (t.raw(
                ovenType === 'dutch_oven' ? 'preheat.dutch.pitfalls' :
                ovenType === 'home_oven_stone_bread' ? 'preheat.stoneBread.pitfalls' :
                ovenType === 'steam_oven' ? 'preheat.steam.pitfalls' :
                ovenType === 'wood_fired' ? 'preheat.woodBread.pitfalls' :
                'preheat.standardBread.pitfalls'
              ) as string[])
            : (t.raw(
                ovenType === 'pizza_oven' ? 'preheat.pizzaOven.pitfalls' :
                ovenType === 'electric_pizza' ? 'preheat.electricPizza.pitfalls' :
                ovenType === 'home_oven_steel' ? 'preheat.homeSteel.pitfalls' :
                'preheat.homeStandard.pitfalls'
              ) as string[])
          } />
        </Section>
      </StepCard>

      {/* ── STEP: Bake & Eat ─────────────────────────── */}
      <StepCard number={n()} icon={<IconBake />} title={t('stepTitles.bakeEat')} time={schedule.bakeStart} accent="#5A9A50">

        <Section icon="🥄" title={t('sectionTitles.whatToDo')}>
          {isBread ? (
            <Steps items={(t.raw(
              ovenType === 'dutch_oven' ? 'bake.dutch.steps' :
              ovenType === 'home_oven_stone_bread' ? 'bake.stoneBread.steps' :
              ovenType === 'steam_oven' ? 'bake.steam.steps' :
              ovenType === 'wood_fired' ? 'bake.woodBread.steps' :
              'bake.standardBread.steps'
            ) as { bold: string; note: string }[])} />
          ) : ovenType === 'pizza_oven' ? (
            <Steps items={t.raw('bake.pizzaOven.steps') as { bold: string; note: string }[]} />
          ) : ovenType === 'electric_pizza' ? (
            <Steps items={t.raw('bake.electricPizza.steps') as { bold: string; note: string }[]} />
          ) : ovenType === 'home_oven_steel' ? (
            <Steps items={t.raw('bake.homeSteel.steps') as { bold: string; note: string }[]} />
          ) : ovenType === 'home_oven_standard' ? (
            <Steps items={t.raw('bake.homeStandard.steps') as { bold: string; note: string }[]} />
          ) : (
            <Steps items={t.raw('bake.default.steps') as { bold: string; note: string }[]} />
          )}
        </Section>

        <Section icon="👁️" title={t('sectionTitles.watchFor')}>
          {isBread ? (
            <Bullets items={t.raw('bake.dutch.watchFor') as string[]} />
          ) : ovenType === 'pizza_oven' ? (
            <Bullets items={t.raw('bake.pizzaOven.watchFor') as string[]} />
          ) : ovenType === 'electric_pizza' ? (
            <Bullets items={t.raw('bake.electricPizza.watchFor') as string[]} />
          ) : ovenType === 'home_oven_steel' ? (
            <Bullets items={t.raw('bake.homeSteel.watchFor') as string[]} />
          ) : (
            <Bullets items={t.raw('bake.homeStandard.watchFor') as string[]} />
          )}
        </Section>

        <Section icon="⚠️" title={t('sectionTitles.pitfalls')}>
          <Bullets items={isBread
            ? (t.raw(
                ovenType === 'dutch_oven' ? 'bake.dutch.pitfalls' :
                ovenType === 'home_oven_stone_bread' ? 'bake.stoneBread.pitfalls' :
                ovenType === 'steam_oven' ? 'bake.steam.pitfalls' :
                ovenType === 'wood_fired' ? 'bake.woodBread.pitfalls' :
                'bake.standardBread.pitfalls'
              ) as string[])
            : (t.raw(
                ovenType === 'pizza_oven' ? 'bake.pizzaOven.pitfalls' :
                ovenType === 'electric_pizza' ? 'bake.electricPizza.pitfalls' :
                ovenType === 'home_oven_steel' ? 'bake.homeSteel.pitfalls' :
                'bake.homeStandard.pitfalls'
              ) as string[])
          } />
        </Section>

        {isBread && (
          <Section icon="🎓" title={t('sectionTitles.learnMore')}>
            <ExtLink href="https://www.theperfectloaf.com/guides/how-to-score-bread-dough/" label={t('bake.learnMoreScoring')} />
          </Section>
        )}
      </StepCard>

      {learnTerm && <LearnModal term={learnTerm} onClose={() => setLearnTerm(null)} />}
    </div>
  );
}
