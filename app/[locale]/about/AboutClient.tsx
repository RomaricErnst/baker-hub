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
            <P>Baker Hub's flour database contains 285+ entries. Each flour carries three properties that directly affect your recipe:</P>
            <p style={{ marginBottom: '10px', ...bodyText }}><strong style={{ color: CHAR }}>W value</strong> — alveograph strength index (gluten extensibility and tenacity). Ranges from ~80 (weak cake flour) to 400+ (Manitoba). Higher W means stronger gluten structure and longer fermentation tolerance. When you scan a flour bag with the AI scanner, Baker Hub extracts the W value (or estimates it from protein %) and applies it automatically. You can also enter W manually in Custom mode.</p>
            <p style={{ marginBottom: '10px', ...bodyText }}><strong style={{ color: CHAR }}>Hydration delta</strong> — how much to shift the baseline hydration for this flour. Strong flours absorb more water; weak flours need less. For blends, deltas are interpolated proportionally by ratio.</p>
            <p style={{ margin: 0, ...bodyText }}><strong style={{ color: CHAR }}>Fermentation tolerance</strong> — how long the dough can ferment without degrading. A W300+ flour tolerates a 48h cold retard that would destroy a W130 flour. The yeast engine applies this as a multiplier to IDY%.</p>
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
            <P>The scheduler works backwards from your target bake time:</P>
            <BulletList items={[
              "Allocates cold retard to the style's preferred window (Neapolitan 24h, baguette 12h, pan pizza zero — pure RT)",
              'Maximises cold retard within your daily availability, respecting busy windows',
              'In hot kitchens with a long window, applies a two-phase cold retard (bulk cold → divide and ball → ball cold) for maximum control',
              'Passes the exact RT and cold hours to the yeast engine — yeast quantity always matches your actual schedule',
            ]} />
            <p style={{ marginTop: '14px', margin: '14px 0 0', ...bodyText }}>Two bakers with the same recipe but different schedules and different fridges get different yeast quantities. That's the point.</p>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                {[
                  'Napolitaine & Romaine classique — 60+ recettes',
                  'Styles américains — New York, Detroit, Pan',
                  'Régional français — Normandie, Provence, Alsace, Basque, Savoie',
                  'Régional italien — Sicilien, Ligurien, Vénitien, Calabrais',
                  'Moderne & fusion — Japonais, Coréen, Espagnol, Moyen-Oriental',
                ].map((t, i) => (
                  <div key={i} style={{ padding: '3px 0', lineHeight: 1.45 }}>{t}</div>
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
            <P>La base de données farines de Baker Hub contient 285+ entrées. Chaque farine porte trois propriétés qui affectent directement votre recette :</P>
            <p style={{ marginBottom: '10px', ...bodyText }}><strong style={{ color: CHAR }}>Valeur W</strong> — indice de force alvéographique (extensibilité et ténacité du gluten). Va de ~80 (farine faible pour gâteaux) à 400+ (Manitoba). Un W plus élevé signifie une structure de gluten plus forte et une meilleure tolérance de fermentation. Lorsque vous scannez un sac de farine avec le scanner IA, Baker Hub extrait la valeur W (ou l'estime à partir du % de protéines) et l'applique automatiquement. Vous pouvez aussi saisir W manuellement en mode Custom.</p>
            <p style={{ marginBottom: '10px', ...bodyText }}><strong style={{ color: CHAR }}>Delta d'hydratation</strong> — de combien décaler l'hydratation de base pour cette farine. Les farines fortes absorbent plus d'eau ; les farines faibles en nécessitent moins. Pour les mélanges, les deltas sont interpolés proportionnellement selon le ratio.</p>
            <p style={{ margin: 0, ...bodyText }}><strong style={{ color: CHAR }}>Tolérance de fermentation</strong> — combien de temps la pâte peut fermenter sans se dégrader. Une farine W300+ tolère une pousse froide de 48 h qui détruirait une farine W130. Le moteur de levure applique cela comme multiplicateur à l'IDY %.</p>
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
            <P>Le planificateur remonte depuis votre heure de cuisson cible :</P>
            <BulletList items={[
              "Alloue la pousse froide à la fenêtre préférée du style (napolitaine 24 h, baguette 12 h, pizza pan zéro — TA pur)",
              "Maximise la pousse froide dans vos disponibilités journalières, en respectant les fenêtres occupées",
              "Dans les cuisines chaudes avec une longue fenêtre, applique une pousse froide en deux phases (bulk froid → diviser et bouler → boules froides) pour un contrôle maximum",
              "Transmet les heures exactes de TA et de froid au moteur de levure — la quantité de levure correspond toujours à votre planning réel",
            ]} />
            <p style={{ marginTop: '14px', margin: '14px 0 0', ...bodyText }}>Deux boulangers avec la même recette mais des plannings différents et des réfrigérateurs différents obtiennent des quantités de levure différentes. C'est tout l'intérêt.</p>
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
