'use client';
import { useState } from 'react';

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

export default function AboutClient() {
  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh', paddingBottom: '48px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>

        <h1 style={{
          fontFamily: 'Playfair Display, serif', fontSize: '28px', fontWeight: 700,
          color: CHAR, marginBottom: '4px', marginTop: '0',
        }}>About Baker Hub</h1>
        <p style={{ ...monoSm, marginBottom: '32px' }}>How it works · Why it exists</p>

        {/* ── Section 1 ── */}
        <Accordion title="Why Baker Hub exists" defaultOpen>
          <P>Most baking recipes assume you have a free afternoon, a 20°C kitchen, and nothing else to do. Most of us don't have any of those things.</P>
          <P>Baker Hub was built for the serious home baker who bakes around real life — a day job, a family dinner, a pizza night that needs to happen on Saturday at 7pm, not whenever the dough feels like being ready. You tell Baker Hub when you want to eat. It works out when to start, how much yeast to use, and what to do at each step.</P>
          <P>It's also built for hot kitchens. Every fermentation formula in every book was developed in a temperate kitchen at 18–22°C. In a hotter climate, those formulas consistently over-ferment your dough. Baker Hub's tropical fermentation engine corrects for this from first principles.</P>
          <P>And it's built for the full pizza night — not just the dough, but the whole evening. Choosing what to make, scaling toppings for a group, building a shopping list, tracking what gets baked. The Pizza Party feature turns a complex multi-pizza evening into something you can actually plan — and share.</P>
          <p style={{ margin: 0, ...bodyText }}>An honest note: Baker Hub is a side project, built by someone who codes with AI assistance and tests recipes in a real kitchen. The AI writes the code. The science, the product decisions, and the baking happen in the real world. This means the app moves fast, breaks occasionally, and gets better with every bake.</p>
        </Accordion>

        {/* ── Section 2 ── */}
        <Accordion title="Share your bakes">
          <P>Baker Hub lets you share your session — recipe, schedule, and pizza selections — as a card you can post on Instagram or send to friends. If you make something you're proud of, we'd love to see it.</P>
          <p style={{ margin: 0, ...bodyText }}>Tag <strong style={{ color: CHAR }}>@bakerhub</strong> and <strong style={{ color: CHAR }}>#BakerHub</strong>.</p>
        </Accordion>

        {/* ── Section 3 ── */}
        <Accordion title="Pizza Party — from dough to table">
          <P>The Pizza Party feature is built around a simple idea: once you've planned your dough, the rest of the evening should plan itself too.</P>
          <P><strong style={{ color: CHAR }}>212 curated recipes.</strong> Baker Hub's pizza database covers 200 savoury pizzas and 12 dessert finales — each handpicked, not generated. Organised by tradition, occasion, taste, and dietary need so you can find the right pizza for the right moment.</P>

          <div style={{
            background: 'rgba(212,168,83,0.06)', borderLeft: `2px solid ${GOLD}`,
            borderRadius: '8px', padding: '12px', marginBottom: '12px',
            fontFamily: 'var(--font-dm-mono)', fontSize: '12px', color: SMOKE,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
              {[
                'Classic Neapolitan & Roman — 60+ recipes',
                'American styles — New York, Detroit, Pan',
                'French regional — Normandie, Provence, Alsace, Basque, Savoie',
                'Italian regional — Sicilian, Ligurian, Venetian, Calabrian',
                'Modern & fusion — Japanese, Korean, Spanish, Middle Eastern',
              ].map((t, i) => (
                <div key={i} style={{ padding: '3px 0', lineHeight: 1.45 }}>{t}</div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {[
              { label: 'Impress (109)', bg: 'rgba(26,22,18,0.06)', color: CHAR },
              { label: 'Party (50)',    bg: 'rgba(26,22,18,0.06)', color: CHAR },
              { label: 'Classic (75)', bg: 'rgba(26,22,18,0.06)', color: CHAR },
              { label: 'Quick prep (33)', bg: 'rgba(26,22,18,0.06)', color: CHAR },
              { label: 'Kids (28)',    bg: 'rgba(26,22,18,0.06)', color: CHAR },
              { label: 'Spicy (11)',   bg: 'rgba(26,22,18,0.06)', color: CHAR },
            ].map(p => <Pill key={p.label} bg={p.bg} color={p.color}>{p.label}</Pill>)}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
            {[
              'Vegetarian (64)', 'No pork (75)', 'Halal (73)',
              'Kosher (62)', 'Pescatarian (16)', 'No nuts (127)',
            ].map(l => <Pill key={l} bg='rgba(107,122,90,0.12)' color={SAGE}>{l}</Pill>)}
          </div>

          <P>Each pizza is matched to compatible dough styles — a Marinara won't appear for pan pizza, a Detroit won't show for Neapolitan. Suggestions always match what your dough can actually do.</P>
          <P><strong style={{ color: CHAR }}>Prep guidance, scaled to your group.</strong> The Prep tab generates a full ingredient preparation timeline working backwards from your bake time — drain the mozzarella 30 minutes before, slice the charcuterie 15 minutes before, tear the basil just before serving. Quantities scale automatically to your pizza count.</P>
          <p style={{ margin: 0, ...bodyText }}><strong style={{ color: CHAR }}>Shopping list.</strong> Combined dough ingredients and toppings in one list. Check items off as you go.</p>
        </Accordion>

        {/* ── Section 4 ── */}
        <Accordion title="The yeast engine">
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
          <DataTable rows={[
            ['RT poolish',     '÷3.1',  'No salt + 100% hydration → yeast ~3× more active'],
            ['Fridge poolish', '×1.65', 'Liquid medium → CO₂ escapes freely'],
            ['Biga',           '×2.2',  'Stiff dough (50–55%) + cold → yeast constrained'],
          ]} />
          <p style={{ marginTop: '10px', ...bodyText }}>Validated against Modernist Pizza preferment tables; all values within ±20% of empirical data.</p>

          <p style={{ marginTop: '14px', marginBottom: '6px', ...bodyText }}><strong style={{ color: CHAR }}>Sourdough</strong></p>
          <p style={{ margin: 0, ...bodyText }}>Starter activity varies too much between cultures for a precise gram quantity to be meaningful. Baker Hub gives a percentage range (10–25% of flour, climate-adjusted) and visual readiness cues.</p>
        </Accordion>

        {/* ── Section 5 ── */}
        <Accordion title="Flour engine">
          <P>Baker Hub's flour database contains 285+ entries. Each flour carries three properties that directly affect your recipe:</P>
          <p style={{ marginBottom: '10px', ...bodyText }}><strong style={{ color: CHAR }}>W value</strong> — alveograph strength index (gluten extensibility and tenacity). Ranges from ~80 (weak cake flour) to 400+ (Manitoba). Higher W means stronger gluten structure and longer fermentation tolerance. When you scan a flour bag with the AI scanner, Baker Hub extracts the W value (or estimates it from protein %) and applies it automatically. You can also enter W manually in Custom mode.</p>
          <p style={{ marginBottom: '10px', ...bodyText }}><strong style={{ color: CHAR }}>Hydration delta</strong> — how much to shift the baseline hydration for this flour. Strong flours absorb more water; weak flours need less. For blends, deltas are interpolated proportionally by ratio.</p>
          <p style={{ margin: 0, ...bodyText }}><strong style={{ color: CHAR }}>Fermentation tolerance</strong> — how long the dough can ferment without degrading. A W300+ flour tolerates a 48h cold retard that would destroy a W130 flour. The yeast engine applies this as a multiplier to IDY%.</p>
        </Accordion>

        {/* ── Section 6 ── */}
        <Accordion title="Hydration engine">
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
        </Accordion>

        {/* ── Section 7 ── */}
        <Accordion title="Mixer sensitivity">
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
        </Accordion>

        {/* ── Section 8 ── */}
        <Accordion title="Schedule engine">
          <P>The scheduler works backwards from your target bake time:</P>
          <BulletList items={[
            "Allocates cold retard to the style's preferred window (Neapolitan 24h, baguette 12h, pan pizza zero — pure RT)",
            'Maximises cold retard within your daily availability, respecting busy windows',
            'In hot kitchens with a long window, applies a two-phase cold retard (bulk cold → divide and ball → ball cold) for maximum control',
            'Passes the exact RT and cold hours to the yeast engine — yeast quantity always matches your actual schedule',
          ]} />
          <p style={{ marginTop: '14px', margin: '14px 0 0', ...bodyText }}>Two bakers with the same recipe but different schedules and different fridges get different yeast quantities. That's the point.</p>
        </Accordion>

        {/* ── Section 9 ── */}
        <Accordion title="Maestro — help along the way">
          <p style={{ margin: 0, ...bodyText }}>At key steps in the Bake Guide, you can photograph your dough or pizza and ask Maestro for feedback. Maestro knows your oven type, your style, and what stage you're at — so the guidance is contextual, not generic. Leoparding, crumb structure, crust colour, fermentation signs. A knowledgeable friend looking over your shoulder.</p>
        </Accordion>

        {/* ── Section 10 ── */}
        <Accordion title="What we don't model">
          <p style={{ marginBottom: '8px', ...bodyText }}>Honest about limits:</p>
          <BulletList items={[
            'Flour protein variation between bags of the same brand (W can vary ±15%)',
            'Sourdough starter activity differences between cultures',
            'Altitude effects on fermentation',
            'Water hardness and mineral content effects on yeast',
            'Thermal mass variation between specific home oven models',
          ]} />
        </Accordion>

        {/* ── Section 11 ── */}
        <Accordion title="Beta & feedback">
          <P>Baker Hub is actively developed as a side project. Things will occasionally break. If a yeast quantity seems wrong, the schedule doesn't fit, or something is just confusing — please tell us. Every piece of feedback makes the engine better.</P>
          <div style={{
            background: 'rgba(26,22,18,0.04)', borderRadius: '10px',
            padding: '16px', marginTop: '12px',
          }}>
            <p style={{ margin: '0 0 4px', fontFamily: 'DM Sans, sans-serif', fontSize: '14px', fontWeight: 600, color: CHAR }}>Built by Rom</p>
            <p style={{ margin: '0 0 12px' }}>
              <a href="mailto:rom@bakerhub.app" style={{ color: TERRA, fontFamily: 'DM Sans, sans-serif', fontSize: '14px', textDecoration: 'none' }}>
                rom@bakerhub.app
              </a>
            </p>
            <p style={{ margin: 0, fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: SMOKE, fontStyle: 'italic' }}>
              &ldquo;What would make Baker Hub more useful for you? One line is enough.&rdquo;
            </p>
          </div>
        </Accordion>

        {/* Bottom divider */}
        <div style={{ borderTop: `1px solid ${BORDER}` }} />

        {/* Footer */}
        <p style={{ ...monoSm, textAlign: 'center', marginTop: '24px', marginBottom: 0 }}>
          Baker Hub Beta
        </p>

      </div>
    </div>
  );
}
