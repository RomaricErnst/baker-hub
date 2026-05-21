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
            <P>Most baking recipes assume you have a free afternoon, a 20°C kitchen, and nothing else to do. Most of us don't have any of those things.</P>
            <P>Baker Hub was built for the serious home baker who bakes around real life — a day job, a family dinner, a pizza night that needs to happen on Saturday at 7pm, not whenever the dough feels like being ready. You tell Baker Hub when you want to eat. It works out when to start, how much yeast to use, and what to do at each step.</P>
            <P>It's also built for hot kitchens. Every fermentation formula in every book was developed in a temperate kitchen at 18–22°C. In a hotter climate, those formulas consistently over-ferment your dough. Baker Hub's tropical fermentation engine corrects for this from first principles.</P>
            <P>And it's built for the full pizza night — not just the dough, but the whole evening. Choosing what to make, scaling toppings for a group, building a shopping list, tracking what gets baked. The Pizza Party feature turns a complex multi-pizza evening into something you can actually plan — and share.</P>
            <p style={{ margin: 0, ...bodyText }}>An honest note: Baker Hub is a side project, built by someone who codes with AI assistance and tests recipes in a real kitchen. The AI writes the code. The science, the product decisions, and the baking happen in the real world. This means the app moves fast, breaks occasionally, and gets better with every bake.</p>
          </>
        ),
      },
      {
        title: 'Share your bakes',
        body: (
          <>
            <P>Baker Hub lets you share your session — recipe, schedule, and pizza selections — as a card you can post on Instagram or send to friends. If you make something you're proud of, we'd love to see it.</P>
            <p style={{ margin: 0, ...bodyText }}>Tag <strong style={{ color: CHAR }}>@bakerhub</strong> and <strong style={{ color: CHAR }}>#BakerHub</strong>.</p>
          </>
        ),
      },
      {
        title: 'Pizza Party — from dough to table',
        body: (
          <>
            <P>The Pizza Party feature is built around a simple idea: once you've planned your dough, the rest of the evening should plan itself too.</P>
            <P><strong style={{ color: CHAR }}>212 curated recipes.</strong> Baker Hub's pizza database covers 200 savoury pizzas and 12 dessert finales — each handpicked, not generated. Organised by tradition, occasion, taste, and dietary need so you can find the right pizza for the right moment.</P>
            <div style={{
              background: 'rgba(212,168,83,0.06)', borderLeft: `2px solid ${GOLD}`,
              borderRadius: '8px', padding: '12px', marginBottom: '12px',
              fontFamily: 'var(--font-dm-mono)', fontSize: '12px', color: SMOKE,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { cat: 'Classic Neapolitan & Roman', detail: '60+ recipes' },
                  { cat: 'American styles', detail: 'New York, Detroit, Pan' },
                  { cat: 'French regional', detail: 'Normandie, Provence, Alsace, Basque, Savoie' },
                  { cat: 'Italian regional', detail: 'Sicilian, Ligurian, Venetian, Calabrian' },
                  { cat: 'Modern & fusion', detail: 'Japanese, Korean, Spanish, Middle Eastern' },
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
                { label: 'Impress (109)',    bg: 'rgba(26,22,18,0.06)', color: CHAR },
                { label: 'Party (50)',       bg: 'rgba(26,22,18,0.06)', color: CHAR },
                { label: 'Classic (75)',     bg: 'rgba(26,22,18,0.06)', color: CHAR },
                { label: 'Quick prep (33)', bg: 'rgba(26,22,18,0.06)', color: CHAR },
                { label: 'Kids (28)',        bg: 'rgba(26,22,18,0.06)', color: CHAR },
                { label: 'Spicy (11)',       bg: 'rgba(26,22,18,0.06)', color: CHAR },
              ].map(p => <Pill key={p.label} bg={p.bg} color={p.color}>{p.label}</Pill>)}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
              {['Vegetarian (64)', 'No pork (75)', 'Halal (73)', 'Kosher (62)', 'Pescatarian (16)', 'No nuts (127)'].map(l => (
                <Pill key={l} bg="rgba(107,122,90,0.12)" color={SAGE}>{l}</Pill>
              ))}
            </div>
            <P>Each pizza is matched to compatible dough styles — a Marinara won't appear for pan pizza, a Detroit won't show for Neapolitan. Suggestions always match what your dough can actually do.</P>
            <P><strong style={{ color: CHAR }}>Prep guidance, scaled to your group.</strong> The Prep tab generates a full ingredient preparation timeline working backwards from your bake time — drain the mozzarella 30 minutes before, slice the charcuterie 15 minutes before, tear the basil just before serving. Quantities scale automatically to your pizza count.</P>
            <p style={{ margin: 0, ...bodyText }}><strong style={{ color: CHAR }}>Shopping list.</strong> Combined dough ingredients and toppings in one list. Check items off as you go.</p>
          </>
        ),
      },
      {
        title: 'The yeast engine',
        body: (
          <>
            <P>Baker Hub's fermentation engine is built on two validated sources: Craig's empirical yeast formula, developed and refined by the pizzamaking.com community, and Modernist Pizza Vol. 4 (Nathan Myhrvold et al.), which provides the most comprehensive empirical fermentation dataset available in print.</P>
            <p style={{ marginBottom: '6px', ...bodyText }}><strong style={{ color: CHAR }}>Room temperature fermentation</strong></p>
            <p style={{ marginBottom: '14px' }}><Code>IDY% = 9.5 / (hours^1.65 × 2.5^((temp−25)/10))</Code></p>
            <p style={{ marginBottom: '6px', ...bodyText }}><strong style={{ color: CHAR }}>Cold retard fermentation</strong></p>
            <p style={{ marginBottom: '6px' }}><Code>IDY% = 7.5 / hours^1.313 ÷ Q10(fridgeTemp)</Code></p>
            <P>where Q10 = 2^((fridgeTemp−4)/10). A warmer fridge is more active — the engine accounts for your actual fridge temperature in Custom mode. Default: 4°C.</P>
            <p style={{ marginBottom: '6px', ...bodyText }}><strong style={{ color: CHAR }}>Mixed RT + cold</strong></p>
            <P>An activity-weighted combination where each phase is weighted by its fermentation contribution. Validated against Modernist Pizza bulk dough tables; agreement within 0–11%.</P>
            <p style={{ marginBottom: '6px', ...bodyText }}><strong style={{ color: CHAR }}>Yeast type conversion</strong></p>
            <P>All calculations use IDY as the internal reference. Active Dry Yeast = IDY × 1.33 · Fresh yeast = IDY × 3.0.</P>
            <p style={{ marginBottom: '6px', ...bodyText }}><strong style={{ color: CHAR }}>Tropical climate correction</strong></p>
            <P>30–32°C: ÷1.15 · 33–35°C: ÷1.25. Applies to both main dough RT phases and RT poolish fermentation.</P>
            <p style={{ marginBottom: '6px', ...bodyText }}><strong style={{ color: CHAR }}>Preferment calibration</strong></p>
            <P>Craig's formula was calibrated for bulk dough — 65% hydration, with salt. Preferments require correction:</P>
            <DataTable rows={PREF_TABLE_ROWS} />
            <p style={{ marginTop: '10px', ...bodyText }}>Validated against Modernist Pizza preferment tables; all values within ±20% of empirical data.</p>
            <p style={{ marginTop: '14px', marginBottom: '6px', ...bodyText }}><strong style={{ color: CHAR }}>Sourdough</strong></p>
            <p style={{ margin: 0, ...bodyText }}>Starter activity varies too much between cultures for a precise gram quantity to be meaningful. Baker Hub gives a percentage range (10–25% of flour, climate-adjusted) and visual readiness cues.</p>
          </>
        ),
      },
      {
        title: 'Flour engine',
        body: (
          <>
            <P>Baker Hub's flour database contains 285+ entries. Each flour carries three properties that cascade through the recipe and schedule:</P>
            <p style={{ marginBottom: '10px', ...bodyText }}><strong style={{ color: CHAR }}>W value (Force W)</strong> — alveograph strength index measuring gluten extensibility and tenacity. Ranges from ~80 (weak cake flour) to 400+ (Manitoba strong flour). Higher W = stronger gluten = longer fermentation needed to relax it and develop flavour. W220 flour peaks at 4–6h RT. W370 flour needs 48–96h cold to reach its best. Scan a flour bag with the AI scanner to extract W automatically, or enter it manually in Custom mode.</p>
            <p style={{ marginBottom: '10px', ...bodyText }}><strong style={{ color: CHAR }}>Hydration delta</strong> — how much to shift the baseline hydration. Strong, high-protein flours absorb more water; weak flours need less. For blends, deltas are weighted by ratio. Note: hydration is set after scheduling — it does not affect fermentation speed at normal baking ranges (55–80%), only dough texture, extensibility, and crust character.</p>
            <p style={{ marginBottom: '10px', ...bodyText }}><strong style={{ color: CHAR }}>Fermentation tolerance (ftm)</strong> — a multiplier applied to the scheduler's sweet zone. ftm = 1.0 for W250 (baseline), 1.2 for W300+, 0.85 for W220. This scales the optimal cold retard duration, the poolish sweet spot, and the maximum useful fermentation window. Two bakers using the same style but different flour get different recommended schedules — the W370 baker is nudged toward a longer cold retard, the W220 baker toward a shorter one.</p>
            <p style={{ margin: 0, ...bodyText }}><strong style={{ color: CHAR }}>Yeast is an output, not an input.</strong> Baker Hub never asks for yeast percentage. It computes it from your actual fermentation hours and temperature using the formula IDY% = 9.5 / (hours^1.65 × 2.5^((temp−25)/10)) for RT, and IDY% = 7.5 / hours^1.313 for cold. Change your schedule and yeast updates automatically. The flour's fermentation tolerance scales the sweet zone but does not directly affect yeast — the yeast formula already adjusts through the timing.</p>
          </>
        ),
      },
      {
        title: 'Hydration engine',
        body: (
          <>
            <P>Hydration is never a single fixed number. Baker Hub builds it in layers:</P>
            <NumberedList items={[
              <><strong style={{ color: CHAR }}>Style baseline</strong> — each style has a target (Neapolitan 62%, baguette 72%, brioche 52%, pan 70%)</>,
              <><strong style={{ color: CHAR }}>Oven correction</strong> — high-heat ovens handle a drier dough (−1 to −3%); a standard home oven benefits from more moisture (+5%)</>,
              <><strong style={{ color: CHAR }}>Oven recipe adjustments</strong> — oven type affects oil and sugar too. A wood-fired or electric pizza oven at high heat needs no oil or sugar. A home oven benefits from oil (browning, extensibility) and a touch of sugar (colour). Set automatically, overridable in Custom mode.</>,
              <><strong style={{ color: CHAR }}>Climate correction</strong> — hot or very humid: −2% · Cold kitchen: +2%</>,
              <><strong style={{ color: CHAR }}>Flour correction</strong> — flour hydration delta applied (−5% to +8%)</>,
              <><strong style={{ color: CHAR }}>Style floor</strong> — minimum enforced regardless (Neapolitan: 56%)</>,
            ]} />
            <p style={{ marginTop: '12px', margin: '12px 0 0', ...bodyText }}>In Custom mode, you can override hydration entirely.</p>
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
              {['Spiral +7°C', 'Stand +4°C', 'By hand +1°C', 'No-knead 0°C'].map(l => (
                <span key={l} style={{ ...monoSm, padding: '3px 10px', borderRadius: '20px', background: 'rgba(26,22,18,0.06)' }}>{l}</span>
              ))}
            </div>
            <P>Target FDT varies by style (Neapolitan 23°C, enriched doughs 22°C). In hot kitchens the formula often requires water below 10°C — which is why Baker Hub sometimes recommends ice.</P>
            <p style={{ margin: 0, ...bodyText }}><strong style={{ color: CHAR }}>Technique and timing:</strong> each mixer has its own kneading time, fold count, and max dough weight. Baker Hub's step-by-step Bake Guide is calibrated to your specific mixer — including the professional technique of adding ice directly to the bowl in a spiral mixer for hot kitchen sessions.</p>
          </>
        ),
      },
      {
        title: 'Schedule engine',
        body: (
          <>
            <P>The scheduler works backwards from your target bake time. For each scenario it evaluates whether a poolish, biga, or direct dough produces the best result given your available window.</P>
            <p style={{ margin: '0 0 10px', fontFamily: 'var(--font-dm-mono)', fontSize: '12px', color: TERRA, letterSpacing: '.04em' }}>FERMENTATION WINDOWS AT 22°C</p>
            <BulletList items={[
              <><strong style={{color:CHAR}}>{'< 5.5h'}</strong> — window too short for preferment. Direct dough only, same-day bake.</>,
              <><strong style={{color:CHAR}}>5.5h – 9h</strong> — direct dough. No room for meaningful poolish fermentation.</>,
              <><strong style={{color:CHAR}}>9h – 15.5h</strong> — room-temperature poolish (yellow). Developing, usable, flavour building.</>,
              <><strong style={{color:CHAR}}>15.5h – 16.5h</strong> — RT poolish double green. Peak RT fermentation zone.</>,
              <><strong style={{color:CHAR}}>16.5h – 26.5h</strong> — fridge poolish double green. Cold retard for complex flavour.</>,
              <><strong style={{color:CHAR}}>{'> 26.5h'}</strong> — fridge poolish + full 24h dough cold retard. Best possible quality.</>,
            ]} />
            <p style={{ marginTop: '14px', ...bodyText }}>These boundaries shift with kitchen temperature (hotter = faster fermentation, shorter windows) and oven type (longer preheat shifts the minimum window). Your flour strength also scales the sweet spot — a W370 flour benefits from a longer cold retard than a W250.</p>
            <p style={{ margin: '14px 0 10px', fontFamily: 'var(--font-dm-mono)', fontSize: '12px', color: TERRA, letterSpacing: '.04em' }}>HOW MIX TIME IS CHOSEN</p>
            <BulletList items={[
              'The engine tries both fridge poolish and RT poolish, picks the mode with the highest score. Fridge wins ties — cold fermentation develops more complex flavour.',
              'Within each mode it searches for the mix time that maximises cold retard duration (better flavour) while respecting your blocked hours.',
              'If no slot scores double green, the best available yellow+green is returned with honest status cards.',
              'If all slots fall inside blockers, a fallback popup explains your options — mix just before/after your busy window, or inside it.',
              'Blocker tolerance: bulk fermentation can start up to 30min before a blocker begins — the dough retards itself once you leave.',
            ]} />
            <p style={{ margin: '14px 0 0', ...bodyText }}>Two bakers with the same recipe but different schedules, kitchens, and flour get different yeast quantities and different recommended timings. That's the point.</p>
          </>
        ),
      },
      {
        title: 'How preferment timing works',
        body: (
          <>
            <P>When your recipe includes a poolish or biga, Baker Hub looks for a schedule where both the preferment and the final dough are in their optimal fermentation windows simultaneously. It's not enough for one to be ready — both need to align.</P>
            <P>The fermentation chart shows two bell curves. The preferment curve peaks at mix time; the dough curve peaks at bake time. Green pills mean both are on target. Yellow means developing but usable. The graph disappears when no viable preferment window exists — the baker is told clearly to go direct.</P>
            <P>Each preferment type has a different sweet spot, shaped by temperature and flour strength:</P>
            <BulletList items={[
              <><strong style={{color:CHAR}}>Fridge poolish</strong> — optimal around 13h cold at 6°C (±5h plateau). Requires at least 16.5h total planning window. Longer cold retard = more complex flavour. Flour W scales this: W370 flour benefits from a longer poolish than W250.</>,
              <><strong style={{color:CHAR}}>Room-temperature poolish</strong> — peaks in ~9h at 22°C, faster in hot kitchens, slower in cold ones. Narrower window (±1.5h). The engine tries RT poolish as a fallback when the fridge window is too short — if RT scores higher, RT wins.</>,
              <><strong style={{color:CHAR}}>Biga</strong> — always cold. Stiff dough (50% hydration) ferments slowly over 38–58h. Wide plateau, most forgiving. Never RT — a room-temperature biga over-acidifies within hours.</>,
            ]} />
            <P>Scoring is transparent: score 4 = both green (optimal), score 3 = one green + one yellow (good), score 2 or below = direct dough recommended. The engine always picks the highest available score, then uses cold retard duration as the tiebreaker — more retard = better flavour when everything else is equal.</P>
            <p style={{ margin: '14px 0 0', ...bodyText }}>
              <strong style={{ color: CHAR }}>Blocker awareness.</strong> The engine respects your blocked hours when placing both poolish start and mix time. If your Nights blocker (10pm–7am) is active, mix is pushed to just after 7am. Bulk fermentation can start up to 30min before a blocker begins — the dough retards itself once you step away.
            </p>
          </>
        ),
      },
      {
        title: 'Maestro — help along the way',
        body: (
          <p style={{ margin: 0, ...bodyText }}>At key steps in the Bake Guide, you can photograph your dough or pizza and ask Maestro for feedback. Maestro knows your oven type, your style, and what stage you're at — so the guidance is contextual, not generic. Leoparding, crumb structure, crust colour, fermentation signs. A knowledgeable friend looking over your shoulder.</p>
        ),
      },
      {
        title: "What we don't model",
        body: (
          <>
            <p style={{ marginBottom: '8px', ...bodyText }}>Honest about limits:</p>
            <BulletList items={[
              'Flour protein variation between bags of the same brand (W can vary ±15%)',
              'Sourdough starter activity differences between cultures',
              'Altitude effects on fermentation',
              'Water hardness and mineral content effects on yeast',
              'Thermal mass variation between specific home oven models',
            ]} />
          </>
        ),
      },
      {
        title: 'Beta & feedback',
        body: (
          <>
            <P>Baker Hub is actively developed as a side project. Things will occasionally break. If a yeast quantity seems wrong, the schedule doesn't fit, or something is just confusing — please tell us. Every piece of feedback makes the engine better.</P>
            <div style={{ background: 'rgba(26,22,18,0.04)', borderRadius: '10px', padding: '16px', marginTop: '12px' }}>
              <p style={{ margin: '0 0 4px', fontFamily: 'DM Sans, sans-serif', fontSize: '14px', fontWeight: 600, color: CHAR }}>Built by Rom</p>
              <p style={{ margin: '0 0 12px' }}>
                <a href="mailto:rom@bakerhub.app" style={{ color: TERRA, fontFamily: 'DM Sans, sans-serif', fontSize: '14px', textDecoration: 'none' }}>rom@bakerhub.app</a>
              </p>
              <p style={{ margin: 0, fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: SMOKE, fontStyle: 'italic' }}>
                &ldquo;What would make Baker Hub more useful for you? One line is enough.&rdquo;
              </p>
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
        title: 'Partagez vos fournées',
        body: (
          <>
            <P>Baker Hub vous permet de partager votre session — recette, planning et sélections de pizzas — sous forme de carte à publier sur Instagram ou à envoyer à des amis. Si vous faites quelque chose dont vous êtes fier, nous serions ravis de le voir.</P>
            <p style={{ margin: 0, ...bodyText }}>Taguez <strong style={{ color: CHAR }}>@bakerhub</strong> et <strong style={{ color: CHAR }}>#BakerHub</strong>.</p>
          </>
        ),
      },
      {
        title: 'Pizza Party — de la pâte à la table',
        body: (
          <>
            <P>La fonction Pizza Party est construite autour d'une idée simple : une fois que vous avez planifié votre pâte, le reste de la soirée devrait s'organiser tout seul.</P>
            <P><strong style={{ color: CHAR }}>212 recettes sélectionnées.</strong> La base de données pizzas de Baker Hub couvre 200 pizzas salées et 12 desserts — chacun choisi à la main, pas généré. Organisés par tradition, occasion, goût et régime alimentaire pour trouver la bonne pizza au bon moment.</P>
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
        title: 'Le moteur de levure',
        body: (
          <>
            <P>Le moteur de fermentation de Baker Hub est construit sur deux sources validées : la formule empirique de levure de Craig, développée et affinée par la communauté pizzamaking.com, et Modernist Pizza Vol. 4 (Nathan Myhrvold et al.), qui fournit les données empiriques de fermentation les plus complètes disponibles en impression.</P>
            <p style={{ marginBottom: '6px', ...bodyText }}><strong style={{ color: CHAR }}>Fermentation à température ambiante</strong></p>
            <p style={{ marginBottom: '14px' }}><Code>IDY% = 9.5 / (hours^1.65 × 2.5^((temp−25)/10))</Code></p>
            <p style={{ marginBottom: '6px', ...bodyText }}><strong style={{ color: CHAR }}>Fermentation en pousse froide</strong></p>
            <p style={{ marginBottom: '6px' }}><Code>IDY% = 7.5 / hours^1.313 ÷ Q10(fridgeTemp)</Code></p>
            <P>où Q10 = 2^((tempFrigo−4)/10). Un réfrigérateur plus chaud est plus actif — le moteur tient compte de votre température réelle de réfrigérateur en mode Custom. Par défaut : 4 °C.</P>
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
              {['Spirale +7 °C', 'Robot +4 °C', 'À la main +1 °C', 'Sans pétrissage 0 °C'].map(l => (
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
              "Différences d'activité du levain entre cultures",
              "Effets de l'altitude sur la fermentation",
              "Effets de la dureté et de la teneur minérale de l'eau sur la levure",
              "Variation de masse thermique entre modèles spécifiques de fours domestiques",
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
      <Header hideActionBar />
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>

        <h1 style={{
          fontFamily: 'Playfair Display, serif', fontSize: '28px', fontWeight: 700,
          color: CHAR, marginBottom: '4px', marginTop: '0',
        }}>{c.pageTitle}</h1>
        <p style={{ ...monoSm, marginBottom: '12px' }}>{c.pageSubtitle}</p>
        <Link
          href={locale === 'fr' ? '/fr' : '/'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontFamily: 'var(--font-dm-mono)', fontSize: '11px',
            color: SMOKE, textDecoration: 'none', marginBottom: '24px',
          }}
        >
          ← {locale === 'fr' ? 'Retour' : 'Back to Baker Hub'}
        </Link>

        {c.sections.map((s, i) => (
          <Accordion key={i} title={s.title} defaultOpen={s.defaultOpen}>
            {s.body}
          </Accordion>
        ))}

        <div style={{ borderTop: `1px solid ${BORDER}` }} />
        <p style={{ ...monoSm, textAlign: 'center', marginTop: '24px', marginBottom: 0 }}>
          {c.footer}
        </p>

      </div>
    </div>
  );
}
