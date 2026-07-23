'use client';
import { useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import Header from '../../components/Header';

// ── Shared style tokens ──────────────────────────
const CHAR   = '#1A1612';
const ASH    = '#3D3530';
const SMOKE  = '#8A7F78';
const TERRA  = '#C4522A';
const GOLD   = '#D4A853';
const SAGE   = '#6B7A5A';
const BORDER = '#E8E0D5';

const bodyText: React.CSSProperties = {
  fontFamily: 'DM Sans, sans-serif',
  fontSize: '14px',
  color: ASH,
  lineHeight: 1.65,
};

const monoSm: React.CSSProperties = {
  fontFamily: 'var(--font-dm-mono)',
  fontSize: '11px',
  color: SMOKE,
  letterSpacing: '.04em',
};

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{
      fontFamily: 'var(--font-dm-mono)', fontSize: '12px',
      background: 'rgba(26,22,18,0.06)', padding: '2px 6px',
      borderRadius: '4px', color: CHAR,
    }}>{children}</code>
  );
}

function BulletList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
      {items.map((item, i) => (
        <li key={i} style={{
          borderLeft: `2px solid ${BORDER}`, paddingLeft: '10px',
          marginBottom: '6px', fontFamily: 'DM Sans, sans-serif',
          fontSize: '13px', color: ASH, lineHeight: 1.55,
        }}>{item}</li>
      ))}
    </ul>
  );
}

function NumberedList({ items }: { items: React.ReactNode[] }) {
  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start' }}>
          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '12px', color: TERRA, flexShrink: 0, marginTop: '1px' }}>{i + 1}.</span>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: ASH, lineHeight: 1.55 }}>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Pill({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', fontFamily: 'var(--font-dm-mono)', fontSize: '11px',
      padding: '3px 10px', borderRadius: '20px', margin: '3px',
      background: bg, color,
    }}>{children}</span>
  );
}

function DataTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
      <thead>
        <tr>
          {(['Preferment', 'Correction', 'Why'] as const).map(h => (
            <th key={h} style={{
              fontFamily: 'var(--font-dm-mono)', fontSize: '11px', color: SMOKE,
              textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 500,
              padding: '6px 12px', textAlign: 'left',
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([a, b, c], i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(26,22,18,0.025)' : 'transparent' }}>
            <td style={{ padding: '6px 12px', fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: ASH }}>{a}</td>
            <td style={{ padding: '6px 12px', fontFamily: 'var(--font-dm-mono)', fontSize: '12px', color: CHAR }}>{b}</td>
            <td style={{ padding: '6px 12px', fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: SMOKE }}>{c}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Accordion({ title, children, defaultOpen = false }: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: `1px solid ${BORDER}` }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '16px 0',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{
          fontFamily: 'Playfair Display, serif', fontSize: '16px',
          fontWeight: 600, color: CHAR,
        }}>{title}</span>
        <span style={{
          fontSize: '18px', color: SMOKE,
          display: 'inline-block',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
          flexShrink: 0, marginLeft: '12px',
        }}>›</span>
      </button>
      <div style={{
        maxHeight: open ? '3000px' : '0',
        overflow: 'hidden',
        transition: 'max-height 0.3s ease',
      }}>
        <div style={{ paddingBottom: '20px', ...bodyText }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '0 0 12px', ...bodyText }}>{children}</p>;
}

// ── Bilingual content ────────────────────────────────────────────────────────

type SectionDef = { title: string; defaultOpen?: boolean; body: React.ReactNode };
type LocaleContent = { pageTitle: string; pageSubtitle: string; footer: string; sections: SectionDef[] };

const PREF_TABLE_ROWS: [string, string, string][] = [
  ['RT poolish',     '÷3.1',  'No salt + 100% hydration → yeast ~3× more active'],
  ['Fridge poolish', '×1.65', 'Liquid medium → CO₂ escapes freely'],
  ['Biga',           '×2.2',  'Stiff dough (50–55%) + cold → yeast constrained'],
];

const CONTENT: Record<string, LocaleContent> = {
  en: {
    pageTitle: 'About Baker Hub',
    pageSubtitle: 'How it works · Why it exists',
    footer: 'Baker Hub Beta',
    sections: [
        {
          title: 'Why Baker Hub exists',
          defaultOpen: true,
          body: (
            <>
              <P>Most baking recipes assume you have a free afternoon, a 20°C kitchen, and nothing else to do. Most of us don't.</P>
              <P>Baker Hub was built for the serious home baker who bakes around real life — a day job, a family dinner, a pizza night that needs to happen Saturday at 7pm, not whenever the dough feels ready. You set the bake time. Baker Hub works backwards from there: when to start, how much yeast to use, what to do at each step.</P>
              <P>It's also built for hot kitchens. Every fermentation formula in every baking book was developed in a temperate kitchen at 18–22°C. In warmer climates those formulas consistently over-ferment. Baker Hub corrects from first principles — not a "hot weather" button, but actual biology recalculated at your kitchen temperature.</P>
              <P>And it's built to be honest. Every status indicator reflects actual fermentation quality — not just whether something is technically possible.</P>
            </>
          ),
        },
        {
          title: 'Simple mode vs Custom mode',
          body: (
            <>
              <P>Baker Hub has two modes, selectable at the start of every session.</P>
              <p style={{ marginBottom: '10px', ...bodyText }}><strong style={{ color: CHAR }}>Simple mode</strong> — guided from start to finish. You pick a style (Neapolitan, baguette, pan pizza...), an oven, a kitchen temperature, and a bake time. Baker Hub fills in the rest: flour type assumed standard for the style, hydration at style baseline, preferment recommended automatically. The output is a horizontal step-by-step timeline — kneading, bulk rise, cold retard, balling, final proof, bake.</p>
              <p style={{ margin: 0, ...bodyText }}><strong style={{ color: CHAR }}>Custom mode</strong> — every variable exposed. Choose your exact flour (or blend two flours by ratio), enter your fridge temperature, override preferment type, adjust hydration, enter W value manually. The scheduler actively searches for the optimal mix time and shows a live fermentation quality chart. The same scientific engine runs in both modes — Custom just exposes all of its inputs and shows the quality score.</p>
            </>
          ),
        },
        {
          title: 'Availability blockers',
          body: (
            <>
              <P>Both Simple and Custom modes respect your blocked hours. Mark time windows when you're unavailable — weekday work hours, overnight, or any custom period — and the scheduler plans around them.</P>
              <P>In Simple mode, the timeline avoids placing steps during blocked windows. In Custom mode, the search engine excludes blocked hours from both preferment start and mix time candidates.</P>
              <p style={{ margin: 0, ...bodyText }}>One practical exception: <strong style={{ color: CHAR }}>bulk fermentation</strong> (the initial room-temperature rise after mixing) can begin up to 30 minutes before a blocked window. The dough retards itself in the fridge once you step away — you don't need to be home when bulk ends.</p>
            </>
          ),
        },
        {
          title: 'Your preferences & your own pizzas',
          body: (
            <>
              <P>Open ☰ → <strong style={{ color: CHAR }}>My preferences</strong> to set your defaults once: pizza oven and bread oven (independently), mixer, yeast, preferred preferment, fridge temperature, favourite style per bake type, default mode, your sourdough starter's traits, and your usual busy hours. Everything saves automatically as you tap — no save button — and prefills every new session, always changeable per step. Signed in, preferences sync to your account and follow you across devices.</P>
              <p style={{ margin: 0, ...bodyText }}><strong style={{ color: CHAR }}>Create your own pizza</strong> from the Pizza Party list: pick ingredients from the catalogue or add your own in free text, group by group (base, cheese, meat & sea, vegetables, finishing). Add a photo and reframe it by dragging. Your creations live in your preferences, reappear at every party, and flow into the shopping list, the prep timeline and the bake sheet — including oven guidance inferred from their ingredients.</p>
            </>
          ),
        },
        {
          title: 'How the engines connect',
          body: (
            <>
              <P>Baker Hub's engines form a chain where each output feeds the next.</P>
              <P><strong style={{ color: CHAR }}>Style and oven</strong> set the fermentation blueprint — target cold retard duration, RT (room-temperature) window, and baseline hydration. <strong style={{ color: CHAR }}>Flour strength</strong> (W value) scales that blueprint — stronger flour tolerates longer fermentation and benefits from more cold retard. <strong style={{ color: CHAR }}>Kitchen temperature</strong> determines how fast fermentation moves and compresses or expands the usable window.</P>
              <P>With those constraints established, the <strong style={{ color: CHAR }}>scheduler</strong> finds the best mix time given your real availability, outputting exact hours for RT and cold fermentation. The <strong style={{ color: CHAR }}>yeast engine</strong> receives those hours and computes the precise quantity — yeast is always an output, never an input. Finally, <strong style={{ color: CHAR }}>hydration</strong> is layered on: style baseline, oven type, climate, flour absorption — each factor independent and auditable.</P>
              <p style={{ margin: 0, ...bodyText }}>Change any input and everything downstream recalculates automatically.</p>
            </>
          ),
        },
        {
          title: 'Style & oven',
          body: (
            <>
              <P>Every style carries a fermentation blueprint. Neapolitan targets 24h cold retard (refrigerator fermentation) + 2h RT before baking. Baguette targets 12h cold + 2h RT. Roman and pan pizza are pure RT styles — no cold retard. These reflect the gluten development, flavour compounds, and texture each style requires.</P>
              <P>The oven shapes the recipe independently. A pizza oven at 400–500°C runs slightly drier dough (−2% hydration) with no oil or sugar — intense heat caramelises naturally. A home oven with a baking stone benefits from +3% hydration. A standard home oven +4%. A cast iron pan +6%. Baker Hub applies these corrections automatically; each is overridable in Custom mode.</P>
              <p style={{ margin: 0, ...bodyText }}><strong style={{ color: CHAR }}>Oven preheat</strong> also matters for scheduling. A wood-fired oven needs 45–60 minutes of preheat that sits at the end of the timeline. The scheduler accounts for this when computing available fermentation time — preheat is excluded from the fermentation window calculation.</p>
            </>
          ),
        },
        {
          title: 'Climate & kitchen temperature',
          body: (
            <>
              <P>Kitchen temperature is the most sensitive variable in fermentation. A 5°C difference roughly halves or doubles the fermentation rate. Baker Hub recalculates every threshold dynamically.</P>
              <BulletList items={[
                <>In a <strong style={{color:CHAR}}>tropical kitchen</strong> (≥28°C), the engine applies a full recalibration: shorter minimum bulk time (30min vs 90min in temperate conditions), compressed RT windows, and higher yeast correction. Above 30°C, an additional tropical factor is applied to the RT formula.</>,
                <>The <strong style={{color:CHAR}}>RT poolish</strong> peak shifts from ~13h at 18°C to ~5h at 30°C — the usable window narrows dramatically in warm kitchens. Plan poolish timing accordingly.</>,
                <><strong style={{color:CHAR}}>Fridge temperature</strong> matters too. The cold retard formula includes a Q10 correction: <Code>Q10 = 2^((fridgeTemp − 4) / 10)</Code>, where 4°C is the calibration reference. A 6°C fridge (typical home fridge) is slightly more active than 4°C — slightly less yeast needed. A 2°C fridge needs slightly more. Any fridge temperature is handled correctly; the exponent can be negative without any mathematical issue.</>,
                <>For <strong style={{color:CHAR}}>hydration handling</strong>: hot (≥28°C) or very humid kitchens get −2% hydration — a handling correction, not a fermentation one. At baking hydration ranges (55–80%), ambient humidity does not meaningfully affect fermentation speed. Cold kitchens (≤18°C) get +2%.</>,
              ]} />
            </>
          ),
        },
        {
          title: 'Flour engine',
          body: (
            <>
              <P>Baker Hub's flour database contains 285+ entries. Each flour carries three properties that cascade through the recipe and schedule.</P>
              <p style={{ marginBottom: '10px', ...bodyText }}><strong style={{ color: CHAR }}>W value (Force W)</strong> — the alveograph strength index, measuring gluten extensibility and tenacity. Ranges from ~80 (weak cake flour) to 400+ (Manitoba strong flour). Higher W = stronger gluten = longer fermentation needed to relax it and develop flavour. A W220 flour peaks at 4–6h RT. A W370 flour needs 48–96h cold to reach its best. Scan a flour bag with the AI scanner to extract W automatically (or estimate from protein %), or enter it manually in Custom mode.</p>
              <p style={{ marginBottom: '10px', ...bodyText }}><strong style={{ color: CHAR }}>Fermentation tolerance (ftm)</strong> — a multiplier derived from W value that scales the scheduler's quality plateau. At W250 (baseline), ftm = 1.0. At W300+, ftm ≈ 1.2 — the optimal cold retard window extends by 20%. At W220, ftm ≈ 0.85 — the window is narrower and the dough more fragile. Two bakers using the same style but different flours get different recommended schedules in Custom mode.</p>
              <p style={{ marginBottom: '10px', ...bodyText }}><strong style={{ color: CHAR }}>Hydration delta</strong> — how much to shift baseline hydration for this flour. Strong, high-protein flours absorb more water; weak flours need less. For blends, deltas are weighted proportionally by ratio. In practice, corrections range from −2% to +6%. Applied after scheduling — hydration does not affect fermentation speed, only texture, extensibility, and crust character.</p>
              <p style={{ margin: 0, ...bodyText }}>Yeast quantity is always computed from your schedule — the flour's fermentation tolerance scales the timing, but yeast itself adjusts automatically through the hours change.</p>
            </>
          ),
        },
        {
          title: 'Schedule engine',
          body: (
            <>
              <P>The scheduler works backwards from your bake time, evaluating the available planning window against your kitchen temperature, oven preheat, flour strength (Custom mode), and fermentation style.</P>
              <p style={{ margin: '0 0 10px', ...monoSm, color: TERRA, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Simple mode</p>
              <P>You confirm when to start; the scheduler allocates fermentation phases to fill the available window. It maximises cold retard up to the style's preferred duration, then places bulk RT, rest, and final proof. Availability blockers are respected — steps are pushed to after blocked windows automatically.</P>
              <p style={{ margin: '14px 0 10px', ...monoSm, color: TERRA, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Custom mode — scoring</p>
              <P>The scheduler actively searches for the optimal mix time. Each candidate is scored on two axes:</P>
              <BulletList items={[
                <><strong style={{color:CHAR}}>Preferment quality</strong> — is the poolish or biga at its peak at mix time? Green = optimal plateau. Yellow = developing or slightly past peak, still usable. Red = under-fermentation risk, direct dough recommended.</>,
                <><strong style={{color:CHAR}}>Dough quality</strong> — does total fermentation land with the dough peaking at bake? The quality plateau is style and flour-dependent: wide for strong flours and cold-retard styles (Neapolitan, baguette), narrow for weak flours and pure RT styles (Roman, pan pizza).</>,
              ]} />
              <p style={{ margin: '14px 0 10px', ...monoSm, color: TERRA, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Mode selection & tiebreaker</p>
              <P>For poolish, the scheduler always tries both fridge and RT (room-temperature) poolish, picks the higher-scoring result. Fridge wins ties — cold fermentation develops more flavour complexity. Within fridge mode, longer cold retard scores higher, up to the dough's quality plateau. Flour strength (W value) scales where that plateau sits.</P>
              <p style={{ margin: 0, ...bodyText }}>When no mix time fits within available hours, a fallback dialog explains your options: mix just before or after your blocked window, or inside it.</p>
            </>
          ),
        },
        {
          title: 'Reading the fermentation chart',
          body: (
            <>
              <P>The Custom mode fermentation chart is a live visualisation of quality — not a schedule, but a picture of how close each stage is to its biological optimum.</P>

              {/* Inline illustration */}
              <div style={{ margin: '16px 0', borderRadius: '10px', background: 'rgba(26,22,18,0.03)', padding: '16px' }}>
                <svg viewBox="0 0 420 140" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
                  {/* RT poolish bell - narrow */}
                  <path d="M 30 120 Q 50 120 60 115 Q 70 108 75 85 Q 80 55 85 30 Q 90 55 95 85 Q 100 108 110 115 Q 120 120 140 120 Z" fill="rgba(212,168,83,0.25)" stroke="#D4A853" strokeWidth="1.5" />
                  <text x="85" y="24" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="9" fill="#8A7F78">RT poolish</text>
                  <text x="85" y="34" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="8" fill="#8A7F78">narrow peak</text>
                  {/* Fridge poolish bell - wide plateau */}
                  <path d="M 155 120 Q 175 120 185 114 Q 195 105 198 90 Q 200 70 202 55 L 218 55 Q 220 70 222 90 Q 225 105 235 114 Q 245 120 265 120 Z" fill="rgba(212,168,83,0.25)" stroke="#D4A853" strokeWidth="1.5" />
                  <line x1="202" y1="55" x2="218" y2="55" stroke="#D4A853" strokeWidth="1.5" />
                  <text x="210" y="24" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="9" fill="#8A7F78">Fridge poolish</text>
                  <text x="210" y="34" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="8" fill="#8A7F78">wide plateau</text>
                  {/* Plateau annotation */}
                  <line x1="202" y1="48" x2="218" y2="48" stroke="#D4A853" strokeWidth="1" strokeDasharray="2,2" />
                  <text x="210" y="46" textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="7" fill="#D4A853">plateau</text>
                  {/* Dough bell - wide plateau, right side */}
                  <path d="M 285 120 Q 295 120 300 115 Q 305 108 308 95 Q 310 80 312 65 L 330 65 Q 332 80 334 95 Q 337 108 342 115 Q 350 120 390 120 Z" fill="rgba(107,122,90,0.2)" stroke="rgba(107,122,90,0.8)" strokeWidth="1.5" />
                  <line x1="312" y1="65" x2="330" y2="65" stroke="rgba(107,122,90,0.8)" strokeWidth="1.5" />
                  <text x="335" y="24" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="9" fill="#8A7F78">Dough</text>
                  <text x="335" y="34" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="8" fill="#8A7F78">peaks at bake</text>
                  {/* Mix diamond */}
                  <rect x="279" y="113" width="8" height="8" transform="rotate(45 283 117)" fill="#D4A853" />
                  <text x="283" y="134" textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="8" fill="#D4A853">mix ◆</text>
                  {/* Bake triangle */}
                  <polygon points="390,120 386,108 394,108" fill="#C4522A" />
                  <text x="390" y="134" textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="8" fill="#C4522A">bake ▲</text>
                  {/* Time axis */}
                  <line x1="30" y1="120" x2="400" y2="120" stroke="#E8E0D5" strokeWidth="1" />
                  <text x="215" y="138" textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="8" fill="#8A7F78">← earlier ——————————— time ——————————— bake →</text>
                </svg>
              </div>

              <p style={{ margin: '0 0 10px', ...bodyText }}><strong style={{ color: CHAR }}>Two curves, two stories.</strong> The gold curve is the preferment (poolish or biga) — it should peak at mix time (gold ◆). The grey-green curve is the final dough — it should peak at bake (red ▲). When both align, you get the best possible result from your schedule.</p>
              <p style={{ margin: '0 0 10px', ...bodyText }}><strong style={{ color: CHAR }}>Curve shapes reflect the biology.</strong> RT fermentation produces a tall, narrow bell — yeast peaks fast and declines rapidly. Small timing errors have large quality effects. Cold retard produces a wide plateau bell — slower biology, much wider quality window. This is why cold retard is preferred: it's forgiving.</p>
              <p style={{ margin: '0 0 10px', ...bodyText }}><strong style={{ color: CHAR }}>Fermentation windows</strong> (shown when "Show timing guide" is checked) are the horizontal arrows above the curves — the range where each stage should ideally sit. The left arrow marks the earliest viable start; the right arrow marks where quality begins to decline. Landing within the arrows = green pill.</p>
              <p style={{ margin: '0 0 10px', ...bodyText }}><strong style={{ color: CHAR }}>Status pills.</strong> 🟢 Ready = on the plateau. 🟡 Still developing = approaching peak, usable but not optimal. 🔴 Not ready = under-fermentation risk. When no viable preferment window exists, the gold curve disappears entirely — the card recommends going direct.</p>
              <p style={{ margin: 0, ...bodyText }}><strong style={{ color: CHAR }}>Interact with the chart.</strong> Drag the gold diamond to adjust preferment start. Drag the green diamond to adjust mix time. Both curves update in real time. <em>Reset to recommendation</em> snaps back to the engine's optimal placement.</p>
            </>
          ),
        },
        {
          title: 'Preferment timing',
          body: (
            <>
              <P>A preferment — poolish, biga, or sourdough starter — is a portion of the flour fermented separately before the final mix. It adds flavour compounds and gluten conditioning that straight doughs can't match in the same timeframe.</P>
              <BulletList items={[
                <><strong style={{color:CHAR}}>Fridge poolish</strong> (100% hydration, cold-fermented) — develops slowly over a wide quality plateau. The engine targets roughly 10–16h at 6°C for standard flour, scaled by W value: stronger flour benefits from a longer poolish. Requires a minimum planning window of ~16–17h depending on oven preheat. Longer cold retard within the plateau = more flavour complexity.</>,
                <><strong style={{color:CHAR}}>RT poolish</strong> (room-temperature) — peaks faster, narrower window. The scheduler uses RT poolish when the planning window is too short for fridge, or when RT genuinely scores higher. At 22°C, RT poolish peaks around 9h — compressing to ~5h in a tropical kitchen.</>,
                <><strong style={{color:CHAR}}>Biga</strong> (50% hydration, always cold-fermented) — the stiffest preferment. Cold, slow fermentation gives a very wide quality plateau (~38–58h). Never RT — a room-temperature biga over-acidifies within hours and produces unworkable dough.</>,
                <><strong style={{color:CHAR}}>Sourdough starter</strong> — the most demanding to time. Unlike commercial yeast preferments, the starter's activity depends on its maturity (young vs established), feeding schedule, and kitchen temperature. The peak window is narrower than poolish — a well-fed mature starter at 22°C peaks roughly 6–9h after feeding. The engine computes the recommended feed time based on your mix time and climate. Missing the window by 1–2h in either direction has more impact than with poolish or biga.</>,
              ]} />
              <p style={{ margin: '14px 0 0', ...bodyText }}>When the planning window is too short for any preferment, the gold curve disappears and the card reads: <em>{"Window too short — your dough will ferment directly and still taste great."}</em></p>
            </>
          ),
        },
        {
          title: 'The sourdough engine',
          body: (
            <>
              <P>Sourdough is the hardest thing to schedule, because a living starter doesn't keep a fixed clock — its timing shifts with how it's stored, how recently it was fed, how mature it is, and how warm your kitchen runs. Most tools ignore all of that and hand you a generic timeline. Baker Hub models it.</P>

              <p style={{ margin: '14px 0 10px', ...monoSm, color: TERRA, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>What it asks you</p>
              <P>Two plain questions, no jargon: <strong style={{color:CHAR}}>where has your starter been</strong> (room temperature or fridge) and <strong style={{color:CHAR}}>when did you last feed it</strong> (today through a week-plus ago). Plus how active it is — mature, young, or rye. That's enough for the engine to work out everything else.</P>

              <p style={{ margin: '14px 0 10px', ...monoSm, color: TERRA, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>How it reads your starter</p>
              <P>From those answers it estimates when your starter will next peak — the short window when it's at full strength and ready to mix. Peak timing is temperature-driven: a healthy starter peaks roughly <strong style={{color:CHAR}}>3–4 hours after feeding in a tropical kitchen</strong> (30–32°C), but closer to <strong style={{color:CHAR}}>6–9 hours in a temperate one</strong> (22°C). A young or rye starter runs slower again. The same starter, in two different kitchens, is two different clocks — and the engine treats them that way.</P>

              <p style={{ margin: '14px 0 10px', ...monoSm, color: TERRA, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>The decision it walks through</p>
              <P>Every plan follows the same honest path, in order:</P>
              <BulletList items={[
                <><strong style={{color:CHAR}}>Is your starter ready, or does it need waking?</strong> A starter fed today at room temperature may already be near peak. One that's been in the fridge for days needs reviving first.</>,
                <><strong style={{color:CHAR}}>How many refreshes does reviving take?</strong> This scales with how long it's rested and how mature it is — never more work than the biology calls for (the next section).</>,
                <><strong style={{color:CHAR}}>When should the final feed land</strong> so the starter peaks exactly at mix time? The engine works this backwards from your bake time.</>,
                <><strong style={{color:CHAR}}>Does that feed time fall in an hour you're available?</strong> If not, it tries to move it — by shifting the feed, or by suggesting a different feed ratio (below).</>,
                <><strong style={{color:CHAR}}>Is there enough total time for the dough to ferment properly after mixing?</strong> If a bake time is too tight to do this well, the engine says so rather than handing you a plan that won't work.</>,
              ]} />
              <P>At each step it prefers the plan you can actually execute over a theoretically perfect one you can't.</P>

              <p style={{ margin: '14px 0 10px', ...monoSm, color: TERRA, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Waking a cold starter</p>
              <P>A starter that's lived in the fridge needs reviving before it can raise bread, and how much depends on how long it's been resting. The engine scales this the way an experienced baker would: a mature starter fed in the last few days needs a <strong style={{color:CHAR}}>single refresh</strong>; one that's been cold for a week needs <strong style={{color:CHAR}}>two</strong>. A young or weaker starter gets one more than a mature one at the same age. It never asks for busywork — and it never sends you to bake with a starter that hasn't been properly woken. When a second refresh would genuinely make a milder, stronger loaf, it offers it; it doesn't force it.</P>

              <p style={{ margin: '14px 0 10px', ...monoSm, color: TERRA, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Feed ratio & timing</p>
              <P>The ratio you feed at (1:1:1 through 1:10:10) changes how fast your starter peaks — a bigger feed has further to climb, so it takes longer. This is a quiet but powerful lever. If your ideal feed time lands in the middle of your night or your workday, the engine can <strong style={{color:CHAR}}>recommend a different ratio</strong> that shifts the peak into a more workable hour, and tells you in plain words what it changed and why — for example, moving a 3am feed to a 7am one by feeding at a higher ratio. You stay in control: keep your usual ratio, or take the suggestion.</P>

              <p style={{ margin: '14px 0 10px', ...monoSm, color: TERRA, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Planned around your life</p>
              <P>Tell the engine the hours you're unavailable and it shapes the whole plan around them — feed times, refresh times, and the mix itself are nudged out of your blocked windows wherever the biology allows. It won't pretend a 3am feed is ideal, but it will work to avoid asking for one. And it's honest when a tight bake time simply doesn't leave enough room: it tells you, and suggests the earliest bake that would.</P>

              <p style={{ margin: '14px 0 10px', ...monoSm, color: TERRA, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Taste, if you want it</p>
              <P>A <strong style={{color:CHAR}}>Milder / Balanced / Tangier</strong> choice nudges two levers at once: how long the dough cold-proofs, and how the starter is refreshed. Tangier leans on a longer cold proof and fewer refreshes — more acid, more depth. Milder uses a shorter cold proof and an extra refresh — gentler, sweeter. Balanced keeps the standard timing. It adjusts the schedule the engine builds; it never changes your ingredients.</P>

              <p style={{ margin: '14px 0 10px', ...monoSm, color: TERRA, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>If you already track your starter</p>
              <p style={{ margin: 0, ...bodyText }}>Prefer to watch your jar yourself? Switch to <strong style={{color:CHAR}}>"I know when my starter will peak"</strong> and give the engine the time directly — it builds the entire plan backwards from there, skipping the estimation.</p>
            </>
          ),
        },
        {
          title: 'The yeast engine',
          body: (
            <>
              <P>Baker Hub's fermentation engine is built on two validated sources: Craig's empirical yeast formula (developed by the pizzamaking.com community) and Modernist Pizza Vol. 4 (Myhrvold et al.) — the most comprehensive empirical fermentation dataset available in print.</P>
              <P>The formulas compute <strong style={{color:CHAR}}>IDY%</strong> — Instant Dry Yeast (IDY) as a percentage of flour weight. Baker Hub supports IDY, fresh yeast, and active dry yeast (ADY); each is converted from IDY using validated ratios (fresh yeast = IDY × 3, ADY = IDY × 1.33).</P>
              <p style={{ marginBottom: '6px', ...bodyText }}><strong style={{ color: CHAR }}>Room-temperature (RT) fermentation</strong></p>
              <p style={{ marginBottom: '14px' }}><Code>IDY% = 9.5 / (hours^1.65 × 2.5^((temp−25)/10))</Code></p>
              <p style={{ marginBottom: '6px', ...bodyText }}><strong style={{ color: CHAR }}>Cold retard fermentation</strong></p>
              <p style={{ marginBottom: '6px' }}><Code>IDY% = (7.5 / hours^1.313) ÷ Q10</Code></p>
              <P>where <Code>Q10 = 2^((fridgeTemp − 4) / 10)</Code>. Q10 expresses how yeast activity scales with fridge temperature, calibrated at 4°C (standard reference). At 6°C (typical home fridge), Q10 = 1.15 — slightly more active, slightly less yeast needed. At 2°C, Q10 = 0.87 — slower fermentation, more yeast. The formula handles any fridge temperature correctly.</P>
              <p style={{ marginBottom: '6px', ...bodyText }}><strong style={{ color: CHAR }}>Mixed RT + cold</strong></p>
              <P>An activity-weighted combination accounts for the transition between phases — not a simple sum, but a biological equivalence calculation.</P>
              <p style={{ margin: 0, ...bodyText }}>Yeast is always an output. Change your schedule and it recalculates automatically. Two bakers with the same recipe but different schedules, kitchens, and fridges get different yeast quantities. That's the point.</p>
            </>
          ),
        },
        {
          title: 'Hydration engine',
          body: (
            <>
              <P>Hydration is never a single number. Baker Hub builds it in five stacked layers, each independent and auditable in Custom mode:</P>
              <NumberedList items={[
                <><strong style={{ color: CHAR }}>Style baseline</strong> — Neapolitan 62%, baguette 72%, brioche 52%, pan 70%</>,
                <><strong style={{ color: CHAR }}>Oven correction</strong> — pizza oven: −2%; home oven + stone: +3%; standard home oven: +4%; cast iron: +6%</>,
                <><strong style={{ color: CHAR }}>Climate correction</strong> — hot kitchen (≥28°C) or very humid: −2% (handling ease, not fermentation) · cold kitchen (≤18°C): +2%</>,
                <><strong style={{ color: CHAR }}>Flour correction</strong> — hydration delta from W value and protein content (−2% to +6% in practice)</>,
                <><strong style={{ color: CHAR }}>Style floor</strong> — minimum hydration per style enforced regardless of corrections</>,
              ]} />
              <p style={{ margin: '14px 0 0', ...bodyText }}>Hydration is computed after scheduling. At baking ranges (55–80%), dough hydration does not meaningfully affect fermentation rate — it governs texture, extensibility, crust char, and crumb structure.</p>
            </>
          ),
        },
        {
          title: 'Mixer sensitivity',
          body: (
            <>
              <P>Your mixer changes the recipe in two ways.</P>
              <p style={{ marginBottom: '6px', ...bodyText }}><strong style={{ color: CHAR }}>Water temperature — DDT method</strong></p>
              <p style={{ marginBottom: '10px' }}><Code>Water temp = (Target FDT × 3) − flour temp − kitchen temp − friction</Code></p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                {['Spiral +8°C', 'Stand +5°C', 'By hand +1°C', 'No-knead 0°C'].map(l => (
                  <span key={l} style={{ ...monoSm, padding: '3px 10px', borderRadius: '20px', background: 'rgba(26,22,18,0.06)' }}>{l}</span>
                ))}
              </div>
              <P>FDT (Final Dough Temperature) is the temperature of your dough immediately after mixing — it directly controls how fast fermentation begins. Target FDT varies by style (Neapolitan 23°C, enriched doughs 22°C). In hot kitchens the formula often calls for water below 10°C — which is why Baker Hub sometimes recommends ice.</P>
              <p style={{ margin: 0, ...bodyText }}><strong style={{ color: CHAR }}>Technique and timing:</strong> each mixer type has its own kneading time, fold count, and maximum dough weight. Baker Hub's step-by-step Bake Guide is calibrated per mixer — a spiral mixer user and a hand-kneader get different instructions for the same recipe.</p>
            </>
          ),
        },
        {
          title: 'Maestro — help along the way',
          body: (
            <>
              <P>Maestro is Baker Hub's AI coaching layer, available at key moments in the bake.</P>
              <BulletList items={[
                'Before baking: Maestro reviews your recipe and schedule and flags anything worth watching — e.g. if your poolish is slightly early, or your fridge is warmer than optimal.',
                'During baking: take a photo of your dough and Maestro assesses fermentation visually — bubble structure, surface tension, colour. It cross-references your actual ingredients and schedule to give contextual feedback, not generic advice.',
                'After baking: photo assessment of your finished pizza or bread. Maestro evaluates leoparding, crust colour, cornicione structure, and crumb against the style you aimed for.',
              ]} />
              <p style={{ margin: '14px 0 0', ...bodyText }}>Maestro is honest about the limits of photo-based assessment. It tells you what it can and can't see, and never overstates confidence.</p>
            </>
          ),
        },
        {
          title: 'Pizza Party — from dough to table',
          body: (
            <>
              <P>The Pizza Party feature is built around one idea: once you've planned your dough, the rest of the evening should plan itself too.</P>
              <P><strong style={{ color: CHAR }}>156 curated recipes.</strong> Baker Hub's pizza database covers 144 savoury pizzas and 12 dessert finales — each handpicked, not generated. Organised by tradition, occasion, taste, and dietary need.</P>
              <P><strong style={{ color: CHAR }}>Scaling.</strong> Select your pizzas, set your guest count, and Baker Hub scales every topping quantity automatically — with waste percentage and serving size per pizza factored in.</P>
              <p style={{ margin: 0, ...bodyText }}><strong style={{ color: CHAR }}>Bake tracking.</strong> The Bake tab tracks what's been fired and what's next. Maestro can assess each pizza as it comes out of the oven.</p>
            </>
          ),
        },
        {
          title: 'Sessions — save, resume, rebake, share',
          body: (
            <>
              <P>Sign in (magic link or Google) and every bake becomes a <strong style={{ color: CHAR }}>session</strong> you can return to. Your full setup is saved — dough, schedule, starter state, pizza selections, and photos of the result.</P>
              <BulletList items={[
                <><strong style={{color:CHAR}}>Resume</strong> — reopen a session exactly where you left it, on the tab you were using. Not signed in? Your current session is still kept on this device.</>,
                <><strong style={{color:CHAR}}>Rebake</strong> — one tap clones a past success onto the next matching weekday and time, with your whole schedule and blocked hours shifted along. Bakers repeat their wins.</>,
                <><strong style={{color:CHAR}}>Photos</strong> — attach photos of each bake to build your own baking log over time.</>,
                <><strong style={{color:CHAR}}>Share</strong> — export any session as a card (post, square, or story format) with your recipe, schedule, and photos. Tag <strong style={{color:CHAR}}>@bakerhub</strong> and <strong style={{color:CHAR}}>#BakerHub</strong> — if you make something you're proud of, we'd love to see it.</>,
              ]} />
            </>
          ),
        },
        {
          title: "What we don't model",
          body: (
            <>
              <P>Baker Hub models fermentation from first principles, but some variables are outside the current scope:</P>
              <BulletList items={[
                'Your starter\'s exact hydration and the precise state of the microbes inside it — the engine models storage, last-feed age, maturity, and kitchen temperature, but it can\'t see your specific jar. Use the activity setting and, if you track peaks yourself, the "I know when my starter will peak" option for the closest fit.',
                'Altitude — lower atmospheric pressure slightly affects fermentation rate and oven behaviour',
                'Humidity effects on flour absorption beyond the ±2% hydration correction',
                'Dough temperature changes during cold retard (assumes fridge reaches target temperature within 1h)',
                'Preferment hydration variations — poolish is modelled at 100% hydration, biga at 50%',
              ]} />
              <p style={{ margin: '14px 0 0', ...bodyText }}>These limits are why Maestro exists — photo assessment and real-time coaching fills the gap between the model and your specific kitchen reality.</p>
            </>
          ),
        },
        {
          title: 'Beta & feedback',
          body: (
            <>
              <P>Baker Hub is actively developed. Things will occasionally break. If a yeast quantity seems wrong, the schedule doesn't fit, or something is confusing — please tell us. Every piece of feedback makes the engine better.</P>
              <div style={{ background: 'rgba(26,22,18,0.04)', borderRadius: '10px', padding: '16px', marginTop: '12px' }}>
                <p style={{ margin: '0 0 4px', fontFamily: 'DM Sans, sans-serif', fontSize: '14px', fontWeight: 600, color: CHAR }}>Built by Rom</p>
                <p style={{ margin: '0 0 12px' }}>
                  <a href="mailto:rom@bakerhub.app" style={{ color: TERRA, fontFamily: 'DM Sans, sans-serif', fontSize: '14px', textDecoration: 'none' }}>rom@bakerhub.app</a>
                </p>
                <p style={{ margin: 0, fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: SMOKE }}>Baker Hub is a solo side project — feedback goes directly to the person who built the engine.</p>
              </div>
            </>
          ),
        },
      ],
  },

  fr: {
    pageTitle: 'À propos de Baker Hub',
    pageSubtitle: 'Comment ça marche · Pourquoi ça existe',
    footer: 'Baker Hub Bêta',
    sections: [
      {
        title: 'Pourquoi Baker Hub existe',
        defaultOpen: true,
        body: (
          <>
            <P>La plupart des recettes de boulangerie supposent que vous avez un après-midi libre, une cuisine à 20 °C, et rien d'autre à faire. La plupart d'entre nous n'ont rien de tout cela.</P>
            <P>Baker Hub a été conçu pour le boulanger amateur sérieux qui fait de la boulangerie autour de sa vie réelle — un emploi, un dîner en famille, une soirée pizza qui doit avoir lieu samedi à 19 h, pas quand la pâte sera enfin prête. Vous dites à Baker Hub quand vous voulez manger. Il calcule quand commencer, quelle quantité de levure utiliser, et ce qu'il faut faire à chaque étape.</P>
            <P>Il est aussi conçu pour les cuisines chaudes. Toutes les formules de fermentation dans tous les livres ont été développées dans des cuisines tempérées à 18–22 °C. Dans un climat plus chaud, ces formules font systématiquement sur-fermenter votre pâte. Le moteur de fermentation tropicale de Baker Hub corrige cela à partir des principes fondamentaux.</P>
            <P>Et il est conçu pour la soirée pizza complète — pas seulement la pâte, mais toute la soirée. Choisir ce qu'on prépare, adapter les garnitures pour un groupe, construire une liste de courses, suivre ce qui est cuit. La fonction Pizza Party transforme une soirée multi-pizza complexe en quelque chose qu'on peut vraiment planifier — et partager.</P>
            <p style={{ margin: 0, ...bodyText }}>Une note honnête : Baker Hub est un projet personnel, construit par quelqu'un qui code avec l'aide de l'IA et teste les recettes dans une vraie cuisine. L'IA écrit le code. La science, les décisions produit et la boulangerie se passent dans le monde réel. Cela signifie que l'application avance vite, tombe parfois en panne, et s'améliore à chaque fournée.</p>
          </>
        ),
      },
      {
        title: 'Mode Simple ou mode Avancé',
        body: (
          <>
            <P>Baker Hub propose deux modes, au choix au début de chaque session.</P>
            <p style={{ marginBottom: '10px', ...bodyText }}><strong style={{ color: CHAR }}>Mode Simple</strong> — guidé de bout en bout. Vous choisissez un style (napolitaine, baguette, pizza pan...), un four, une température de cuisine et une heure de cuisson. Baker Hub complète le reste : farine standard pour le style, hydratation de base, préferment recommandé automatiquement. Le résultat est un planning étape par étape — pétrissage, pointage, pousse froide, boulage, apprêt, cuisson.</p>
            <p style={{ margin: 0, ...bodyText }}><strong style={{ color: CHAR }}>Mode Avancé</strong> — toutes les variables exposées. Choisissez votre farine exacte (ou un mélange de deux farines), entrez la température de votre frigo, changez le type de préferment, ajustez l'hydratation, saisissez la valeur W manuellement. Le planificateur cherche activement la meilleure heure de pétrissage et affiche un graphique de fermentation en direct. Le même moteur scientifique tourne dans les deux modes — l'Avancé expose simplement toutes ses entrées.</p>
          </>
        ),
      },
      {
        title: 'Créneaux d’indisponibilité',
        body: (
          <>
            <P>Les modes Simple et Avancé respectent tous deux vos heures bloquées. Marquez les créneaux où vous n’êtes pas disponible — heures de travail, nuit, ou toute période personnalisée — et le planificateur construit le plan autour.</P>
            <P>En mode Simple, le planning évite de placer des étapes pendant vos créneaux bloqués. En mode Avancé, le moteur de recherche exclut ces heures des candidats pour le départ du préferment comme pour le pétrissage.</P>
            <p style={{ margin: 0, ...bodyText }}>Une exception pratique : la <strong style={{ color: CHAR }}>fermentation en masse</strong> (le pointage initial après pétrissage) peut commencer jusqu’à 30 minutes avant un créneau bloqué. La pâte se retarde d’elle-même au frigo une fois que vous partez — inutile d’être là quand le pointage se termine.</p>
          </>
        ),
      },
      {
        title: 'Vos préférences & vos propres pizzas',
        body: (
          <>
            <P>Ouvrez ☰ → <strong style={{ color: CHAR }}>Mes préférences</strong> pour régler vos valeurs par défaut une fois pour toutes : four à pizza et four à pain (indépendamment), pétrin, levure, préferment préféré, température du frigo, style favori par type de cuisson, mode par défaut, les traits de votre levain, et vos indisponibilités habituelles. Tout s'enregistre automatiquement au fil des touches — pas de bouton — et préremplit chaque nouvelle session, toujours modifiable à chaque étape. Connecté·e, vos préférences se synchronisent avec votre compte et vous suivent d'un appareil à l'autre.</P>
            <p style={{ margin: 0, ...bodyText }}><strong style={{ color: CHAR }}>Créez votre propre pizza</strong> depuis la liste Pizza Party : ingrédients du catalogue ou en texte libre, groupe par groupe (base, fromages, viandes & mer, légumes, finitions). Ajoutez une photo et recadrez-la en la glissant. Vos créations vivent dans vos préférences, reviennent à chaque soirée, et alimentent la liste de courses, la préparation et la fiche de cuisson — avec des conseils de four déduits de leurs ingrédients.</p>
          </>
        ),
      },
      {
        title: 'Comment les moteurs s’enchaînent',
        body: (
          <>
            <P>Les moteurs de Baker Hub forment une chaîne où chaque sortie alimente la suivante.</P>
            <P><strong style={{ color: CHAR }}>Le style et le four</strong> définissent le plan de fermentation — durée cible de pousse froide, fenêtre à température ambiante, hydratation de base. <strong style={{ color: CHAR }}>La force de la farine</strong> (valeur W) ajuste ce plan — une farine plus forte tolère une fermentation plus longue et profite de plus de froid. <strong style={{ color: CHAR }}>La température de la cuisine</strong> détermine la vitesse de fermentation et comprime ou étend la fenêtre utilisable.</P>
            <P>Ces contraintes posées, le <strong style={{ color: CHAR }}>planificateur</strong> trouve la meilleure heure de pétrissage compte tenu de votre disponibilité réelle, avec les heures exactes de fermentation ambiante et froide. Le <strong style={{ color: CHAR }}>moteur de levure</strong> reçoit ces heures et calcule la quantité précise — la levure est toujours une sortie, jamais une entrée. Enfin, l’<strong style={{ color: CHAR }}>hydratation</strong> se superpose : base du style, type de four, climat, absorption de la farine — chaque facteur indépendant et vérifiable.</P>
            <p style={{ margin: 0, ...bodyText }}>Modifiez n’importe quelle entrée et tout ce qui suit se recalcule automatiquement.</p>
          </>
        ),
      },
      {
        title: 'Style & four',
        body: (
          <>
            <P>Chaque style porte un plan de fermentation. La napolitaine vise 24 h de pousse froide + 2 h à température ambiante avant cuisson. La baguette vise 12 h de froid + 2 h TA. Les styles romain et pan sont purement TA — pas de pousse froide. Ces cibles reflètent le développement du gluten, les composés aromatiques et la texture que chaque style exige.</P>
            <P>Le four façonne la recette indépendamment. Un four à pizza à 400–500 °C préfère une pâte un peu plus sèche (−2 % d’hydratation), sans huile ni sucre — la chaleur intense caramélise naturellement. Un four domestique avec pierre profite de +3 % ; un four domestique standard de +4 % ; une poêle en fonte de +6 %. Baker Hub applique ces corrections automatiquement ; chacune est modifiable en mode Avancé.</P>
            <p style={{ margin: 0, ...bodyText }}><strong style={{ color: CHAR }}>Le préchauffage</strong> compte aussi pour le planning. Un four à bois demande 45–60 minutes de préchauffe en fin de planning — le planificateur l’exclut de la fenêtre de fermentation disponible.</p>
          </>
        ),
      },
      {
        title: 'Climat & température de la cuisine',
        body: (
          <>
            <P>La température de la cuisine est la variable la plus sensible de la fermentation. 5 °C d’écart doublent ou divisent par deux la vitesse. Baker Hub recalcule chaque seuil dynamiquement.</P>
            <BulletList items={[
              <>Dans une <strong style={{color:CHAR}}>cuisine tropicale</strong> (≥28 °C), le moteur applique une recalibration complète : pointage minimum raccourci (30 min contre 90 min en climat tempéré), fenêtres TA compressées, correction de levure renforcée. Au-delà de 30 °C, un facteur tropical supplémentaire s’applique.</>,
              <>Le pic du <strong style={{color:CHAR}}>poolish TA</strong> passe de ~13 h à 18 °C à ~5 h à 30 °C — la fenêtre utilisable se réduit fortement en cuisine chaude.</>,
              <>La <strong style={{color:CHAR}}>température du frigo</strong> compte aussi. La formule de pousse froide inclut une correction Q10 : <Code>Q10 = 2^((tempFrigo − 4) / 10)</Code>. Un frigo à 6 °C (typique) est légèrement plus actif qu’à 4 °C — un peu moins de levure. À 2 °C, un peu plus. Toute température de frigo est gérée correctement.</>,
              <>Pour l’<strong style={{color:CHAR}}>hydratation</strong> : cuisine chaude (≥28 °C) ou très humide : −2 % — une correction de manipulation, pas de fermentation. Cuisine froide (≤18 °C) : +2 %.</>,
            ]} />
          </>
        ),
      },
      {
        title: 'Pizza Party — de la pâte à la table',
        body: (
          <>
            <P>La fonction Pizza Party est construite autour d'une idée simple : une fois que vous avez planifié votre pâte, le reste de la soirée devrait s'organiser tout seul.</P>
            <P><strong style={{ color: CHAR }}>156 recettes sélectionnées.</strong> La base de données pizzas de Baker Hub couvre 144 pizzas salées et 12 desserts — chacun choisi à la main, pas généré. Organisés par tradition, occasion, goût et régime alimentaire pour trouver la bonne pizza au bon moment.</P>
            <div style={{
              background: 'rgba(212,168,83,0.06)', borderLeft: `2px solid ${GOLD}`,
              borderRadius: '8px', padding: '12px', marginBottom: '12px',
              fontFamily: 'var(--font-dm-mono)', fontSize: '12px', color: SMOKE,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { cat: 'Napolitaine & Romaine classique', detail: '60+ recettes' },
                  { cat: 'Styles américains', detail: 'New York, Detroit, Pan' },
                  { cat: 'Régional français', detail: 'Normandie, Provence, Alsace, Basque, Savoie' },
                  { cat: 'Régional italien', detail: 'Sicilien, Ligurien, Vénitien, Calabrais' },
                  { cat: 'Moderne & fusion', detail: 'Japonais, Coréen, Espagnol, Moyen-Oriental' },
                ].map(({ cat, detail }) => (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', fontFamily: 'var(--font-dm-mono)', fontSize: '12px' }}>
                    <span style={{ color: CHAR, fontWeight: 500, flexShrink: 0 }}>{cat}</span>
                    <span style={{ color: SMOKE, textAlign: 'right', fontSize: '11px', lineHeight: 1.4 }}>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {[
                { label: 'Impressionner (109)',      bg: 'rgba(26,22,18,0.06)', color: CHAR },
                { label: 'Soirée (50)',              bg: 'rgba(26,22,18,0.06)', color: CHAR },
                { label: 'Classique (75)',           bg: 'rgba(26,22,18,0.06)', color: CHAR },
                { label: 'Préparation rapide (33)', bg: 'rgba(26,22,18,0.06)', color: CHAR },
                { label: 'Enfants (28)',             bg: 'rgba(26,22,18,0.06)', color: CHAR },
                { label: 'Épicé (11)',               bg: 'rgba(26,22,18,0.06)', color: CHAR },
              ].map(p => <Pill key={p.label} bg={p.bg} color={p.color}>{p.label}</Pill>)}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
              {["Végétarien (64)", "Sans porc (75)", "Halal (73)", "Casher (62)", "Pescatarien (16)", "Sans fruits à coque (127)"].map(l => (
                <Pill key={l} bg="rgba(107,122,90,0.12)" color={SAGE}>{l}</Pill>
              ))}
            </div>
            <P>Chaque pizza est associée aux styles de pâte compatibles — une Marinara n'apparaîtra pas pour une pizza pan, un Detroit ne s'affichera pas pour une napolitaine. Les suggestions correspondent toujours à ce que votre pâte peut réellement faire.</P>
            <P><strong style={{ color: CHAR }}>Guide de préparation, adapté à votre groupe.</strong> L'onglet Prép génère un planning complet de préparation des ingrédients en remontant depuis l'heure de cuisson — égoutter la mozzarella 30 minutes avant, couper la charcuterie 15 minutes avant, déchirer le basilic juste avant de servir. Les quantités s'adaptent automatiquement au nombre de pizzas.</P>
            <p style={{ margin: 0, ...bodyText }}><strong style={{ color: CHAR }}>Liste de courses.</strong> Ingrédients de la pâte et garnitures combinés en une seule liste. Cochez au fur et à mesure.</p>
          </>
        ),
      },
      {
        title: 'Le moteur de levain',
        body: (
          <>
            <P>Le levain est ce qu'il y a de plus difficile à planifier, car un levain vivant ne suit pas d'horloge fixe — son rythme change selon la façon dont il est conservé, depuis combien de temps il a été nourri, sa maturité, et la chaleur de votre cuisine. La plupart des outils ignorent tout cela et vous donnent un planning générique. Baker Hub le modélise.</P>

            <p style={{ margin: '14px 0 10px', ...monoSm, color: TERRA, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Ce qu'il vous demande</p>
            <P>Deux questions simples, sans jargon : <strong style={{color:CHAR}}>où votre levain a-t-il été conservé</strong> (température ambiante ou frigo) et <strong style={{color:CHAR}}>quand l'avez-vous nourri pour la dernière fois</strong> (d'aujourd'hui à il y a plus d'une semaine). Plus son niveau d'activité — mûr, jeune, ou de seigle. Cela suffit au moteur pour déduire tout le reste.</P>

            <p style={{ margin: '14px 0 10px', ...monoSm, color: TERRA, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Comment il lit votre levain</p>
            <P>À partir de ces réponses, il estime quand votre levain atteindra son prochain pic — la courte fenêtre où il est à pleine force et prêt pour le pétrissage. Ce timing dépend de la température : un levain en bonne santé atteint son pic environ <strong style={{color:CHAR}}>3 à 4 heures après le rafraîchi dans une cuisine tropicale</strong> (30–32°C), mais plutôt <strong style={{color:CHAR}}>6 à 9 heures dans une cuisine tempérée</strong> (22°C). Un levain jeune ou de seigle est encore plus lent. Le même levain, dans deux cuisines différentes, ce sont deux horloges différentes — et le moteur les traite comme telles.</P>

            <p style={{ margin: '14px 0 10px', ...monoSm, color: TERRA, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>La décision qu'il déroule</p>
            <P>Chaque plan suit le même cheminement honnête, dans cet ordre :</P>
            <BulletList items={[
              <><strong style={{color:CHAR}}>Votre levain est-il prêt, ou doit-il être réveillé ?</strong> Un levain nourri aujourd'hui à température ambiante peut déjà être proche de son pic. Un levain resté au frigo plusieurs jours doit d'abord être réactivé.</>,
              <><strong style={{color:CHAR}}>Combien de rafraîchis la réactivation demande-t-elle ?</strong> Cela dépend du temps de repos et de la maturité — jamais plus de travail que la biologie ne l'exige (section suivante).</>,
              <><strong style={{color:CHAR}}>Quand placer le rafraîchi final</strong> pour que le levain atteigne son pic exactement au moment du pétrissage ? Le moteur le calcule à rebours depuis votre heure de cuisson.</>,
              <><strong style={{color:CHAR}}>Ce moment tombe-t-il à une heure où vous êtes disponible ?</strong> Sinon, il tente de le déplacer — en décalant le rafraîchi, ou en suggérant un autre ratio de rafraîchi (ci-dessous).</>,
              <><strong style={{color:CHAR}}>Reste-t-il assez de temps pour que la pâte fermente correctement après le pétrissage ?</strong> Si l'heure de cuisson est trop juste pour bien faire les choses, le moteur le dit, plutôt que de vous remettre un plan qui ne tiendra pas.</>,
            ]} />
            <P>À chaque étape, il préfère un plan que vous pouvez réellement exécuter à un plan théoriquement parfait mais irréalisable.</P>

            <p style={{ margin: '14px 0 10px', ...monoSm, color: TERRA, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Réveiller un levain au frigo</p>
            <P>Un levain qui a séjourné au frigo doit être réactivé avant de pouvoir lever un pain, et la quantité de travail dépend de la durée du repos. Le moteur l'ajuste comme le ferait un boulanger expérimenté : un levain mûr nourri ces derniers jours ne demande qu'<strong style={{color:CHAR}}>un seul rafraîchi</strong> ; un levain resté au froid une semaine en demande <strong style={{color:CHAR}}>deux</strong>. Un levain jeune ou plus faible en reçoit un de plus qu'un levain mûr du même âge. Il ne demande jamais de travail inutile — et il ne vous envoie jamais cuire avec un levain qui n'a pas été correctement réveillé. Lorsqu'un second rafraîchi rendrait vraiment le pain plus doux et plus vigoureux, il le propose ; il ne l'impose pas.</P>

            <p style={{ margin: '14px 0 10px', ...monoSm, color: TERRA, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Ratio et timing du rafraîchi</p>
            <P>Le ratio auquel vous nourrissez (de 1:1:1 à 1:10:10) change la vitesse à laquelle votre levain atteint son pic — un rafraîchi plus important a plus de chemin à parcourir, il met donc plus de temps. C'est un levier discret mais puissant. Si votre moment de rafraîchi idéal tombe au milieu de la nuit ou de votre journée de travail, le moteur peut <strong style={{color:CHAR}}>recommander un autre ratio</strong> qui décale le pic vers une heure plus praticable, et vous explique en mots simples ce qu'il a changé et pourquoi — par exemple, faire passer un rafraîchi de 3h du matin à 7h en nourrissant à un ratio plus élevé. Vous gardez la main : conservez votre ratio habituel, ou suivez la suggestion.</P>

            <p style={{ margin: '14px 0 10px', ...monoSm, color: TERRA, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Planifié autour de votre vie</p>
            <P>Indiquez au moteur les heures où vous n'êtes pas disponible et il façonne tout le plan autour d'elles — les rafraîchis et le pétrissage lui-même sont déplacés hors de vos créneaux bloqués partout où la biologie le permet. Il ne prétendra pas qu'un rafraîchi à 3h du matin est idéal, mais il s'efforcera de ne pas vous le demander. Et il est honnête lorsqu'une heure de cuisson trop juste ne laisse tout simplement pas assez de marge : il vous le dit, et suggère la première heure de cuisson qui conviendrait.</P>

            <p style={{ margin: '14px 0 10px', ...monoSm, color: TERRA, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Le goût, si vous le souhaitez</p>
            <P>Un choix <strong style={{color:CHAR}}>Plus doux / Équilibré / Plus acidulé</strong> ajuste deux leviers à la fois : la durée de la pousse au froid de la pâte, et la façon dont le levain est rafraîchi. Plus acidulé s'appuie sur une pousse au froid plus longue et moins de rafraîchis — plus d'acidité, plus de profondeur. Plus doux utilise une pousse au froid plus courte et un rafraîchi supplémentaire — plus tendre, plus doux. Équilibré conserve le timing standard. Cela ajuste le planning que le moteur construit ; jamais vos ingrédients.</P>

            <p style={{ margin: '14px 0 10px', ...monoSm, color: TERRA, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Si vous suivez déjà votre levain</p>
            <p style={{ margin: 0, ...bodyText }}>Vous préférez surveiller votre pot vous-même ? Passez en mode <strong style={{color:CHAR}}>« Je sais quand mon levain sera à son pic »</strong> et donnez l'heure directement au moteur — il construit tout le plan à rebours à partir de là, sans passer par l'estimation.</p>
          </>
        ),
      },
      {
        title: 'Le moteur de levure',
        body: (
          <>
            <P>Le moteur de fermentation de Baker Hub est construit sur deux sources validées : la formule empirique de levure de Craig, développée et affinée par la communauté pizzamaking.com, et Modernist Pizza Vol. 4 (Nathan Myhrvold et al.), qui fournit les données empiriques de fermentation les plus complètes disponibles en impression.</P>
            <p style={{ marginBottom: '6px', ...bodyText }}><strong style={{ color: CHAR }}>Fermentation à température ambiante</strong></p>
            <p style={{ marginBottom: '14px' }}><Code>IDY% = 9.5 / (hours^1.65 × 2.5^((temp−25)/10))</Code></p>
            <p style={{ marginBottom: '6px', ...bodyText }}><strong style={{ color: CHAR }}>Fermentation en pousse froide</strong></p>
            <p style={{ marginBottom: '6px' }}><Code>IDY% = 7.5 / hours^1.313 ÷ Q10(fridgeTemp)</Code></p>
            <P>où Q10 = 2^((tempFrigo−4)/10). Un réfrigérateur plus chaud est plus actif — le moteur tient compte de votre température réelle de réfrigérateur en mode Custom. Par défaut : 6 °C (frigo domestique typique).</P>
            <p style={{ marginBottom: '6px', ...bodyText }}><strong style={{ color: CHAR }}>Mixte TA + froid</strong></p>
            <P>Une combinaison pondérée par l'activité où chaque phase est pondérée selon sa contribution à la fermentation. Validé par rapport aux tables de pâte en vrac de Modernist Pizza ; concordance entre 0 et 11 %.</P>
            <p style={{ marginBottom: '6px', ...bodyText }}><strong style={{ color: CHAR }}>Conversion du type de levure</strong></p>
            <P>Tous les calculs utilisent l'IDY comme référence interne. Levure sèche active = IDY × 1,33 · Levure fraîche = IDY × 3,0.</P>
            <p style={{ marginBottom: '6px', ...bodyText }}><strong style={{ color: CHAR }}>Correction climatique tropicale</strong></p>
            <P>30–32 °C : ÷1,15 · 33–35 °C : ÷1,25. S'applique aux phases TA de la pâte principale et à la fermentation du poolish TA.</P>
            <p style={{ marginBottom: '6px', ...bodyText }}><strong style={{ color: CHAR }}>Calibration du pré-ferment</strong></p>
            <P>La formule de Craig a été calibrée pour la pâte en vrac — 65 % d'hydratation, avec sel. Les pré-ferments nécessitent une correction :</P>
            <DataTable rows={PREF_TABLE_ROWS} />
            <p style={{ marginTop: '10px', ...bodyText }}>Validé par rapport aux tables de pré-ferments de Modernist Pizza ; toutes les valeurs dans ±20 % des données empiriques.</p>
            <p style={{ marginTop: '14px', marginBottom: '6px', ...bodyText }}><strong style={{ color: CHAR }}>Levain</strong></p>
            <p style={{ margin: 0, ...bodyText }}>L'activité du levain varie trop entre les cultures pour qu'une quantité précise en grammes soit significative. Baker Hub donne une fourchette de pourcentage (10–25 % de farine, ajustée au climat) et des repères visuels de maturité.</p>
          </>
        ),
      },
      {
        title: 'Le moteur de farine',
        body: (
          <>
            <P>La base de données farines de Baker Hub contient 285+ entrées. Chaque farine porte trois propriétés qui se cascadent à travers la recette et le planning :</P>
            <p style={{ marginBottom: '10px', ...bodyText }}><strong style={{ color: CHAR }}>Valeur W (Force W)</strong> — indice de force alvéographique mesurant l'extensibilité et la ténacité du gluten. Va de ~80 (farine faible pour gâteaux) à 400+ (Manitoba). Plus W est élevé = gluten plus fort = fermentation plus longue nécessaire pour le détendre et développer les saveurs. La farine W220 culmine en 4–6h TA. La farine W370 nécessite 48–96h au froid pour atteindre son meilleur. Scannez un sac de farine avec le scanner IA pour extraire W automatiquement, ou saisissez-le manuellement en mode Custom.</p>
            <p style={{ marginBottom: '10px', ...bodyText }}><strong style={{ color: CHAR }}>Delta d'hydratation</strong> — de combien décaler l'hydratation de base. Les farines fortes et riches en protéines absorbent plus d'eau ; les farines faibles en nécessitent moins. Pour les mélanges, les deltas sont pondérés par le ratio. Note : l'hydratation est définie après le planning — elle n'affecte pas la vitesse de fermentation dans les plages normales de boulangerie (55–80 %), uniquement la texture de la pâte, l'extensibilité et le caractère de la croûte.</p>
            <p style={{ marginBottom: '10px', ...bodyText }}><strong style={{ color: CHAR }}>Tolérance de fermentation (ftm)</strong> — un multiplicateur appliqué à la zone idéale du planificateur. ftm = 1,0 pour W250 (référence), 1,2 pour W300+, 0,85 pour W220. Cela scale la durée de pousse froide optimale, la zone idéale du poolish et la fenêtre de fermentation maximale utile. Deux boulangers utilisant le même style mais des farines différentes obtiennent des plannings recommandés différents — le boulanger W370 est orienté vers une pousse froide plus longue, le boulanger W220 vers une plus courte.</p>
            <p style={{ margin: 0, ...bodyText }}><strong style={{ color: CHAR }}>La levure est une sortie, pas une entrée.</strong> Baker Hub ne demande jamais de pourcentage de levure. Il le calcule à partir de vos heures de fermentation réelles et de la température avec la formule IDY% = 9,5 / (heures^1,65 × 2,5^((temp−25)/10)) en TA, et IDY% = 7,5 / heures^1,313 au froid. Modifiez votre planning et la levure se met à jour automatiquement. La tolérance de fermentation de la farine scale la zone idéale mais n'affecte pas directement la levure — la formule de levure s'ajuste déjà via le timing.</p>
          </>
        ),
      },
      {
        title: "Le moteur d'hydratation",
        body: (
          <>
            <P>L'hydratation n'est jamais un chiffre fixe unique. Baker Hub la construit en couches :</P>
            <NumberedList items={[
              <><strong style={{ color: CHAR }}>Base du style</strong> — chaque style a une cible (napolitaine 62 %, baguette 72 %, brioche 52 %, pan 70 %)</>,
              <><strong style={{ color: CHAR }}>Correction four</strong> — les fours à haute chaleur supportent une pâte plus sèche (−1 à −3 %) ; un four domestique standard bénéficie de plus d'humidité (+5 %)</>,
              <><strong style={{ color: CHAR }}>Ajustements de recette four</strong> — le type de four affecte aussi l'huile et le sucre. Un four à bois ou un four à pizza électrique à haute température n'a besoin ni d'huile ni de sucre. Un four domestique bénéficie de l'huile (brunissage, extensibilité) et d'une touche de sucre (coloration). Défini automatiquement, remplaçable en mode Custom.</>,
              <><strong style={{ color: CHAR }}>Correction climatique</strong> — chaud ou très humide : −2 % · Cuisine froide : +2 %</>,
              <><strong style={{ color: CHAR }}>Correction farine</strong> — delta d'hydratation de la farine appliqué (−5 % à +8 %)</>,
              <><strong style={{ color: CHAR }}>Plancher du style</strong> — minimum imposé quelles que soient les conditions (napolitaine : 56 %)</>,
            ]} />
            <p style={{ marginTop: '12px', margin: '12px 0 0', ...bodyText }}>En mode Custom, vous pouvez remplacer entièrement l'hydratation.</p>
          </>
        ),
      },
      {
        title: 'Sensibilité au pétrin',
        body: (
          <>
            <P>Votre pétrin modifie la recette de deux manières.</P>
            <p style={{ marginBottom: '6px', ...bodyText }}><strong style={{ color: CHAR }}>Température de l'eau — méthode DDT</strong></p>
            <p style={{ marginBottom: '10px' }}><Code>Water temp = (Target FDT × 3) − flour temp − kitchen temp − friction</Code></p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
              {['Spirale +8 °C', 'Robot +5 °C', 'À la main +1 °C', 'Sans pétrissage 0 °C'].map(l => (
                <span key={l} style={{ ...monoSm, padding: '3px 10px', borderRadius: '20px', background: 'rgba(26,22,18,0.06)' }}>{l}</span>
              ))}
            </div>
            <P>La FDT cible varie selon le style (napolitaine 23 °C, pâtes enrichies 22 °C). Dans les cuisines chaudes, la formule nécessite souvent de l'eau en dessous de 10 °C — c'est pourquoi Baker Hub recommande parfois de la glace.</P>
            <p style={{ margin: 0, ...bodyText }}><strong style={{ color: CHAR }}>Technique et timing :</strong> chaque pétrin a ses propres temps de pétrissage, nombre de rabats et poids maximum de pâte. Le guide étape par étape Bake Guide de Baker Hub est calibré à votre pétrin spécifique — y compris la technique professionnelle d'ajouter de la glace directement dans le bol d'un pétrin spiral pour les sessions en cuisine chaude.</p>
          </>
        ),
      },
      {
        title: 'Le moteur de planning',
        body: (
          <>
            <P>Le planificateur remonte depuis votre heure de cuisson cible. Pour chaque scénario, il évalue si un poolish, un biga ou une pâte directe produit le meilleur résultat compte tenu de votre fenêtre disponible.</P>
            <p style={{ margin: '0 0 10px', fontFamily: 'var(--font-dm-mono)', fontSize: '12px', color: TERRA, letterSpacing: '.04em' }}>FENÊTRES DE FERMENTATION À 22°C</p>
            <BulletList items={[
              <><strong style={{color:CHAR}}>{'< 5,5h'}</strong> — fenêtre trop courte pour un préferment. Pâte directe uniquement, cuisson le jour même.</>,
              <><strong style={{color:CHAR}}>5,5h – 9h</strong> — pâte directe. Pas de place pour une fermentation de poolish significative.</>,
              <><strong style={{color:CHAR}}>9h – 15,5h</strong> — poolish à température ambiante (jaune). En développement, utilisable, saveurs qui se construisent.</>,
              <><strong style={{color:CHAR}}>15,5h – 16,5h</strong> — poolish TA double vert. Zone de fermentation TA optimale.</>,
              <><strong style={{color:CHAR}}>16,5h – 26,5h</strong> — poolish au frigo double vert. Pousse froide pour des saveurs complexes.</>,
              <><strong style={{color:CHAR}}>{'> 26,5h'}</strong> — poolish au frigo + pousse froide complète 24h. Meilleure qualité possible.</>,
            ]} />
            <p style={{ marginTop: '14px', ...bodyText }}>Ces limites évoluent avec la température de la cuisine (plus chaud = fermentation plus rapide, fenêtres plus courtes) et le type de four (un préchauffage plus long décale la fenêtre minimale). La force de votre farine scale également la zone idéale — une farine W370 bénéficie d'une pousse froide plus longue qu'une W250.</p>
            <p style={{ margin: '14px 0 10px', fontFamily: 'var(--font-dm-mono)', fontSize: '12px', color: TERRA, letterSpacing: '.04em' }}>COMMENT L'HEURE DE PÉTRISSAGE EST CHOISIE</p>
            <BulletList items={[
              "Le moteur essaie poolish au frigo et poolish TA, choisit le mode avec le meilleur score. Le frigo gagne à égalité — la fermentation froide développe des saveurs plus complexes.",
              "Dans chaque mode, il cherche l'heure de pétrissage qui maximise la durée de pousse froide (meilleure saveur) tout en respectant vos heures bloquées.",
              "Si aucun créneau n'atteint le double vert, le meilleur jaune+vert disponible est retourné avec des cartes de statut honnêtes.",
              "Si tous les créneaux tombent dans des blockers, une popup explique vos options — pétrir juste avant/après votre fenêtre occupée, ou dedans.",
              "Tolérance blocker : la fermentation bulk peut commencer jusqu'à 30min avant un blocker — la pâte se retarde seule quand vous partez.",
            ]} />
            <p style={{ margin: '14px 0 0', ...bodyText }}>Deux boulangers avec la même recette mais des plannings, cuisines et farines différents obtiennent des quantités de levure différentes et des timings recommandés différents. C'est tout l'intérêt.</p>
          </>
        ),
      },
      {
        title: 'Lire le graphique de fermentation',
        body: (
          <>
            <P>Le graphique du mode Avancé est une visualisation en direct de la qualité — pas un planning, mais une image de la proximité de chaque étape avec son optimum biologique.</P>
            <div style={{ margin: '16px 0', borderRadius: '10px', background: 'rgba(26,22,18,0.03)', padding: '16px' }}>
              <svg viewBox="0 0 420 140" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
                <path d="M 30 120 Q 50 120 60 115 Q 70 108 75 85 Q 80 55 85 30 Q 90 55 95 85 Q 100 108 110 115 Q 120 120 140 120 Z" fill="rgba(212,168,83,0.25)" stroke="#D4A853" strokeWidth="1.5" />
                <text x="85" y="24" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="9" fill="#8A7F78">Poolish TA</text>
                <text x="85" y="34" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="8" fill="#8A7F78">pic étroit</text>
                <path d="M 155 120 Q 175 120 185 114 Q 195 105 198 90 Q 200 70 202 55 L 218 55 Q 220 70 222 90 Q 225 105 235 114 Q 245 120 265 120 Z" fill="rgba(212,168,83,0.25)" stroke="#D4A853" strokeWidth="1.5" />
                <line x1="202" y1="55" x2="218" y2="55" stroke="#D4A853" strokeWidth="1.5" />
                <text x="210" y="24" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="9" fill="#8A7F78">Poolish frigo</text>
                <text x="210" y="34" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="8" fill="#8A7F78">large plateau</text>
                <line x1="202" y1="48" x2="218" y2="48" stroke="#D4A853" strokeWidth="1" strokeDasharray="2,2" />
                <text x="210" y="46" textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="7" fill="#D4A853">plateau</text>
                <path d="M 285 120 Q 295 120 300 115 Q 305 108 308 95 Q 310 80 312 65 L 330 65 Q 332 80 334 95 Q 337 108 342 115 Q 350 120 390 120 Z" fill="rgba(107,122,90,0.2)" stroke="rgba(107,122,90,0.8)" strokeWidth="1.5" />
                <line x1="312" y1="65" x2="330" y2="65" stroke="rgba(107,122,90,0.8)" strokeWidth="1.5" />
                <text x="335" y="24" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="9" fill="#8A7F78">Pâte</text>
                <text x="335" y="34" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="8" fill="#8A7F78">pic à la cuisson</text>
                <rect x="279" y="113" width="8" height="8" transform="rotate(45 283 117)" fill="#D4A853" />
                <text x="283" y="134" textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="8" fill="#D4A853">pétrissage ◆</text>
                <polygon points="390,120 386,108 394,108" fill="#C4522A" />
                <text x="388" y="134" textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="8" fill="#C4522A">cuisson ▲</text>
                <line x1="30" y1="120" x2="400" y2="120" stroke="#E8E0D5" strokeWidth="1" />
                <text x="215" y="138" textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="8" fill="#8A7F78">← plus tôt ——————— temps ——————— cuisson →</text>
              </svg>
            </div>
            <p style={{ margin: '0 0 10px', ...bodyText }}><strong style={{ color: CHAR }}>Deux courbes, deux histoires.</strong> La courbe dorée est le préferment (poolish ou biga) — elle doit culminer au pétrissage (◆ doré). La courbe vert-gris est la pâte finale — elle doit culminer à la cuisson (▲ rouge). Quand les deux s’alignent, vous obtenez le meilleur résultat possible de votre planning.</p>
            <p style={{ margin: '0 0 10px', ...bodyText }}><strong style={{ color: CHAR }}>Les formes reflètent la biologie.</strong> La fermentation TA produit une cloche haute et étroite — la levure culmine vite et décline vite ; une petite erreur de timing a un grand effet. La pousse froide produit un large plateau — biologie plus lente, fenêtre bien plus large. C’est pourquoi le froid est préféré : il pardonne.</p>
            <p style={{ margin: '0 0 10px', ...bodyText }}><strong style={{ color: CHAR }}>Les pastilles de statut.</strong> 🟢 Prêt = sur le plateau. 🟡 En développement = proche du pic, utilisable mais pas optimal. Quand aucune fenêtre de préferment viable n’existe, la courbe dorée disparaît — la carte recommande la pâte directe.</p>
            <p style={{ margin: 0, ...bodyText }}><strong style={{ color: CHAR }}>Interagissez avec le graphique.</strong> Glissez le losange doré pour ajuster le départ du préferment, le losange vert pour l’heure de pétrissage. Les deux courbes se mettent à jour en temps réel. <em>Revenir à la recommandation</em> replace tout à l’optimum calculé.</p>
          </>
        ),
      },
      {
        title: 'Comment fonctionne le timing du préferment',
        body: (
          <>
            <P>Quand votre recette inclut un poolish ou un biga, Baker Hub cherche un planning où le préferment et la pâte finale sont simultanément dans leurs fenêtres de fermentation optimales. Il ne suffit pas qu'un seul soit prêt — les deux doivent s'aligner.</P>
            <P>Le graphique de fermentation affiche deux courbes en cloche. La courbe du préferment culmine au moment du pétrissage ; la courbe de la pâte culmine au moment de la cuisson. Les pastilles vertes signifient que les deux sont sur cible. Jaune signifie en développement mais utilisable. Le graphique disparaît quand aucune fenêtre de préferment viable n'existe — le boulanger est clairement invité à passer en pâte directe.</P>
            <P>Chaque type de préferment a sa propre fenêtre idéale, façonnée par la température et la force de la farine :</P>
            <BulletList items={[
              <><strong style={{color:CHAR}}>Poolish au frigo</strong> — optimal vers 13h au froid à 6°C (plateau ±5h). Nécessite au moins 16,5h de fenêtre de planification totale. Pousse froide plus longue = saveurs plus complexes. Le W de la farine scale cela : une farine W370 bénéficie d'un poolish plus long qu'une W250.</>,
              <><strong style={{color:CHAR}}>Poolish à température ambiante</strong> — pic en ~9h à 22°C, plus rapide en cuisine chaude, plus lent en cuisine froide. Fenêtre plus étroite (±1,5h). Le moteur essaie le poolish TA en fallback quand la fenêtre frigo est trop courte — si le TA score plus haut, le TA gagne.</>,
              <><strong style={{color:CHAR}}>Biga</strong> — toujours au froid. Pâte rigide (50% d'hydratation) qui fermente lentement sur 38–58h. Large plateau, le plus indulgent. Jamais en TA — un biga à température ambiante sur-acidifie en quelques heures.</>,
            ]} />
            <P>Le scoring est transparent : score 4 = double vert (optimal), score 3 = un vert + un jaune (bien), score 2 ou moins = pâte directe recommandée. Le moteur choisit toujours le score le plus élevé disponible, puis utilise la durée de pousse froide comme critère de départage — plus de froid = meilleure saveur à égalité.</P>
            <p style={{ margin: '14px 0 0', ...bodyText }}>
              <strong style={{ color: CHAR }}>Conscience des blockers.</strong> Le moteur respecte vos heures bloquées pour placer le début du poolish et l'heure de pétrissage. Si votre blocker Nuits (22h–7h) est actif, le pétrissage est repoussé juste après 7h. La fermentation bulk peut commencer jusqu'à 30min avant un blocker — la pâte se retarde seule quand vous partez.
            </p>
          </>
        ),
      },
      {
        title: "Maestro — l'aide en chemin",
        body: (
          <p style={{ margin: 0, ...bodyText }}>À des étapes clés du Bake Guide, vous pouvez photographier votre pâte ou votre pizza et demander à Maestro un retour. Maestro connaît votre type de four, votre style et l'étape où vous en êtes — les conseils sont donc contextuels, pas génériques. Léopardage, structure de la mie, couleur de la croûte, signes de fermentation. Un ami connaisseur qui regarde par-dessus votre épaule.</p>
        ),
      },
      {
        title: 'Ce que nous ne modélisons pas',
        body: (
          <>
            <p style={{ marginBottom: '8px', ...bodyText }}>Honnête sur nos limites :</p>
            <BulletList items={[
              "Variation des protéines de farine entre différents sacs d'une même marque (W peut varier de ±15 %)",
              "L'hydratation exacte de votre levain et l'état précis des micro-organismes qu'il contient — le moteur modélise le stockage, l'âge du dernier rafraîchi, la maturité et la température de la cuisine, mais il ne peut pas voir votre pot précis. Utilisez le réglage d'activité et, si vous suivez les pics vous-même, l'option « Je sais quand mon levain sera à son pic » pour le meilleur ajustement.",
              "Effets de l'altitude sur la fermentation",
              "Effets de la dureté et de la teneur minérale de l'eau sur la levure",
              "Variation de masse thermique entre modèles spécifiques de fours domestiques",
            ]} />
          </>
        ),
      },
      {
        title: 'Sessions — sauvegarder, reprendre, refaire, partager',
        body: (
          <>
            <P>Connectez-vous (lien magique ou Google) et chaque fournée devient une <strong style={{ color: CHAR }}>session</strong> à laquelle vous pouvez revenir. Toute votre configuration est sauvegardée — pâte, planning, état du levain, sélections de pizzas, et photos du résultat.</P>
            <BulletList items={[
              <><strong style={{color:CHAR}}>Reprendre</strong> — rouvrez une session exactement là où vous l'aviez laissée, sur l'onglet que vous utilisiez. Pas connecté ? Votre session en cours reste conservée sur cet appareil.</>,
              <><strong style={{color:CHAR}}>Refaire</strong> — un tap clone une fournée réussie sur le prochain jour et horaire équivalents, avec tout le planning et vos créneaux bloqués décalés d'autant. Les boulangers refont leurs succès.</>,
              <><strong style={{color:CHAR}}>Photos</strong> — ajoutez des photos de chaque fournée et construisez votre journal de boulange au fil du temps.</>,
              <><strong style={{color:CHAR}}>Partager</strong> — exportez une session en carte (format post, carré ou story) avec recette, planning et photos. Taguez <strong style={{color:CHAR}}>@bakerhub</strong> et <strong style={{color:CHAR}}>#BakerHub</strong> — si vous faites quelque chose dont vous êtes fier, nous serions ravis de le voir.</>,
            ]} />
          </>
        ),
      },
      {
        title: 'Bêta & retours',
        body: (
          <>
            <P>Baker Hub est activement développé comme projet personnel. Des problèmes surviennent parfois. Si une quantité de levure semble incorrecte, si le planning ne convient pas, ou si quelque chose est simplement confus — dites-le nous. Chaque retour améliore le moteur.</P>
            <div style={{ background: 'rgba(26,22,18,0.04)', borderRadius: '10px', padding: '16px', marginTop: '12px' }}>
              <p style={{ margin: '0 0 4px', fontFamily: 'DM Sans, sans-serif', fontSize: '14px', fontWeight: 600, color: CHAR }}>Construit par Rom</p>
              <p style={{ margin: '0 0 12px' }}>
                <a href="mailto:rom@bakerhub.app" style={{ color: TERRA, fontFamily: 'DM Sans, sans-serif', fontSize: '14px', textDecoration: 'none' }}>rom@bakerhub.app</a>
              </p>
              <p style={{ margin: 0, fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: SMOKE, fontStyle: 'italic' }}>
                &laquo; Qu'est-ce qui rendrait Baker Hub plus utile pour vous ? Une ligne suffit. &raquo;
              </p>
            </div>
          </>
        ),
      },
    ],
  },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function AboutClient() {
  const locale = useLocale();
  const c = (CONTENT[locale] ?? CONTENT.en) as LocaleContent;

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh', paddingBottom: '48px' }}>
      <Header hideActionBar backHref={locale === 'fr' ? '/fr' : '/'} />
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>

        <h1 style={{
          fontFamily: 'Playfair Display, serif', fontSize: '28px', fontWeight: 700,
          color: CHAR, marginBottom: '4px', marginTop: '0',
        }}>{c.pageTitle}</h1>
        <p style={{ ...monoSm, marginBottom: '12px' }}>{c.pageSubtitle}</p>

        {c.sections.map((s, i) => (
          <Accordion key={i} title={s.title} defaultOpen={s.defaultOpen}>
            {s.body}
          </Accordion>
        ))}

        {/* Way home at the end of the read — the header chip covers mid-scroll */}
        <Link
          href={locale === 'fr' ? '/fr' : '/'}
          style={{
            marginTop: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '13px 0', borderRadius: '12px',
            background: TERRA, color: '#fff',
            fontSize: '13.5px', fontWeight: 500,
            fontFamily: 'DM Sans, sans-serif', textDecoration: 'none',
          }}
        >
          ← {locale === 'fr' ? 'Retour à Baker Hub' : 'Back to Baker Hub'}
        </Link>

        <div style={{ borderTop: `1px solid ${BORDER}` }} />
        <p style={{ ...monoSm, textAlign: 'center', marginTop: '24px', marginBottom: 0 }}>
          {c.footer}
        </p>

      </div>
    </div>
  );
}
