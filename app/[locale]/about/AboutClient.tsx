'use client';
import { YeastModelSectionEn, YeastModelSectionFr, Maths, Table } from './yeastModelSection';
import { useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import Header, { pageBackClick } from '../../components/Header';

// About Baker Hub. Present tense only, no references to project files (bakers cannot open them), and every
// number the engines' own: tests/about-science.test.cjs checks both rules, tests/yeast-model.test.cjs the
// yeast numbers. Light (rule C): plain explanation and tables visible, equations under "The maths".

// ── Shared style tokens ──────────────────────────
const CHAR   = '#2B2420';
const ASH    = '#3D3530';
const SMOKE  = '#6B635D';
const TERRA  = '#6B4423';
const BORDER = '#E8E0D5';

const bodyText: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: '14px',
  color: ASH,
  lineHeight: 1.65,
};

const monoSm: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: '12px',
  color: SMOKE,
  letterSpacing: '.04em',
};

const eqStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: '13px', background: 'rgba(43,36,32,0.06)',
  borderRadius: '8px', padding: '8px 10px', display: 'block', overflowX: 'auto', whiteSpace: 'pre-wrap', color: CHAR, margin: '0 0 12px',
};

function BulletList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 12px' }}>
      {items.map((item, i) => (
        <li key={i} style={{
          borderLeft: `2px solid ${BORDER}`, paddingLeft: '12px',
          marginBottom: '8px', fontFamily: 'var(--font-ui)',
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
        <li key={i} style={{ display: 'flex', gap: '12px', marginBottom: '8px', alignItems: 'flex-start' }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: TERRA, flexShrink: 0, marginTop: '1px' }}>{i + 1}.</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: ASH, lineHeight: 1.55 }}>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Pill({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', fontFamily: 'var(--font-ui)', fontSize: '12px',
      padding: '3px 12px', borderRadius: '20px', margin: '3px',
      background: bg, color,
    }}>{children}</span>
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
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '16px 0', minHeight: '44px',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: '15px',
          fontWeight: 600, color: CHAR,
        }}>{title}</span>
        <span aria-hidden="true" style={{
          fontSize: '17px', color: SMOKE,
          display: 'inline-block',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          flexShrink: 0, marginLeft: '12px',
        }}>›</span>
      </button>
      {open && (
        <div style={{ paddingBottom: '20px', ...bodyText }}>
          {children}
        </div>
      )}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '0 0 12px', ...bodyText }}>{children}</p>;
}
function Sub({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '14px 0 8px', ...monoSm, color: TERRA, textTransform: 'uppercase', letterSpacing: '.08em' }}>{children}</p>;
}
function Eq({ children }: { children: React.ReactNode }) {
  return <code style={eqStyle}>{children}</code>;
}
function B({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: CHAR }}>{children}</strong>;
}

const DIETS = {
  en: ['Vegetarian', 'Vegan', 'No pork', 'Halal', 'Kosher', 'Pescatarian', 'Nut-free'],
  fr: ['Végétarien', 'Végan', 'Sans porc', 'Halal', 'Casher', 'Pescatarien', 'Sans fruits à coque'],
};
function DietPills({ fr }: { fr: boolean }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '0 0 12px' }}>
      {DIETS[fr ? 'fr' : 'en'].map(l => <Pill key={l} bg="rgba(107,122,90,0.12)" color="var(--sage-text)">{l}</Pill>)}
    </div>
  );
}

// ── Bilingual content ────────────────────────────────────────────────────────

type SectionDef = { title: string; defaultOpen?: boolean; body: React.ReactNode };
type LocaleContent = { pageTitle: string; pageSubtitle: string; promise: string; footer: string; sections: SectionDef[] };

const CONTENT: Record<string, LocaleContent> = {
  en: {
    pageTitle: 'About Baker Hub',
    pageSubtitle: 'How it works · The science behind it',
    promise: 'Tell Baker Hub when you want to eat and when you are busy; it tells you when to start your dough.',
    footer: 'Baker Hub Beta',
    sections: [
      {
        title: 'Why Baker Hub exists',
        defaultOpen: true,
        body: (
          <>
            <P>Most baking recipes assume you have a free afternoon, a 20 °C kitchen, and nothing else to do. Most of us don&rsquo;t.</P>
            <P>Baker Hub is for the home baker who bakes around real life — a day job, a family dinner, a pizza night that has to happen Saturday at 7pm, not whenever the dough feels ready. You set the bake time. Baker Hub works backwards from there: when to start, how much yeast or starter to use, what to do at each step.</P>
            <P>Baker Hub combines fermentation models fitted to published data with recipe and scheduling rules. Every bake asks for your kitchen temperature on its own screen, because it sets the pace of the whole plan; customizing your bake also asks for your fridge temperature. Either way, check the actual dough as it develops.</P>
            <p style={{ margin: 0, ...bodyText }}>Times and readiness windows are estimates from those models. They do not measure your dough: its look, feel and rise decide.</p>
          </>
        ),
      },
      {
        title: 'One recipe, as much detail as you like',
        body: (
          <>
            <P>Answer a few questions — what you&rsquo;re making, how many, how warm your kitchen is, when it goes in the oven and when you&rsquo;re busy — and Baker Hub generates your recipe, choosing the flour, hydration and method that suit the style. For a sourdough bake it also asks about <strong style={{ color: CHAR }}>your starter</strong>: on the counter, in the fridge, or bubbly and risen right now; its feeds are planned from that answer. If your bake time clashes with your busy hours, one sheet names the clash and offers the nearest time that fits (or, when only taking the dough out of the fridge clashes, lets you keep your time with someone doing that step).</P>
            <P>The recipe gives the whole dough first, then each stage — the poolish, biga or levain build, then the final dough — and the stages add up to the whole dough; customizing adds each ingredient&rsquo;s baker&rsquo;s percentage. Every bake adds 1.5 % to the total for the dough left in the bowl and on your hands, so the last ball weighs what the others do. Then comes <B>Your plan</B>: the key stages with their times, and every step one tap away. Preparation walks you through each step; its summary is where you add the plan to your calendar, with one reminder for each moment you need to be there. Adding it again after a change updates those events.</P>
            <p style={{ margin: 0, ...bodyText }}><B>Customize my bake</B> is there when you want more, before generating the recipe or at any time afterwards from My bake: equipment (oven, then mixing), kitchen and fridge temperatures, water, flour (product or blend, and how it&rsquo;s stored), preferment (poolish, biga or direct; for poolish, the fridge, room temperature or wherever the timing works best), yeast, fine-tuning (hydration, salt, oil, sugar, dough temperature, and your own yeast or starter amount), then bake time. Levain breads have a Starter step instead of the preferment: where your starter is, when and how it was last fed. The same engines run either way; customizing shows their inputs.</p>
          </>
        ),
      },
      {
        title: 'Planned around your busy times',
        body: (
          <>
            <P>Every plan works around the hours you&rsquo;re unavailable: weekday work hours, nights, or any period you add. <B>Nights (11pm to 7am) are on by default</B> — untick them if you&rsquo;re happy to get up — and even then the planner avoids steps between 11pm and 7am unless they genuinely help the bake.</P>
            <P>Only hands-on steps need you: mixing, folds, shaping, feeding a starter, putting the dough in or taking it out of the fridge, baking. Rising happens without you, so it can run through your workday or your night. A step may sit right at the start or end of a busy period, never inside it.</P>
            <p style={{ margin: 0, ...bodyText }}>When a bake time can&rsquo;t fit, you get one decision — the nearest time that fits, with the reason. Once you&rsquo;ve customized your bake, you see each affected step, can mark a step someone else can do, and get the baking times that fit.</p>
          </>
        ),
      },
      {
        title: 'How the engines connect',
        body: (
          <>
            <P>Baker Hub&rsquo;s engines form a chain where each output feeds the next.</P>
            <P><B>Style and oven</B> set the fermentation blueprint — target cold retard, room-temperature time and baseline hydration. <B>Flour</B> scales that blueprint through its fermentation tolerance: a stronger flour takes a longer cold retard, and the yeast is calculated for those longer hours. <B>Kitchen temperature</B> sets how fast everything moves.</P>
            <P>With those constraints, the <B>scheduler</B> finds the best mix time for your real availability and returns the hours at room temperature and in the fridge. The <B>yeast engine</B> follows the dough&rsquo;s temperature through those hours and computes the amount (the <B>sourdough engine</B> plans the starter&rsquo;s feeds and the levain amount instead). When you customize your bake you can set the yeast or starter amount yourself; the plan is then re-timed to match it. Finally <B>hydration</B> and <B>water temperature</B> are layered on.</P>
            <p style={{ margin: 0, ...bodyText }}>Change any input and everything downstream recalculates.</p>
          </>
        ),
      },
      {
        title: 'Style & oven',
        body: (
          <>
            <P>Every style carries a fermentation blueprint: the cold retard and the room-temperature time that put the dough at its best at the bake.</P>
            <Table headers={['Style', 'Fridge', 'Room temperature']} rows={[
              ['Neapolitan, New York', '24 h', '2 h'],
              ['Pain de campagne', '18 h', '3 h'],
              ['Pain au levain', '16 h', '4 h'],
              ['Baguette', '12 h', '2 h'],
              ['Brioche', '8 h (always)', '2 h'],
              ['Roman', '—', '6 h'],
              ['Pan pizza', '—', '5 h'],
            ]} />
            <P>The oven shapes the recipe independently. Hydration moves with the oven: pizza oven −2 %, electric pizza oven −1 %, home oven with a stone or steel +3 %, standard home oven +4 %; for bread, Dutch oven and stone or steel +2 %, steam oven and standard home oven +3 %, wood-fired oven and griddle 0. Enriched and oily doughs take half of that correction. Pizza ovens, classic or electric, use no oil or sugar: their heat browns the crust on its own. Each value can be changed when you customize your bake.</P>
            <p style={{ margin: 0, ...bodyText }}><B>Preheat</B> sits at the end of the plan, from 5 minutes for a griddle to 60 minutes for a home oven with a stone, so the oven is hot when the dough is ready.</p>
          </>
        ),
      },
      {
        title: 'Kitchen & fridge temperature',
        body: (
          <>
            <P>Warmer dough ferments faster. One activity curve, fitted to published doses, says how much faster at every dough temperature (see The yeast engine); there is no fixed rule such as &ldquo;twice as fast every five degrees&rdquo;.</P>
            <BulletList items={[
              <>In a <B>hot kitchen</B> (28 °C or more), the planner shortens the room-temperature steps (bulk from 30 minutes instead of 1½ hours) and leans on the fridge. The yeast model follows the dough&rsquo;s real temperature: it starts at the target dough temperature (cold water buys time), keeps speeding up to about 35 °C, and plans a dough that ends warmer than 25 °C to a smaller rise.</>,
              <><B>Fridge temperature</B> matters more than it looks. An hour at 6 °C does about 1.6 times the work of an hour at 4 °C, and about a ninth of an hour at 25 °C. The dough also takes time to cool and to warm back — about 1.6 hours to close most of the gap for a 250 g ball, 2.8 hours for 1 kg — and the model follows it. A warmer fridge means less yeast; a colder one, more.</>,
              <><B>Hydration</B>: a kitchen at 28 °C or more, or a very humid one, gets −2 %; a kitchen at 18 °C or less gets +2 %. This is a handling correction, not a fermentation one.</>,
            ]} />
          </>
        ),
      },
      {
        title: 'Flour',
        body: (
          <>
            <P>Baker Hub&rsquo;s flour database holds an audited selection of branded and generic flours. W describes measured strength; published values are kept apart from estimates. Each flour carries two numbers that cascade through the recipe and the plan.</P>
            <p style={{ margin: '0 0 12px', ...bodyText }}><B>Fermentation tolerance</B> — how much fermentation the flour stands, against a W 250 pizza 00 at 1.0: Manitoba 1.35, strong 00 1.2, bread flour 0.9, semolina 0.85, wholemeal 0.8, all-purpose 0.75, rye 0.7. A white wheat flour whose W is stated — typed from the bag, read off its label, or published for the product — takes its tolerance from that W: 0.75 at W 130, 0.9 at W 200, 1.0 at W 250, 1.2 at W 300 and 1.35 at W 360, in a straight line between and flat beyond. An estimated W goes by the flour type; rye, wholemeal and semolina keep their type&rsquo;s value. Blends are weighted by their proportions. The tolerance scales the style&rsquo;s target cold retard (24 hours become about 29 with a 1.2 flour) and the levain amount. The yeast is calculated for the plan&rsquo;s hours, so a stronger flour gets a little less only through its longer cold retard.</p>
            <p style={{ margin: 0, ...bodyText }}><B>Hydration</B> — how much water the flour asks for beyond the style&rsquo;s baseline: rye +6 %, wholemeal +4 %, Manitoba +3 %, strong 00 +2 %, bread flour +1 %, pizza 00 0, semolina −1 %, all-purpose −2 %. Blends and branded products stay within −5 to +8 %. Hydration follows the flour type, never its W: W is measured at a fixed water content and does not say how much water a flour drinks.</p>
          </>
        ),
      },
      {
        title: 'Hydration',
        body: (
          <>
            <P>Hydration is built in layers, each visible when you customize your bake:</P>
            <NumberedList items={[
              <><B>Style baseline</B> — Neapolitan and New York 62 %, baguette 68 %, pan pizza 70 %, pain au levain 75 %, Roman 78 %</>,
              <><B>Oven</B> — from −2 % (pizza oven) to +4 % (standard home oven), half for enriched and oily doughs</>,
              <><B>Kitchen</B> — 28 °C or more, or very humid: −2 % · 18 °C or less: +2 %</>,
              <><B>Flour</B> — the flour type&rsquo;s correction, from −2 % (all-purpose) to +6 % (rye)</>,
              <><B>Style floor</B> — a minimum per style whatever the corrections (Neapolitan 56 %, baguette 65 %, Roman 70 %)</>,
            ]} />
            <p style={{ margin: '14px 0 0', ...bodyText }}>Hydration does not change the timing: no published source quantifies its effect on fermentation speed, so the models leave it out. Watch the dough.</p>
          </>
        ),
      },
      {
        title: 'Water temperature',
        body: (
          <>
            <P>The water temperature comes from an energy balance over what is actually in the bowl: flour, water, a poolish, biga or levain at its own temperature, the heat of kneading and, when needed, ice. Its aim is the target dough temperature at the end of mixing: 23 °C for Neapolitan, 22 °C for brioche, 25 °C for Roman and pan pizza, 24 °C for most breads.</P>
            <P>Kneading heat is a rate times the kneading time the guide gives:</P>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
              {['By hand 0.16 °C/min · 10 min', 'Stand mixer 0.6 °C/min · 8 min', 'Spiral 0.55 °C/min · 14 min', 'No-knead 0'].map(l => (
                <span key={l} style={{ ...monoSm, padding: '3px 12px', borderRadius: '20px', background: 'rgba(43, 36, 32,0.06)' }}>{l}</span>
              ))}
            </div>
            <P>A levain&rsquo;s flour and water enter the balance at the starter&rsquo;s temperature: the kitchen&rsquo;s after a feed, partly warmed when it comes from the fridge, or the temperature you measured. The water stays between 2 and 40 °C. When it would have to be colder than the water you have, part of it is ice (from 50 g of ice; below that, the recipe asks for cool water). The water line says how to reach the temperature without a thermometer. Measure the dough after mixing.</P>
            <Maths fr={false}>
              <Eq>{'(target − kneading heat) × (c_flour·m_flour + c_water·m_water + c_pref·m_pref)\n  = c_flour·m_flour·T_flour + c_pref·m_pref·T_pref + c_water·m_water·T_water\nc_water 4.18 kJ/kg·K · c_flour 1.8 kJ/kg·K · kneading heat = rate × minutes'}</Eq>
            </Maths>
          </>
        ),
      },
      {
        title: 'Schedule engine',
        body: (
          <>
            <P>The scheduler works backwards from your bake time. It fills the window with a cold retard up to the style&rsquo;s preferred length (scaled by the flour&rsquo;s tolerance), then places the bulk, dividing and shaping, and the final proof, keeping hands-on steps out of your busy hours. If that isn&rsquo;t possible at your bake time, it offers the nearest time that is, looking up to four days ahead first.</P>
            <BulletList items={[
              <>Minimums: a bulk of 1½ hours (30 minutes in a kitchen at 28 °C or more) and a final proof of 1 hour.</>,
              <>A shaped baguette proofs no longer than what 1½ hours at 24 °C is worth by the yeast model: about 2 hours to the bake at 20 °C, 2½ at 18 °C, 3 at 16 °C, as in professional practice (Hamelman, Grands Moulins de Paris, King Arthur). The fridge takes the extra time; a plan with no cold phase stays at room temperature, and the bound adds no step between 10pm and 7am.</>,
              <>Hot kitchen with 16 hours or more before the bake (28 °C or more): two cold spells — the bulk goes into the fridge, the dough is divided, the balls go back in — and a warm-up of 45 minutes (30 minutes from 30 °C) before the final proof.</>,
              <>Times are rounded to the quarter hour. The fridge is taken at 6 °C unless you say otherwise.</>,
              <>A plan long enough to take a cold retard can ferment less than a slightly shorter room-temperature one (the fridge holds the dough), so the yeast is always computed for the plan&rsquo;s own path.</>,
            ]} />
            <p style={{ margin: 0, ...bodyText }}>Two bakers with the same recipe but different plans, kitchens and flours get different yeast amounts and different timings. That is the point.</p>
          </>
        ),
      },
      {
        title: 'Poolish & biga',
        body: (
          <>
            <P>A poolish (100 % hydration) or a biga (45 %) is part of the flour fermented before the final dough, for flavour and extensibility. Its yeast is dosed so it peaks at the mix on its own path — made at kitchen temperature, with its time in the fridge and its warm-up. The final dough gets its own yeast for the time from the mix to the bake.</P>
            <BulletList items={[
              <><B>Poolish at room temperature</B> — the planner aims at about 11 hours at 22 °C (12 for bread), 9 at 24 °C, 7 at 26 °C, 5 at 28 °C, 4 at 30 °C and 3 from 32 °C, usable from 1½ hours before to 2 hours after that aim in a cool kitchen (narrower when warm), never beyond 16 hours.</>,
              <><B>Poolish in the fridge</B> — aimed at 22 − 1.5 × the fridge temperature, in hours (13 hours at 6 °C, between 10 and 22), usable from 8 to 24 hours in a fridge at 6 °C or colder.</>,
              <><B>Biga</B> — always in the fridge, aimed at 48 hours, usable from 24 to 58, never beyond 72. It goes from the fridge straight into the mix.</>,
            ]} />
            <P>For a poolish the planner compares the fridge and room temperature and keeps the better plan, unless you fixed the storage when customizing your bake. When a poolish&rsquo;s yeast sits at the smallest amount the recipe uses (0.05 %) and its window is long, it can peak before the mix. It is still usable until its peak plus ⅓ of its time to peak (at least ¾ to 2 hours, by kitchen temperature) at room temperature, or 12 hours after its peak in the fridge. Beyond that, the planner moves it to the fridge or starts it later.</P>
          </>
        ),
      },
      {
        title: 'Reading your plan',
        body: (
          <>
            <P>Your plan lists each hands-on step once, with its time: preparing a poolish or feeding a starter, Start Dough, folds, into and out of the fridge, shaping, preheat and bake. Rising happens between them. A commercial-yeast dough needs no curve: its yeast is dosed for the plan&rsquo;s own hours and temperatures.</P>
            <p style={{ margin: '0 0 10px', ...bodyText }}><B>Poolish and biga.</B> The Make Poolish (or Make Biga) row says where it waits until Start Dough: in the fridge, straight into the fridge, or at room temperature until the time it goes in.</p>
            <p style={{ margin: '0 0 10px', ...bodyText }}><B>Sourdough starter.</B> When you customize a levain bake, a strip between the pre-mix feed and Start Dough shows the feeds, your busy times, Start Dough, and the hours when the starter counts as ready (&ldquo;ready 4–7pm&rdquo;). That window is the planner&rsquo;s own tolerance around the estimated peak — 15 % of the time to peak on either side (1 to 3 hours), half an hour more before the peak — written in the whole hours that lie inside it. The peak itself is written on the plan&rsquo;s quarter-hour grid (&ldquo;around 5:45pm&rdquo;), the same value on the starter card, the strip and the feed rows. It is an estimate: check the starter&rsquo;s rise before mixing.</p>
            <p style={{ margin: 0, ...bodyText }}>In Preparation, the step the clock says you are on is marked Now. Ticking a step is optional; a different time you enter moves the rest of the plan with it.</p>
          </>
        ),
      },
      {
        title: 'The sourdough engine',
        body: (
          <>
            <P>A living starter keeps no fixed clock: its timing depends on how it is stored, when and how it was last fed, how mature it is, and how warm your kitchen is. Baker Hub estimates each of these and plans the feeds backwards from your bake.</P>

            <Sub>What it asks you</Sub>
            <P>Where your starter is, when it was last fed and at what ratio; customizing also asks whether it is mature and whether it contains rye. These answers estimate a feeding plan. They cannot measure vitality: check the starter&rsquo;s rise before mixing.</P>

            <Sub>How fast a starter peaks</Sub>
            <P>A mature wheat starter fed 1:1:1 peaks about:</P>
            <Table headers={['Kitchen', 'Feed to peak']} rows={[
              ['18 °C', '10¼ h'], ['22 °C', '6¾ h'], ['26 °C', '4½ h'], ['30 °C and warmer', '3 h'],
            ]} />
            <P>A bigger feed has further to climb: 1:2:2 takes about 1.35 times as long, 1:5:5 about 1.8 times, 1:10:10 about 2.15 times. A young starter takes 1.2 times as long, a rye starter 0.8 times. Above 30 °C the estimate stays at its 30 °C value, where the evidence is thin.</P>

            <Sub>The first feed after a rest</Sub>
            <P>A starter fed long ago — past its peak, depleted, or resting in the fridge — starts the next feed with fewer active yeasts, so that feed rises more slowly: up to 1.5 times as long after a long rest. The planner applies this to the first feed after the last one you recorded, whichever feed of the plan it is, for a starter on the counter or in the fridge, and places the feeds of a run-up back from the feed before the mix. A feed given before the feed ahead of it has peaked also rises more slowly, by up to 20 %.</P>

            <Sub>Waking a fridge starter</Sub>
            <Table headers={['Last fed', 'Refreshes (mature)', 'Refreshes (young)']} rows={[
              ['Today', '0', '0'], ['Yesterday', '0', '1'], ['2–3 days ago', '1', '1'], ['4–5 days ago', '1', '2'], ['A week or more', '2', '2'],
            ]} />
            <P>Out of the fridge, a starter gets 1½ hours to warm in a kitchen below 26 °C, 1 hour up to 28 °C, 45 minutes up to 30 °C and 30 minutes above. For a bake several days away the revival is placed in the run-up, with the refreshes for the age the starter will have then: it keeps ageing in the fridge. Treat the count as a starting plan and follow the starter&rsquo;s actual activity.</P>

            <Sub>When it counts as ready</Sub>
            <P>The planner counts the starter as ready inside a window around its estimated peak: 15 % of its time to peak on either side (between 1 and 3 hours), and half an hour more before the peak. Start Dough is placed inside that window.</P>

            <Sub>One jar, two bakes</Sub>
            <P>When two sourdough bakes under way use the same starter and the later mix falls inside the ready window of the other bake&rsquo;s feed before its mix, one feed serves both: it is sized for both levains and said once, with each bake&rsquo;s amount.</P>

            <Sub>Feed ratio & timing</Sub>
            <P>The ratio you feed at (1:1:1, 1:2:2, 1:4:4, 1:5:5 or 1:10:10) is a quiet but powerful lever. If your ideal feed time lands in the middle of your night or your workday, the engine can <B>recommend a different ratio</B> that moves the peak into a workable hour, and says in plain words what it changed and why — for example, a 3am feed becomes a 7am one at a higher ratio. Keep your usual ratio, or take the suggestion.</P>

            <Sub>Planned around your life</Sub>
            <P>Feeds, refreshes and the mix itself are moved out of your busy hours wherever the biology allows. When a bake time leaves too little room, the engine says so and suggests the earliest bake that works.</P>

            <Sub>Taste, if you want it</Sub>
            <P><B>Tangier</B> lengthens the cold proof by up to 15 %, within the style&rsquo;s range — more acid, more depth. <B>Milder</B> shortens it by up to 15 % and adds one refresh to a starter rested two days or more — gentler, sweeter. <B>Balanced</B> keeps the standard timing. The ingredients never change.</P>

            <Sub>How much starter</Sub>
            <P>The recommended amount follows your kitchen — less in a warm kitchen, more in a cool one — and the time between the last feed and the mix. At that amount the room-temperature bulk takes about 5 hours at 22 °C, half as long for every 10 °C warmer. When you customize your bake you can set your own amount: less starter takes longer, so the bulk is re-timed with a regression of real doughs (Craig, pizzamaking.com) that agrees with The Sourdough Journey&rsquo;s controlled timetables. At 22 °C, half the recommended amount stretches a 5-hour bulk to about 7½ hours. Cold phases are not re-timed. When no plan fits your free time at the recommended amount, the planner may raise the levain in steps of 2.5 points up to 30 % of the flour, only when your jar can supply it.</P>

            <Sub>If you already track your starter</Sub>
            <P>Prefer to watch your jar yourself? Switch to <B>&ldquo;I know when my starter will peak&rdquo;</B> and give the engine the time directly — it builds the plan backwards from there, without the estimate.</P>

            <Maths fr={false}>
              <Eq>{'feed to peak (h) = 5.5 × 2.8^((24 − T)/10) × rye × maturity × (1 + 0.5 · ln r)\n  T kitchen °C (held at 30) · rye 0.8 · young 1.2 · feed 1:r:r\ndepleted after 1.8 × feed to peak\nready: peak − (tol + 0.5 h) … peak + tol, tol = 0.15 × feed to peak, 1–3 h'}</Eq>
              <Table headers={['Hours since the last feed', 'First feed rises']} rows={[
                ['up to its time to peak', '× 1'], ['up to 1.5 × that', '× 1.05'], ['until depleted', '× 1.15'],
                ['up to 1.5 × depleted', '× 1.25'], ['up to 2.5 × depleted', '× 1.35'], ['longer', '× 1.5'],
              ]} />
              <Eq>{'bulk at the recommended levain = 5 × 2^((22 − T)/10) h   (T held at 30)\nyour amount p: bulk × h(p) / h(recommended),  h(p) = −5.368 · ln p − 0.6014\n  p = starter ÷ flour, 5–30 % (Craig’s regression at 24 °C)\nin the fridge a starter rises 2^((T − T_fridge)/10) times slower'}</Eq>
            </Maths>
          </>
        ),
      },
      {
        title: 'The yeast engine',
        body: <YeastModelSectionEn />,
      },
      {
        title: 'What the models leave out',
        body: (
          <>
            <P>Baker Hub uses simplified models fitted to published data. They leave out:</P>
            <BulletList items={[
              'The exact state of the microbes in your starter — the engine models storage, time since the last feed, maturity and temperature, but it cannot see your jar. If you track peaks yourself, "I know when my starter will peak" gives the closest fit.',
              'Salt, hydration and flour type as factors of fermentation speed: no published source quantifies them.',
              'Altitude, which slightly changes fermentation and oven behaviour.',
              'Humidity beyond the ±2 % hydration correction, and water hardness.',
              'Protein variation between bags of the same flour, and the thermal mass of a particular oven.',
            ]} />
            <p style={{ margin: 0, ...bodyText }}>This is why each step of the guide gives the visual cue to look for, and why Maestro is there to look at your dough with you.</p>
          </>
        ),
      },
      {
        title: 'Your preferences & your own pizzas',
        body: (
          <>
            <P>Open the menu → <B>Kitchen preferences</B> to set your defaults once: pizza oven and bread oven (independently), mixer, yeast, preferred preferment, fridge temperature, favourite style per bake type, whether to customize by default, your sourdough starter&rsquo;s traits, and your usual busy hours. Everything saves as you tap and prefills every new bake, always changeable per step. Signed in, preferences sync to your account and follow you across devices.</P>
            <p style={{ margin: 0, ...bodyText }}><B>Create your own pizza</B> from the Pizzas list: pick ingredients from the catalogue or add your own in free text, group by group (base, cheese, meat & sea, vegetables, finishing). Add a photo and reframe it by dragging. Your creations live in your preferences, reappear at every party, and flow into the shopping list, the preparation and the bake sheet — including oven guidance inferred from their ingredients.</p>
          </>
        ),
      },
      {
        title: 'Pizzas — from dough to table',
        body: (
          <>
            <P>Once the dough is planned, the rest of the evening plans itself too. The catalogue holds curated savoury and dessert pizzas, organised by tradition, occasion and taste, each matched to the dough styles it suits — a Detroit never shows for a Neapolitan dough. Dietary filters:</P>
            <DietPills fr={false} />
            <P>Select your pizzas and Baker Hub scales every topping for your quantity, with each ingredient&rsquo;s waste and serving size, and plans the topping prep backwards from the bake: drain the mozzarella, slice the cured meats, tear the basil just before serving.</P>
            <p style={{ margin: 0, ...bodyText }}>The shopping list joins the dough and the toppings in one list, and Baking & serving tracks what has been baked and what comes next.</p>
          </>
        ),
      },
      {
        title: 'Maestro — help along the way',
        body: (
          <p style={{ margin: 0, ...bodyText }}>In the step-by-step guide, <B>Ask Maestro</B> answers a question about the step, looks at a photo of your dough or your bake, or both. It knows your recipe, oven, style and the step you are on, so its answer is about your bake, not a generic one: fermentation signs, crumb, crust colour, the spots on a cornicione. It says what a photo can and cannot show.</p>
        ),
      },
      {
        title: 'Sessions — save, resume, bake again, share',
        body: (
          <>
            <P>Sign in (a link sent by email, or Google) and every bake becomes a <B>session</B> you can return to: dough, plan, starter state, pizza selections and photos of the result. Not signed in? Your current bake stays on this device.</P>
            <BulletList items={[
              <><B>Resume</B> — reopen a bake where you left it.</>,
              <><B>Bake again</B> — one tap copies a past bake to the same weekday and time next week, with its plan and busy hours moved along.</>,
              <><B>Photos</B> — attach photos of each bake to build your own baking log.</>,
              <><B>Share</B> — export a session as a card (post, square or story) with your recipe, plan and photos. Tag <B>@bakerhub</B> and <B>#BakerHub</B> — we&rsquo;d love to see it.</>,
            ]} />
          </>
        ),
      },
      {
        title: 'Beta & feedback',
        body: (
          <>
            <P>Baker Hub is in beta and things occasionally break. If a yeast amount seems wrong, the plan doesn&rsquo;t fit, or something is confusing — please say so. Every piece of feedback makes the engines better.</P>
            <div style={{ background: 'rgba(43, 36, 32,0.04)', borderRadius: '16px', padding: '16px', marginTop: '12px' }}>
              <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600, color: CHAR }}>Built by Rom</p>
              <p style={{ margin: '0 0 12px' }}>
                <a href="mailto:rom@bakerhub.app" style={{ color: TERRA, fontFamily: 'var(--font-ui)', fontSize: '14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>rom@bakerhub.app</a>
              </p>
              <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: '13px', color: SMOKE }}>Baker Hub is a solo side project — feedback goes directly to the person who builds the engines.</p>
            </div>
          </>
        ),
      },
    ],
  },

  fr: {
    pageTitle: 'À propos de Baker Hub',
    pageSubtitle: 'Comment ça marche · La science derrière',
    promise: 'Dites à Baker Hub quand vous voulez manger et quand vous n’êtes pas disponible ; il vous dit quand commencer votre pâte.',
    footer: 'Baker Hub Bêta',
    sections: [
      {
        title: 'Pourquoi Baker Hub existe',
        defaultOpen: true,
        body: (
          <>
            <P>La plupart des recettes supposent que vous avez un après-midi libre, une cuisine à 20 °C, et rien d’autre à faire. La plupart d’entre nous n’ont rien de tout cela.</P>
            <P>Baker Hub est fait pour le boulanger amateur qui boulange autour de sa vie réelle — un emploi, un dîner en famille, une soirée pizza qui doit avoir lieu samedi à 19 h, pas quand la pâte sera enfin prête. Vous fixez l’heure de cuisson. Baker Hub calcule à rebours : quand commencer, quelle quantité de levure ou de levain, et quoi faire à chaque étape.</P>
            <P>Baker Hub combine des modèles de fermentation ajustés sur des données publiées et des règles de recette et de planning. Chaque fournée vous demande la température de votre cuisine sur son propre écran, car elle donne le rythme de tout le planning ; personnaliser votre fournée demande aussi celle du frigo. Dans les deux cas, vérifiez le développement réel de la pâte.</P>
            <p style={{ margin: 0, ...bodyText }}>Les heures et les fenêtres de maturité sont des estimations issues de ces modèles. Elles ne mesurent pas votre pâte : son aspect, sa texture et sa pousse décident.</p>
          </>
        ),
      },
      {
        title: 'Une recette, avec autant de détail que vous voulez',
        body: (
          <>
            <P>Répondez à quelques questions — ce que vous préparez, combien, la température de votre cuisine, l’heure d’enfournement et vos indisponibilités — et Baker Hub génère votre recette, en choisissant la farine, l’hydratation et la méthode qui conviennent au style. Pour une fournée au levain, il demande aussi où en est <strong style={{ color: CHAR }}>votre levain</strong> : sur le plan de travail, au réfrigérateur, ou bien monté et bullé en ce moment ; ses rafraîchis sont planifiés à partir de cette réponse. Si l’heure de cuisson tombe pendant vos indisponibilités, une seule fenêtre nomme le conflit et propose l’heure la plus proche qui convient (ou, si seule la sortie du frigo pose problème, vous laisse garder votre heure avec quelqu’un qui s’en charge).</P>
            <P>La recette donne d’abord la pâte entière, puis chaque étape — poolish, biga ou levain, puis pâte finale — et les étapes s’additionnent pour former la pâte entière ; personnaliser ajoute le pourcentage du boulanger de chaque ingrédient. Chaque fournée ajoute 1,5 % au total pour la pâte qui reste dans le bol et sur les mains, afin que le dernier pâton pèse autant que les autres. Vient ensuite <B>Votre plan</B> : les étapes clés et leurs heures, et toutes les étapes à une touche. La Préparation vous guide pas à pas ; son récapitulatif permet d’ajouter le plan à votre agenda, avec un rappel pour chaque moment où vous devez être là. L’ajouter à nouveau après un changement met ces événements à jour.</P>
            <p style={{ margin: 0, ...bodyText }}><B>Personnaliser ma fournée</B> est là quand vous voulez aller plus loin, avant de générer la recette ou à tout moment ensuite depuis Ma fournée : matériel (four, puis pétrissage), températures de la cuisine et du frigo, eau, farine (produit ou mélange, et sa conservation), préferment (poolish, biga ou direct ; pour le poolish, au frigo, à température ambiante ou là où le planning convient le mieux), levure, réglages fins (hydratation, sel, huile, sucre, température de pâte, et votre propre quantité de levure ou de levain), puis heure de cuisson. Les pains au levain ont une étape Levain à la place du préferment : où il est, quand et comment il a été rafraîchi. Les mêmes moteurs tournent dans tous les cas ; personnaliser montre leurs entrées.</p>
          </>
        ),
      },
      {
        title: 'Planifié autour de vos indisponibilités',
        body: (
          <>
            <P>Chaque planning s’organise autour de vos indisponibilités : heures de travail, nuits, ou toute période ajoutée. <B>Les nuits (23 h–7 h) sont cochées par défaut</B> — décochez-les si vous acceptez de vous lever — et même alors, le planning évite les étapes entre 23 h et 7 h sauf si elles servent vraiment la fournée.</P>
            <P>Seules les étapes manuelles demandent votre présence : pétrissage, rabats, façonnage, rafraîchi du levain, mise au frigo ou sortie du frigo, cuisson. La pousse se fait sans vous, pendant votre journée de travail ou votre nuit. Une étape peut tomber pile au début ou à la fin d’une indisponibilité, jamais pendant.</P>
            <p style={{ margin: 0, ...bodyText }}>Quand une heure de cuisson ne convient pas, vous avez une seule décision — l’heure la plus proche qui convient, avec la raison. Une fois votre fournée personnalisée, vous voyez chaque étape concernée, pouvez indiquer une étape que quelqu’un d’autre fera, et obtenez les heures de cuisson possibles.</p>
          </>
        ),
      },
      {
        title: 'Comment les moteurs s’enchaînent',
        body: (
          <>
            <P>Les moteurs de Baker Hub forment une chaîne où chaque sortie alimente la suivante.</P>
            <P><B>Le style et le four</B> définissent le plan de fermentation — pousse au froid visée, temps à température ambiante, hydratation de base. <B>La farine</B> ajuste ce plan par sa tolérance à la fermentation : une farine plus forte prend une pousse au froid plus longue, et la levure est calculée pour ces heures plus longues. <B>La température de la cuisine</B> donne la vitesse de tout le reste.</P>
            <P>Ces contraintes posées, le <B>planificateur</B> trouve la meilleure heure de pétrissage pour votre disponibilité réelle, avec les heures à température ambiante et au frigo. Le <B>moteur de levure</B> suit la température de la pâte pendant ces heures et calcule la quantité (pour le levain, c’est le <B>moteur de levain</B> qui planifie les rafraîchis et la quantité). En personnalisant votre fournée, vous pouvez fixer vous-même la quantité de levure ou de levain ; le planning est alors recalé sur elle. Enfin s’ajoutent l’<B>hydratation</B> et la <B>température de l’eau</B>.</P>
            <p style={{ margin: 0, ...bodyText }}>Modifiez n’importe quelle entrée et tout ce qui suit se recalcule.</p>
          </>
        ),
      },
      {
        title: 'Style & four',
        body: (
          <>
            <P>Chaque style porte un plan de fermentation : la pousse au froid et le temps à température ambiante qui amènent la pâte au mieux à la cuisson.</P>
            <Table headers={['Style', 'Frigo', 'Température ambiante']} rows={[
              ['Napolitaine, New York', '24 h', '2 h'],
              ['Pain de campagne', '18 h', '3 h'],
              ['Pain au levain', '16 h', '4 h'],
              ['Baguette', '12 h', '2 h'],
              ['Brioche', '8 h (toujours)', '2 h'],
              ['Romaine', '—', '6 h'],
              ['Pizza en moule', '—', '5 h'],
            ]} />
            <P>Le four façonne la recette indépendamment. L’hydratation suit le four : four à pizza −2 %, four à pizza électrique −1 %, four domestique avec pierre ou acier +3 %, four domestique standard +4 % ; pour le pain, cocotte et pierre ou acier +2 %, four vapeur et four domestique standard +3 %, four à bois et plancha 0. Les pâtes enrichies ou riches en huile n’en prennent que la moitié. Les fours à pizza, classiques ou électriques, se passent d’huile et de sucre : leur chaleur colore la croûte seule. Chaque valeur est modifiable en personnalisant votre fournée.</P>
            <p style={{ margin: 0, ...bodyText }}><B>Le préchauffage</B> se place en fin de planning, de 5 minutes pour une plancha à 60 minutes pour un four domestique avec pierre, pour que le four soit chaud quand la pâte est prête.</p>
          </>
        ),
      },
      {
        title: 'Température de la cuisine & du frigo',
        body: (
          <>
            <P>Une pâte plus chaude fermente plus vite. Une seule courbe d’activité, ajustée sur des doses publiées, dit de combien à chaque température de pâte (voir Le moteur de levure) ; il n’existe pas de règle fixe du type « deux fois plus vite tous les cinq degrés ».</P>
            <BulletList items={[
              <>Dans une <B>cuisine chaude</B> (28 °C ou plus), le planificateur raccourcit les étapes à température ambiante (pointage dès 30 minutes au lieu d’1 h 30) et s’appuie sur le frigo. Le modèle de levure suit la température réelle de la pâte : il part de la température de pâte visée (l’eau froide fait gagner du temps), continue d’accélérer jusqu’à 35 °C environ, et vise une pousse plus faible pour une pâte qui finit au-dessus de 25 °C.</>,
              <>La <B>température du frigo</B> compte plus qu’il n’y paraît. Une heure à 6 °C fait environ 1,6 fois le travail d’une heure à 4 °C, et environ un neuvième d’une heure à 25 °C. La pâte met aussi du temps à refroidir puis à se réchauffer — environ 1,6 heure pour combler l’essentiel de l’écart pour un pâton de 250 g, 2,8 heures pour 1 kg — et le modèle le suit. Un frigo plus chaud demande moins de levure ; un plus froid, davantage.</>,
              <>Pour l’<B>hydratation</B> : une cuisine à 28 °C ou plus, ou très humide, prend −2 % ; une cuisine à 18 °C ou moins, +2 %. C’est une correction de manipulation, pas de fermentation.</>,
            ]} />
          </>
        ),
      },
      {
        title: 'La farine',
        body: (
          <>
            <P>La base de farines de Baker Hub contient une sélection vérifiée de farines de marque et génériques. W décrit la force mesurée ; les valeurs publiées sont distinguées des estimations. Chaque farine porte deux nombres qui se répercutent sur la recette et le planning.</P>
            <p style={{ margin: '0 0 12px', ...bodyText }}><B>Tolérance à la fermentation</B> — la fermentation que la farine supporte, par rapport à une farine à pizza 00 W 250 à 1,0 : Manitoba 1,35, 00 forte 1,2, farine à pain 0,9, semoule 0,85, farine complète 0,8, farine tout usage 0,75, seigle 0,7. Une farine de blé blanche dont le W est indiqué — saisi depuis le sachet, lu sur son étiquette ou publié pour le produit — prend sa tolérance de ce W : 0,75 à W 130, 0,9 à W 200, 1,0 à W 250, 1,2 à W 300 et 1,35 à W 360, en ligne droite entre ces points et constante au-delà. Un W estimé suit le type de farine ; seigle, complète et semoule gardent la valeur de leur type. Les mélanges sont pondérés par leurs proportions. La tolérance ajuste la pousse au froid visée par le style (24 heures deviennent environ 29 avec une farine à 1,2) et la quantité de levain. La levure est calculée pour les heures du planning : une farine plus forte en reçoit un peu moins uniquement par sa pousse au froid plus longue.</p>
            <p style={{ margin: 0, ...bodyText }}><B>Hydratation</B> — l’eau que la farine demande en plus de la base du style : seigle +6 %, complète +4 %, Manitoba +3 %, 00 forte +2 %, farine à pain +1 %, 00 à pizza 0, semoule −1 %, tout usage −2 %. Les mélanges et les produits de marque restent entre −5 et +8 %. L’hydratation suit le type de farine, jamais son W : le W se mesure à teneur en eau fixe et ne dit pas combien d’eau une farine absorbe.</p>
          </>
        ),
      },
      {
        title: 'L’hydratation',
        body: (
          <>
            <P>L’hydratation se construit par couches, toutes visibles en personnalisant votre fournée :</P>
            <NumberedList items={[
              <><B>Base du style</B> — napolitaine et New York 62 %, baguette 68 %, pizza en moule 70 %, pain au levain 75 %, romaine 78 %</>,
              <><B>Four</B> — de −2 % (four à pizza) à +4 % (four domestique standard), la moitié pour les pâtes enrichies ou riches en huile</>,
              <><B>Cuisine</B> — 28 °C ou plus, ou très humide : −2 % · 18 °C ou moins : +2 %</>,
              <><B>Farine</B> — la correction propre au type de farine, de −2 % (tout usage) à +6 % (seigle)</>,
              <><B>Plancher du style</B> — un minimum par style quelles que soient les corrections (napolitaine 56 %, baguette 65 %, romaine 70 %)</>,
            ]} />
            <p style={{ margin: '14px 0 0', ...bodyText }}>L’hydratation ne change pas le planning : aucune source publiée ne chiffre son effet sur la vitesse de fermentation, donc les modèles la laissent de côté. Observez la pâte.</p>
          </>
        ),
      },
      {
        title: 'La température de l’eau',
        body: (
          <>
            <P>La température de l’eau vient d’un bilan thermique de ce qui est réellement dans le bol : farine, eau, poolish, biga ou levain à sa propre température, chaleur du pétrissage et, si besoin, glace. Elle vise la température de pâte en fin de pétrissage : 23 °C pour la napolitaine, 22 °C pour la brioche, 25 °C pour la romaine et la pizza en moule, 24 °C pour la plupart des pains.</P>
            <P>La chaleur du pétrissage est un rythme multiplié par le temps de pétrissage du guide :</P>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
              {['À la main 0,16 °C/min · 10 min', 'Robot 0,6 °C/min · 8 min', 'Spirale 0,55 °C/min · 14 min', 'Sans pétrissage 0'].map(l => (
                <span key={l} style={{ ...monoSm, padding: '3px 12px', borderRadius: '20px', background: 'rgba(43, 36, 32,0.06)' }}>{l}</span>
              ))}
            </div>
            <P>La farine et l’eau du levain entrent dans le bilan à la température du levain : celle de la cuisine après un rafraîchi, en partie réchauffée s’il sort du frigo, ou celle que vous avez mesurée. L’eau reste entre 2 et 40 °C. Quand elle devrait être plus froide que l’eau dont vous disposez, on en met une partie sous forme de glace (à partir de 50 g de glace ; en dessous, la recette demande de l’eau fraîche). La ligne de l’eau dit comment atteindre la température sans thermomètre. Mesurez la pâte après le pétrissage.</P>
            <Maths fr={true}>
              <Eq>{'(cible − chaleur du pétrissage) × (c_farine·m_farine + c_eau·m_eau + c_pref·m_pref)\n  = c_farine·m_farine·T_farine + c_pref·m_pref·T_pref + c_eau·m_eau·T_eau\nc_eau 4,18 kJ/kg·K · c_farine 1,8 kJ/kg·K · chaleur du pétrissage = rythme × minutes'}</Eq>
            </Maths>
          </>
        ),
      },
      {
        title: 'Le moteur de planning',
        body: (
          <>
            <P>Le planificateur remonte depuis votre heure de cuisson. Il remplit la fenêtre avec une pousse au froid jusqu’à la durée préférée du style (ajustée par la tolérance de la farine), puis place le pointage, la division et le façonnage, et l’apprêt, en gardant les étapes manuelles hors de vos indisponibilités. Si c’est impossible à votre heure, il propose l’heure la plus proche qui convient, en regardant d’abord jusqu’à quatre jours plus loin.</P>
            <BulletList items={[
              <>Minimums : un pointage d’1 h 30 (30 minutes dans une cuisine à 28 °C ou plus) et un apprêt d’1 heure.</>,
              <>Une baguette façonnée ne pousse pas plus longtemps que ce que valent 1 h 30 à 24 °C selon le modèle de levure : environ 2 heures jusqu’à la cuisson à 20 °C, 2 h 30 à 18 °C, 3 heures à 16 °C, comme dans la pratique professionnelle (Hamelman, Grands Moulins de Paris, King Arthur). Le frigo prend le temps en plus ; un planning sans froid reste à température ambiante, et cette limite n’ajoute aucune étape entre 22 h et 7 h.</>,
              <>Cuisine chaude avec 16 heures ou plus avant la cuisson (28 °C ou plus) : deux passages au froid — la pâte en pointage va au frigo, elle est divisée, les pâtons y retournent — et une remise en température de 45 minutes (30 minutes dès 30 °C) avant l’apprêt.</>,
              <>Les heures sont arrondies au quart d’heure. Le frigo est pris à 6 °C sauf indication contraire.</>,
              <>Un plan assez long pour passer par le frigo peut fermenter moins qu’un plan un peu plus court à température ambiante (le frigo conserve la pâte) : la levure est toujours calculée pour le parcours propre au plan.</>,
            ]} />
            <p style={{ margin: 0, ...bodyText }}>Deux boulangers avec la même recette mais des plannings, cuisines et farines différents obtiennent des quantités de levure et des horaires différents. C’est tout l’intérêt.</p>
          </>
        ),
      },
      {
        title: 'Poolish & biga',
        body: (
          <>
            <P>Un poolish (100 % d’hydratation) ou une biga (45 %) est une partie de la farine fermentée avant la pâte finale, pour la saveur et l’extensibilité. Sa levure est dosée pour qu’il culmine au pétrissage selon son propre parcours — préparé à la température de la cuisine, temps au frigo et remise en température compris. La pâte finale reçoit sa propre levure pour le temps du pétrissage à la cuisson.</P>
            <BulletList items={[
              <><B>Poolish à température ambiante</B> — le planificateur vise environ 11 heures à 22 °C (12 pour le pain), 9 à 24 °C, 7 à 26 °C, 5 à 28 °C, 4 à 30 °C et 3 dès 32 °C, utilisable d’1 h 30 avant à 2 heures après cette cible en cuisine fraîche (moins en cuisine chaude), jamais au-delà de 16 heures.</>,
              <><B>Poolish au frigo</B> — visé à 22 − 1,5 × la température du frigo, en heures (13 heures à 6 °C, entre 10 et 22), utilisable de 8 à 24 heures dans un frigo à 6 °C ou moins.</>,
              <><B>Biga</B> — toujours au frigo, visée à 48 heures, utilisable de 24 à 58, jamais au-delà de 72. Elle passe directement du frigo au pétrissage.</>,
            ]} />
            <P>Pour un poolish, le planificateur compare le frigo et la température ambiante et garde le meilleur plan, sauf si vous avez fixé la conservation en personnalisant votre fournée. Quand la levure d’un poolish est à la plus petite quantité utilisée (0,05 %) et que sa fenêtre est longue, il peut culminer avant le pétrissage. Il reste utilisable jusqu’à son pic plus ⅓ de son temps de montée (au moins ¾ d’heure à 2 heures selon la cuisine) à température ambiante, ou 12 heures après son pic au frigo. Au-delà, le planificateur le passe au frigo ou le commence plus tard.</P>
          </>
        ),
      },
      {
        title: 'Lire votre planning',
        body: (
          <>
            <P>Votre planning donne chaque intervention une fois, avec son heure : préparer le poolish ou rafraîchir le levain, pétrissage, rabats, mise au frigo et sortie, façonnage, préchauffage et cuisson. La pousse se fait entre les deux. Une pâte à la levure du commerce n’a pas besoin de courbe : sa levure est dosée pour les heures et les températures propres au planning.</P>
            <p style={{ margin: '0 0 10px', ...bodyText }}><B>Poolish et biga.</B> La ligne « Préparer le poolish » (ou la biga) dit où il attend jusqu’au pétrissage : au réfrigérateur, directement au réfrigérateur, ou à température ambiante jusqu’à l’heure de sa mise au froid.</p>
            <p style={{ margin: '0 0 10px', ...bodyText }}><B>Levain.</B> Quand vous personnalisez une fournée au levain, un bandeau entre le rafraîchi avant pétrissage et le pétrissage montre les rafraîchis, vos indisponibilités, le pétrissage et les heures où le levain compte comme prêt (« prêt 16h–19h »). Cette fenêtre est la tolérance du planificateur autour du pic estimé — 15 % du temps de montée de part et d’autre (1 à 3 heures), une demi-heure de plus avant le pic — écrite en heures pleines comprises dedans. Le pic s’écrit au quart d’heure du planning (« vers 17h45 »), la même valeur sur la carte du levain, le bandeau et les lignes de rafraîchi. C’est une estimation : vérifiez la montée du levain avant de pétrir.</p>
            <p style={{ margin: 0, ...bodyText }}>Dans la Préparation, l’étape où l’horloge vous situe est marquée Maintenant. Cocher une étape est facultatif ; une autre heure saisie décale le reste du planning avec elle.</p>
          </>
        ),
      },
      {
        title: 'Le moteur de levain',
        body: (
          <>
            <P>Un levain vivant ne suit pas d’horloge fixe : son rythme dépend de sa conservation, du moment et de la façon dont il a été rafraîchi, de sa maturité et de la chaleur de votre cuisine. Baker Hub estime chacun de ces facteurs et planifie les rafraîchis à rebours depuis votre cuisson.</P>

            <Sub>Ce qu’il vous demande</Sub>
            <P>Où est votre levain, quand il a été rafraîchi et à quel ratio ; personnaliser demande aussi s’il est mature et s’il contient du seigle. Ces réponses estiment un planning de rafraîchis. Elles ne mesurent pas sa vitalité : observez sa montée avant de pétrir.</P>

            <Sub>À quelle vitesse il culmine</Sub>
            <P>Un levain de blé mature rafraîchi à 1:1:1 culmine environ :</P>
            <Table headers={['Cuisine', 'Du rafraîchi au pic']} rows={[
              ['18 °C', '10 h 15'], ['22 °C', '6 h 45'], ['26 °C', '4 h 30'], ['30 °C et plus', '3 h'],
            ]} />
            <P>Un rafraîchi plus important a plus de chemin à parcourir : 1:2:2 prend environ 1,35 fois plus de temps, 1:5:5 environ 1,8 fois, 1:10:10 environ 2,15 fois. Un levain jeune prend 1,2 fois plus de temps, un levain de seigle 0,8 fois. Au-delà de 30 °C, l’estimation garde sa valeur à 30 °C, faute de données solides.</P>

            <Sub>Le premier rafraîchi après un repos</Sub>
            <P>Un levain rafraîchi il y a longtemps — passé son pic, épuisé, ou au repos au frigo — démarre le rafraîchi suivant avec moins de levures actives, et ce rafraîchi monte plus lentement : jusqu’à 1,5 fois plus longtemps après un long repos. Le planificateur l’applique au premier rafraîchi qui suit le dernier que vous avez noté, quel qu’il soit dans le plan, pour un levain sur le plan de travail comme au frigo, et place les rafraîchis de la mise en route à rebours depuis celui d’avant le pétrissage. Un rafraîchi donné avant que le précédent ait culminé monte aussi plus lentement, jusqu’à 20 %.</P>

            <Sub>Réveiller un levain au frigo</Sub>
            <Table headers={['Dernier rafraîchi', 'Rafraîchis (mature)', 'Rafraîchis (jeune)']} rows={[
              ['Aujourd’hui', '0', '0'], ['Hier', '0', '1'], ['Il y a 2–3 jours', '1', '1'], ['Il y a 4–5 jours', '1', '2'], ['Une semaine ou plus', '2', '2'],
            ]} />
            <P>Sorti du frigo, le levain a 1 h 30 pour se réchauffer dans une cuisine sous 26 °C, 1 heure jusqu’à 28 °C, 45 minutes jusqu’à 30 °C et 30 minutes au-delà. Pour une cuisson dans plusieurs jours, le réveil se place juste avant, avec les rafraîchis de l’âge qu’aura alors le levain : il continue de vieillir au frigo. Prenez ce nombre comme point de départ et suivez l’activité réelle du levain.</P>

            <Sub>Quand il compte comme prêt</Sub>
            <P>Le planificateur compte le levain comme prêt dans une fenêtre autour de son pic estimé : 15 % de son temps de montée de part et d’autre (entre 1 et 3 heures), plus une demi-heure avant le pic. Le pétrissage est placé dans cette fenêtre.</P>

            <Sub>Un pot, deux fournées</Sub>
            <P>Quand deux fournées au levain en cours utilisent le même levain et que le pétrissage de la seconde tombe dans la fenêtre de maturité du rafraîchi d’avant pétrissage de la première, un seul rafraîchi sert aux deux : il est dosé pour les deux levains et indiqué une fois, avec la quantité de chaque fournée.</P>

            <Sub>Ratio et timing du rafraîchi</Sub>
            <P>Le ratio de rafraîchi (1:1:1, 1:2:2, 1:4:4, 1:5:5 ou 1:10:10) est un levier discret mais puissant. Si votre rafraîchi idéal tombe au milieu de la nuit ou de votre journée de travail, le moteur peut <B>recommander un autre ratio</B> qui amène le pic à une heure praticable, et dit en mots simples ce qu’il a changé et pourquoi — par exemple, un rafraîchi à 3 h devient un rafraîchi à 7 h à un ratio plus élevé. Gardez votre ratio habituel, ou suivez la suggestion.</P>

            <Sub>Planifié autour de votre vie</Sub>
            <P>Les rafraîchis et le pétrissage sont déplacés hors de vos indisponibilités partout où la biologie le permet. Quand une heure de cuisson laisse trop peu de marge, le moteur le dit et suggère la première cuisson qui convient.</P>

            <Sub>Le goût, si vous le souhaitez</Sub>
            <P><B>Plus acidulé</B> allonge la pousse au froid jusqu’à 15 %, dans les limites du style — plus d’acidité, plus de profondeur. <B>Plus doux</B> la raccourcit jusqu’à 15 % et ajoute un rafraîchi à un levain au repos depuis deux jours ou plus — plus tendre, plus doux. <B>Équilibré</B> garde le timing standard. Les ingrédients ne changent jamais.</P>

            <Sub>Quelle quantité de levain</Sub>
            <P>La quantité recommandée suit votre cuisine — moins dans une cuisine chaude, plus dans une cuisine fraîche — et le temps entre le dernier rafraîchi et le pétrissage. À cette quantité, le pointage à température ambiante dure environ 5 heures à 22 °C, deux fois moins par tranche de 10 °C de plus. En personnalisant votre fournée, vous pouvez fixer la vôtre : moins de levain met plus de temps, donc le pointage est recalé avec une régression sur des pâtes réelles (Craig, pizzamaking.com), cohérente avec les tableaux contrôlés de The Sourdough Journey. À 22 °C, la moitié de la quantité recommandée allonge un pointage de 5 heures à environ 7 h 30. Les phases au froid ne sont pas recalées. Quand aucun planning ne tient dans votre temps libre à la quantité recommandée, le planificateur peut augmenter le levain par paliers de 2,5 points jusqu’à 30 % de la farine, seulement si votre pot peut le fournir.</P>

            <Sub>Si vous suivez déjà votre levain</Sub>
            <P>Vous préférez surveiller votre pot vous-même ? Passez à <B>« Je sais quand mon levain sera à son pic »</B> et donnez l’heure directement au moteur — il construit le plan à rebours à partir de là, sans l’estimation.</P>

            <Maths fr={true}>
              <Eq>{'du rafraîchi au pic (h) = 5,5 × 2,8^((24 − T)/10) × seigle × maturité × (1 + 0,5 · ln r)\n  T cuisine °C (plafonnée à 30) · seigle 0,8 · jeune 1,2 · rafraîchi 1:r:r\népuisé après 1,8 × le temps jusqu’au pic\nprêt : pic − (tol + 0,5 h) … pic + tol, tol = 0,15 × temps jusqu’au pic, 1–3 h'}</Eq>
              <Table headers={['Heures depuis le dernier rafraîchi', 'Montée du premier rafraîchi']} rows={[
                ['jusqu’à son temps de montée', '× 1'], ['jusqu’à 1,5 fois ce temps', '× 1,05'], ['jusqu’à l’épuisement', '× 1,15'],
                ['jusqu’à 1,5 × l’épuisement', '× 1,25'], ['jusqu’à 2,5 × l’épuisement', '× 1,35'], ['au-delà', '× 1,5'],
              ]} />
              <Eq>{'pointage au levain recommandé = 5 × 2^((22 − T)/10) h   (T plafonnée à 30)\nvotre quantité p : pointage × h(p) / h(recommandée),  h(p) = −5,368 · ln p − 0,6014\n  p = levain ÷ farine, 5–30 % (régression de Craig à 24 °C)\nau frigo, un levain monte 2^((T − T_frigo)/10) fois plus lentement'}</Eq>
            </Maths>
          </>
        ),
      },
      {
        title: 'Le moteur de levure',
        body: <YeastModelSectionFr />,
      },
      {
        title: 'Ce que les modèles laissent de côté',
        body: (
          <>
            <P>Baker Hub utilise des modèles simplifiés ajustés sur des données publiées. Ils laissent de côté :</P>
            <BulletList items={[
              'L’état exact des micro-organismes de votre levain — le moteur modélise la conservation, le temps depuis le dernier rafraîchi, la maturité et la température, mais il ne voit pas votre pot. Si vous suivez les pics vous-même, « Je sais quand mon levain sera à son pic » donne le meilleur ajustement.',
              'Le sel, l’hydratation et le type de farine comme facteurs de vitesse de fermentation : aucune source publiée ne les chiffre.',
              'L’altitude, qui modifie un peu la fermentation et le comportement du four.',
              'L’humidité au-delà de la correction de ±2 % d’hydratation, et la dureté de l’eau.',
              'La variation des protéines entre sacs d’une même farine, et la masse thermique de votre four précis.',
            ]} />
            <p style={{ margin: 0, ...bodyText }}>C’est pourquoi chaque étape du guide donne le repère visuel à observer, et pourquoi Maestro est là pour regarder votre pâte avec vous.</p>
          </>
        ),
      },
      {
        title: 'Vos préférences & vos propres pizzas',
        body: (
          <>
            <P>Ouvrez le menu → <B>Préférences de cuisine</B> pour régler vos valeurs par défaut une fois pour toutes : four à pizza et four à pain (indépendamment), pétrin, levure, préferment préféré, température du frigo, style favori par type de cuisson, personnalisation par défaut ou non, les traits de votre levain, et vos indisponibilités habituelles. Tout s’enregistre au fil des touches et préremplit chaque nouvelle fournée, toujours modifiable à chaque étape. Connecté·e, vos préférences se synchronisent avec votre compte et vous suivent d’un appareil à l’autre.</P>
            <p style={{ margin: 0, ...bodyText }}><B>Créez votre propre pizza</B> depuis la liste Pizzas : ingrédients du catalogue ou en texte libre, groupe par groupe (base, fromages, viandes & mer, légumes, finitions). Ajoutez une photo et recadrez-la en la glissant. Vos créations vivent dans vos préférences, reviennent à chaque soirée, et alimentent la liste de courses, la préparation et la fiche de cuisson — avec des conseils de four déduits de leurs ingrédients.</p>
          </>
        ),
      },
      {
        title: 'Pizzas — de la pâte à la table',
        body: (
          <>
            <P>Une fois la pâte planifiée, le reste de la soirée s’organise aussi. Le catalogue réunit des pizzas salées et des pizzas desserts sélectionnées, classées par tradition, occasion et goût, chacune associée aux styles de pâte qui lui conviennent — une Detroit n’apparaît jamais pour une pâte napolitaine. Filtres alimentaires :</P>
            <DietPills fr={true} />
            <P>Choisissez vos pizzas et Baker Hub adapte chaque garniture à votre quantité, avec la perte et la portion de chaque ingrédient, et planifie la préparation des garnitures à rebours depuis la cuisson : égoutter la mozzarella, trancher la charcuterie, déchirer le basilic juste avant de servir.</P>
            <p style={{ margin: 0, ...bodyText }}>La liste de courses réunit la pâte et les garnitures en une seule liste, et Cuisson & service suit ce qui est cuit et ce qui vient ensuite.</p>
          </>
        ),
      },
      {
        title: 'Maestro — l’aide en chemin',
        body: (
          <p style={{ margin: 0, ...bodyText }}>Dans le guide pas à pas, <B>Demander au Maestro</B> répond à une question sur l’étape, regarde une photo de votre pâte ou de votre cuisson, ou les deux. Il connaît votre recette, votre four, votre style et l’étape où vous en êtes : sa réponse porte sur votre fournée, pas sur un cas général — signes de fermentation, alvéolage de la mie, couleur de la croûte, taches sur la couronne. Il dit ce qu’une photo peut montrer et ce qu’elle ne montre pas.</p>
        ),
      },
      {
        title: 'Sessions — sauvegarder, reprendre, refaire, partager',
        body: (
          <>
            <P>Connectez-vous (lien reçu par e-mail, ou Google) et chaque fournée devient une <B>session</B> à laquelle vous pouvez revenir : pâte, planning, état du levain, sélections de pizzas, et photos du résultat. Pas connecté·e ? Votre fournée en cours reste sur cet appareil.</P>
            <BulletList items={[
              <><B>Reprendre</B> — rouvrez une fournée là où vous l’aviez laissée.</>,
              <><B>Refaire</B> — une touche copie une fournée au même jour et à la même heure la semaine suivante, avec son planning et vos indisponibilités décalés d’autant.</>,
              <><B>Photos</B> — ajoutez des photos de chaque fournée pour construire votre journal de boulange.</>,
              <><B>Partager</B> — exportez une session en carte (format post, carré ou story) avec recette, planning et photos. Taguez <B>@bakerhub</B> et <B>#BakerHub</B> — nous serions ravis de la voir.</>,
            ]} />
          </>
        ),
      },
      {
        title: 'Bêta & retours',
        body: (
          <>
            <P>Baker Hub est en bêta et des problèmes surviennent parfois. Si une quantité de levure semble incorrecte, si le planning ne convient pas, ou si quelque chose est confus — dites-le. Chaque retour améliore les moteurs.</P>
            <div style={{ background: 'rgba(43, 36, 32,0.04)', borderRadius: '16px', padding: '16px', marginTop: '12px' }}>
              <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600, color: CHAR }}>Construit par Rom</p>
              <p style={{ margin: '0 0 12px' }}>
                <a href="mailto:rom@bakerhub.app" style={{ color: TERRA, fontFamily: 'var(--font-ui)', fontSize: '14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>rom@bakerhub.app</a>
              </p>
              <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: '13px', color: SMOKE }}>Baker Hub est un projet personnel — vos retours arrivent directement à la personne qui construit les moteurs.</p>
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
  const fr = locale === 'fr';
  const c = (CONTENT[locale] ?? CONTENT.en) as LocaleContent;
  const home = fr ? '/fr' : '/';

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh', paddingBottom: 'calc(48px + env(safe-area-inset-bottom, 0px))' }}>
      {/* The sticky header carries the safe-area inset, so its Back stays below the status bar and reachable at any scroll. */}
      <div className="bh-existing-header"><Header hideActionBar backHref={home} /></div>
      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>

        <h1 style={{
          fontFamily: 'var(--font-ui)', fontSize: '28px', fontWeight: 700,
          color: CHAR, marginBottom: '4px', marginTop: '0',
        }}>{c.pageTitle}</h1>
        <p style={{ ...monoSm, marginBottom: '12px' }}>{c.pageSubtitle}</p>
        <p style={{
          fontFamily: 'var(--font-ui)', fontSize: '17px', lineHeight: 1.5,
          color: CHAR, margin: '0 0 20px',
        }}>{c.promise}</p>

        {c.sections.map((s, i) => (
          <Accordion key={i} title={s.title} defaultOpen={s.defaultOpen}>
            {s.body}
          </Accordion>
        ))}

        {/* A way back at the end of the read; the header's Back covers mid-scroll. */}
        <Link
          className="bh-primary bh-page-back-end"
          href={home}
          onClick={pageBackClick}
          aria-label={fr ? 'Retour à Baker Hub' : 'Back to Baker Hub'}
          style={{
            marginTop: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '12px 0', minHeight: '44px', borderRadius: '12px',
            background: TERRA, color: '#fff',
            fontSize: '15px', fontWeight: 500,
            fontFamily: 'var(--font-ui)', textDecoration: 'none',
          }}
        >
          {fr ? '‹ Retour à Baker Hub' : '‹ Back to Baker Hub'}
        </Link>

        <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: '24px' }} />
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '10px', marginTop: '12px',
        }}>
          <Link href={fr ? '/fr/privacy' : '/privacy'} style={{
            ...monoSm, color: SMOKE, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 8px',
          }}>
            {fr ? 'Confidentialité' : 'Privacy'}
          </Link>
          <span aria-hidden="true" style={{ ...monoSm }}>·</span>
          <Link href={fr ? '/fr/terms' : '/terms'} style={{
            ...monoSm, color: SMOKE, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 8px',
          }}>
            {fr ? 'Conditions' : 'Terms'}
          </Link>
        </div>
        <p style={{ ...monoSm, textAlign: 'center', marginTop: '12px', marginBottom: 0 }}>
          {c.footer}
        </p>

      </main>
    </div>
  );
}
