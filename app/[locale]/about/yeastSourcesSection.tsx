'use client';
// "Behind the yeast model: comparing the sources" on the About page: how the dose law was fitted.
// The chart reads yeastCollapse.json (built from the shipped model and the fit); tests/yeast-model.test.cjs
// rebuilds it and checks every number quoted here. Bakers read it without access to any project file:
// the text names its sources and never points at the repository.
import React, { useState } from 'react';
import collapse from './yeastCollapse.json';

const CHAR = '#2B2420';
const SMOKE = '#6B635D';
const BORDER = '#E0D8CC';
const TERRA = '#6B4423';
const CREAM = '#F0EBE0';
const text: React.CSSProperties = { fontFamily: 'var(--font-ui)', fontSize: '15px', lineHeight: 1.65, color: CHAR };
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: '13px', background: 'rgba(43,36,32,0.06)', borderRadius: '8px', padding: '8px 10px', display: 'block', overflowX: 'auto', whiteSpace: 'pre-wrap', color: CHAR };
const cell: React.CSSProperties = { padding: '8px 10px', borderTop: `1px solid ${BORDER}`, verticalAlign: 'top', fontFamily: 'var(--font-ui)', fontSize: '13px', lineHeight: 1.5, color: CHAR };
const head: React.CSSProperties = { ...cell, borderTop: 'none', fontSize: '12px', color: SMOKE, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 500, textAlign: 'left' };

function P({ children }: { children: React.ReactNode }) { return <p style={{ margin: '0 0 12px', ...text }}>{children}</p>; }
function H({ children }: { children: React.ReactNode }) { return <p style={{ margin: '16px 0 8px', ...text }}><strong>{children}</strong></p>; }
function Eq({ children }: { children: React.ReactNode }) { return <code style={{ ...mono, margin: '0 0 12px' }}>{children}</code>; }
function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto', margin: '4px 0 12px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{headers.map(h => <th key={h} style={head}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j} style={cell}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

// ── Chart: every published dose on one line ───────────────────────────────────
type Group = 'room' | 'hot' | 'cold' | 'pref';
const GROUP_COLOR: Record<Group, string> = { room: '#3D3530', hot: '#9C8248', cold: '#5E7A99', pref: '#6B7A5A' };
interface Labels { raw: string; adj: string; x: string; y: string; groups: Record<Group, string>; heldOut: string; line: string; aria: string }

function CollapseChart({ labels, locale }: { labels: Labels; locale: 'en' | 'fr' }) {
  const [view, setView] = useState<'raw' | 'adj'>('adj');
  const W = 340, Hh = 236, L = 40, R = 10, T = 10, B = 34;
  const xMin = Math.log(1), xMax = Math.log(60), yMin = Math.log(0.008), yMax = Math.log(5);
  // Rounded to 0.1 px: the server and the browser's Math.log can differ in the last digit,
  // which React reports as a hydration mismatch.
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const sx = (h: number) => r1(L + (Math.log(h) - xMin) / (xMax - xMin) * (W - L - R));
  const sy = (p: number) => r1(T + (yMax - Math.log(p)) / (yMax - yMin) * (Hh - T - B));
  const fmt = (n: number) => locale === 'fr' ? String(n).replace('.', ',') : String(n);
  const line = (h: number) => collapse.A * Math.pow(h, -collapse.b);
  const chip = (on: boolean): React.CSSProperties => ({
    minHeight: 44, padding: '0 14px', borderRadius: 20, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13,
    background: on ? CREAM : 'transparent', color: CHAR, border: `1px solid ${on ? TERRA : BORDER}`,
  });
  return (
    <figure style={{ margin: '4px 0 14px' }}>
      <div role="group" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 8px' }}>
        <button type="button" aria-pressed={view === 'raw'} style={chip(view === 'raw')} onClick={() => setView('raw')}>{labels.raw}</button>
        <button type="button" aria-pressed={view === 'adj'} style={chip(view === 'adj')} onClick={() => setView('adj')}>{labels.adj}</button>
      </div>
      <svg viewBox={`0 0 ${W} ${Hh}`} width="100%" role="img" aria-label={labels.aria} style={{ display: 'block', maxWidth: 560 }}>
        {[1, 2, 5, 10, 20, 50].map(h => (
          <g key={`x${h}`}>
            <line x1={sx(h)} x2={sx(h)} y1={T} y2={Hh - B} stroke={BORDER} strokeWidth={0.5} />
            <text x={sx(h)} y={Hh - B + 13} fontSize={10} textAnchor="middle" fill={SMOKE} fontFamily="var(--font-ui)">{h}</text>
          </g>
        ))}
        {[0.01, 0.03, 0.1, 0.3, 1, 3].map(p => (
          <g key={`y${p}`}>
            <line x1={L} x2={W - R} y1={sy(p)} y2={sy(p)} stroke={BORDER} strokeWidth={0.5} />
            <text x={L - 4} y={sy(p) + 3} fontSize={10} textAnchor="end" fill={SMOKE} fontFamily="var(--font-ui)">{fmt(p)}</text>
          </g>
        ))}
        <text x={(L + W - R) / 2} y={Hh - 4} fontSize={10} textAnchor="middle" fill={SMOKE} fontFamily="var(--font-ui)">{labels.x}</text>
        <text x={10} y={(T + Hh - B) / 2} fontSize={10} textAnchor="middle" fill={SMOKE} fontFamily="var(--font-ui)" transform={`rotate(-90 10 ${(T + Hh - B) / 2})`}>{labels.y}</text>
        {collapse.points.map((p, i) => {
          const v = view === 'raw' ? p.raw : p.adj;
          if (v < 0.008 || v > 5 || p.h < 1 || p.h > 60) return null;
          const c = GROUP_COLOR[p.g as Group];
          return p.set === 'heldout'
            ? <circle key={i} cx={sx(p.h)} cy={sy(v)} r={3} fill="none" stroke={c} strokeWidth={1.2} />
            : <circle key={i} cx={sx(p.h)} cy={sy(v)} r={2.8} fill={c} fillOpacity={0.75} />;
        })}
        <path d={[1, 1.5, 2, 3, 5, 8, 12, 20, 30, 45, 60].map((h, i) => `${i ? 'L' : 'M'}${sx(h).toFixed(1)},${sy(line(h)).toFixed(1)}`).join(' ')} stroke={TERRA} strokeWidth={1.6} fill="none" />
      </svg>
      <figcaption style={{ display: 'flex', gap: '6px 14px', flexWrap: 'wrap', margin: '6px 0 0', fontFamily: 'var(--font-ui)', fontSize: 12, color: SMOKE }}>
        {(Object.keys(GROUP_COLOR) as Group[]).map(g => (
          <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <svg width={8} height={8} aria-hidden="true"><circle cx={4} cy={4} r={3.5} fill={GROUP_COLOR[g]} /></svg>{labels.groups[g]}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <svg width={8} height={8} aria-hidden="true"><circle cx={4} cy={4} r={3} fill="none" stroke={SMOKE} strokeWidth={1.2} /></svg>{labels.heldOut}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <svg width={14} height={8} aria-hidden="true"><line x1={0} x2={14} y1={4} y2={4} stroke={TERRA} strokeWidth={1.6} /></svg>{labels.line}
        </span>
      </figcaption>
    </figure>
  );
}

// ── English ───────────────────────────────────────────────────────────────────
export function YeastSourcesSectionEn() {
  return (
    <>
      <P>For the curious: how the yeast formula is fitted to published doses, and how well it holds.</P>
      <H>The problem: sources disagree</H>
      <P>For the same schedule, published yeast amounts differ by three to five times. Most of that is not error but unstated choices: how far the dough should rise before it is “ready”, which yeast is meant (“dry yeast” can be instant or active dry), the flour, the real dough temperature, and tables copied from one another. A formula fitted naively to all of them averages these choices together.</P>
      <H>1. Collect and normalise</H>
      <P>157 published doses from 32 sources (books, professional tables, yeast-science papers, calculators, recipe sites, forums), plus 23 statements such as “twice as fast at 27 °C”. Every dose is converted to instant yeast as a % of the flour that ferments with it: fresh ÷ 3 and active dry ÷ 1.33, a preferment’s yeast against the preferment’s own flour. The yeast type is recorded exactly as the source states it; fitted both as instant and as active dry, the four rows that only say “dry” move no constant by more than a tenth of its uncertainty. Each schedule is turned into its equivalent hours at 25 °C by following the dough’s temperature, as the app does.</P>
      <H>2. Count copies once, trust sources by what they tested</H>
      <P>Sources are grouped into 28 independent lineages: a calculator built on Craig’s charts and a site restating Giorilli are the same evidence as the original, so a lineage shares one weight however many pages repeat it. Each source then gets a credibility weight, fixed before any fitting, and keeps it only in the conditions it actually tested; elsewhere it drops one level.</P>
      <Table headers={['Weight', 'Kind of source']} rows={[
        ['1.0', 'Measured dough data: Finney 1976 test bakes, Nestec’s cold gas production'],
        ['0.8', 'Tested professional tables (Modernist Pizza and Bread, Suas, Giorilli, Forkish, Lehmann) and short gas measurements (Istudor 2020)'],
        ['0.6', 'Yeast manufacturers’ dosing tables (none with times and temperatures could be reached)'],
        ['0.4', 'Recipe sites and calculators with their own basis'],
        ['0.2', 'Forums and anecdotes'],
      ]} />
      <H>3. Separate each source’s level from the shape</H>
      <P>Each source is allowed its own constant level (its idea of ready, its flour, its style). The shape of the formula — how the dose falls with time, how temperature speeds yeast up, how much a poolish or biga changes it — is then learned from how doses change within each source’s own table. The overall level is anchored on the sources that mean “about doubled”.</P>
      <Eq>{'ln dose = ln A + ln M + ln R − b · ln Heq + u(source) + e\nu(source): the source’s own level, spread ×1.87\ne: what the shape misses, spread ×1.38'}</Eq>
      <P>Most of the disagreement between sources is level, not shape. The chart shows it: every dose against its equivalent hours, on logarithmic scales, divided by the poolish, biga and warm-dough factors. Switch between the doses as published and the same doses with each source’s own level removed: the cloud closes around one line. Unweighted, the points sit a factor of 2.3 from the line on average as published and 1.8 once levels are removed; the weighted fit, which counts copies once and trusts tested sources more, follows them within 1.38.</P>
      <CollapseChart locale="en" labels={{
        raw: 'As published', adj: 'Each source’s level removed',
        x: 'Equivalent hours at 25 °C', y: 'Instant yeast % ÷ M ÷ R',
        groups: { room: 'Room temperature', hot: 'Hot kitchen', cold: 'Fridge', pref: 'Poolish and biga' },
        heldOut: 'Held out of the fit', line: 'The model',
        aria: 'Published yeast doses against equivalent hours at 25 °C, with the model’s line',
      }} />
      <H>4. Does it hold?</H>
      <Table headers={['Check', 'Result']} rows={[
        ['Seven lineages chosen at random and held out before fitting', 'Within each held-out source the model follows the shape within ×1.55 (target ×1.8)'],
        ['A brand-new source, level unknown', 'Within ×2.02 on average, as expected from the spread between sources (×2.05)'],
        ['Leftover errors against temperature and hours', 'No trend, except two reported below'],
        ['Outliers', 'Three fridge doses flagged and kept; the constants move by less than 0.6 of their uncertainty with or without them'],
      ]} />
      <P>Two patterns remain and are reported rather than tuned away. Community fridge tables use about half the yeast the model gives, because they expect the dough to rise in the fridge; measured and professional cold sources do not, and the model follows them. Long bigas carry more yeast than the model asks for, which looks like a biga held in the fridge rather than ripened there.</P>
      <H>5. Does it depend on whom we trust?</H>
      <Table headers={['Weighting', 'A', 'b', 'Tmin', 'Biga M', 'Warm R']} rows={[
        ['Equal (copies once)', '1.59', '1.18', '−6.1', '1.17', '0.76'],
        ['Credibility', '1.38', '1.15', '−3.8', '1.43', '0.75'],
        ['Measured and professional only', '2.11', '1.26', '−1.8', '3.21', '0.65'],
        ['Shipped: credibility × tested conditions', '1.41', '1.15', '−3.2', '1.55', '0.76'],
      ]} />
      <P>How the dose falls with time (b) and the warm-dough rise (R) barely move. The cold end of the temperature curve (Tmin) and the biga factor do: they depend on whose numbers you believe. With professional sources only, the overall level would be about 30 % higher — fresh-yeast sources, mostly Italian, sit lower than “fresh = 3 × instant” predicts, which a side-by-side kitchen trial can settle.</P>
      <H>6. Where the evidence is thin</H>
      <P>Hot kitchens above 28 °C, cool kitchens below 18 °C, the long fridge hold and fridge poolish each rest on fewer than three strong independent sources. They are marked low confidence and are the first kitchen trials, in order: a 30–32 °C dough, a measured fridge at 4 and 6 °C, fresh against instant at 20 °C, a fridge poolish.</P>
      <H>The sources</H>
      <P>Books and professional tables: Modernist Pizza (Vol. 4), Modernist Bread, Suas, Forkish, Lehmann, Giorilli, Pezzetta, Zaghini, The Dough Formula and the Neapolitan pizza specification (EU TSG 97/2010). Measurements: Finney et al. 1976 (test bakes), Nestec (gas production at 4–10 °C), Istudor et al. 2020 (gas production), Salvadó et al. 2011 (the yeast’s highest growth temperature) and Rosso et al. 1993 (the cardinal-temperature model). Recipe sites, calculators and forums complete the 32 sources: Weekend Bakery, fond.kitchen, dough.school, Dissapore, biancolievito, teigformel, pizzamateur and others. A new published dose with its yeast type can join the data; the constants move only if the check on the held-out sources is no worse.</P>
    </>
  );
}

// ── Français ──────────────────────────────────────────────────────────────────
export function YeastSourcesSectionFr() {
  return (
    <>
      <P>Pour les curieux : comment la formule de la levure est ajustée sur les doses publiées, et à quel point elle tient.</P>
      <H>Le problème : les sources ne sont pas d’accord</H>
      <P>Pour un même planning, les quantités de levure publiées varient de trois à cinq fois. L’essentiel n’est pas une erreur mais des choix non dits : jusqu’où la pâte doit lever pour être « prête », quelle levure est visée (« levure sèche » peut être instantanée ou active), la farine, la vraie température de la pâte, et des tableaux recopiés les uns des autres. Une formule ajustée naïvement sur tout cela fait la moyenne de ces choix.</P>
      <H>1. Rassembler et normaliser</H>
      <P>157 doses publiées issues de 32 sources (livres, tableaux professionnels, articles scientifiques sur la levure, calculateurs, sites de recettes, forums), plus 23 affirmations du type « deux fois plus vite à 27 °C ». Chaque dose est convertie en levure instantanée, en % de la farine qui fermente avec elle : fraîche ÷ 3, sèche active ÷ 1,33, la levure d’un préferment rapportée à la farine du préferment. Le type de levure est noté exactement comme la source l’écrit ; ajustées comme instantanée puis comme sèche active, les quatre lignes qui disent seulement « sèche » ne déplacent aucune constante de plus d’un dixième de son incertitude. Chaque planning devient ses heures équivalentes à 25 °C en suivant la température de la pâte, comme le fait l’app.</P>
      <H>2. Compter les copies une fois, croire chaque source sur ce qu’elle a testé</H>
      <P>Les sources sont regroupées en 28 lignées indépendantes : un calculateur construit sur les courbes de Craig ou un site qui reprend Giorilli apportent la même preuve que l’original, donc une lignée partage un seul poids, quel que soit le nombre de pages qui la répètent. Chaque source reçoit ensuite un poids de crédibilité, fixé avant tout ajustement, qu’elle garde seulement dans les conditions qu’elle a réellement testées ; ailleurs, elle descend d’un niveau.</P>
      <Table headers={['Poids', 'Type de source']} rows={[
        ['1,0', 'Mesures sur pâte : cuissons d’essai de Finney 1976, production de gaz au froid mesurée par Nestec'],
        ['0,8', 'Tableaux professionnels éprouvés (Modernist Pizza et Bread, Suas, Giorilli, Forkish, Lehmann) et mesures courtes de gaz (Istudor 2020)'],
        ['0,6', 'Tableaux de dosage des fabricants de levure (aucun avec durées et températures n’a pu être consulté)'],
        ['0,4', 'Sites de recettes et calculateurs avec leur propre base'],
        ['0,2', 'Forums et témoignages'],
      ]} />
      <H>3. Séparer le niveau de chaque source de la forme</H>
      <P>Chaque source a droit à son propre niveau constant (son idée de « prête », sa farine, son style). La forme de la formule — comment la dose baisse avec le temps, comment la température accélère la levure, ce que change un poolish ou un biga — s’apprend alors à partir des variations de dose à l’intérieur du tableau de chaque source. Le niveau général est ancré sur les sources qui visent « environ le double ».</P>
      <Eq>{'ln dose = ln A + ln M + ln R − b · ln Héq + u(source) + e\nu(source) : le niveau propre de la source, dispersion ×1,87\ne : ce que la forme ne capte pas, dispersion ×1,38'}</Eq>
      <P>L’essentiel du désaccord entre sources est une question de niveau, pas de forme. Le graphique le montre : chaque dose en fonction de ses heures équivalentes, en échelles logarithmiques, divisée par les facteurs du poolish, du biga et de la pâte chaude. Passez des doses telles que publiées aux mêmes doses sans le niveau propre de chaque source : le nuage se resserre autour d’une seule droite. Sans pondération, les points sont en moyenne à un facteur 2,3 de la droite tels que publiés, et 1,8 une fois les niveaux retirés ; l’ajustement pondéré, qui compte les copies une fois et fait davantage confiance aux sources éprouvées, les suit à 1,38 près.</P>
      <CollapseChart locale="fr" labels={{
        raw: 'Telles que publiées', adj: 'Niveau de chaque source retiré',
        x: 'Heures équivalentes à 25 °C', y: '% de levure instantanée ÷ M ÷ R',
        groups: { room: 'Température ambiante', hot: 'Cuisine chaude', cold: 'Frigo', pref: 'Poolish et biga' },
        heldOut: 'Écartée de l’ajustement', line: 'Le modèle',
        aria: 'Doses de levure publiées en fonction des heures équivalentes à 25 °C, avec la droite du modèle',
      }} />
      <H>4. Est-ce que ça tient ?</H>
      <Table headers={['Vérification', 'Résultat']} rows={[
        ['Sept lignées tirées au sort et écartées avant l’ajustement', 'Au sein de chaque source écartée, le modèle suit la forme à ×1,55 près (objectif ×1,8)'],
        ['Une source toute nouvelle, niveau inconnu', 'À ×2,02 près en moyenne, comme l’annonce la dispersion entre sources (×2,05)'],
        ['Erreurs restantes selon la température et la durée', 'Aucune tendance, sauf les deux signalées plus bas'],
        ['Valeurs aberrantes', 'Trois doses au frigo signalées et conservées ; les constantes bougent de moins de 0,6 fois leur incertitude avec ou sans elles'],
      ]} />
      <P>Deux tendances subsistent et sont signalées plutôt que gommées. Les tableaux communautaires pour le frigo mettent environ moitié moins de levure que le modèle, parce qu’ils comptent sur une pousse au frigo ; les mesures et les sources professionnelles pour le froid non, et le modèle les suit. Les bigas longs contiennent plus de levure que le modèle n’en demande, ce qui ressemble à un biga conservé au frigo plutôt qu’amené à maturité.</P>
      <H>5. Est-ce que ça dépend de qui l’on croit ?</H>
      <Table headers={['Pondération', 'A', 'b', 'Tmin', 'M du biga', 'R pâte chaude']} rows={[
        ['Égale (copies une fois)', '1,59', '1,18', '−6,1', '1,17', '0,76'],
        ['Crédibilité', '1,38', '1,15', '−3,8', '1,43', '0,75'],
        ['Mesures et professionnels seuls', '2,11', '1,26', '−1,8', '3,21', '0,65'],
        ['Retenue : crédibilité × conditions testées', '1,41', '1,15', '−3,2', '1,55', '0,76'],
      ]} />
      <P>La baisse de la dose avec le temps (b) et la pousse d’une pâte chaude (R) bougent à peine. Le bas froid de la courbe de température (Tmin) et le facteur du biga, si : ils dépendent des chiffres auxquels on se fie. Avec les seules sources professionnelles, le niveau général serait environ 30 % plus haut — les sources à la levure fraîche, surtout italiennes, se situent plus bas que ne le prévoit « fraîche = 3 × instantanée », ce qu’un essai côte à côte en cuisine peut trancher.</P>
      <H>6. Là où les preuves sont minces</H>
      <P>Les cuisines chaudes au-delà de 28 °C, les cuisines fraîches sous 18 °C, la longue pousse au frigo et le poolish au frigo reposent chacun sur moins de trois sources solides indépendantes. Ils sont marqués confiance faible et sont les premiers essais en cuisine, dans l’ordre : une pâte à 30–32 °C, un frigo mesuré à 4 et 6 °C, fraîche contre instantanée à 20 °C, un poolish au frigo.</P>
      <H>Les sources</H>
      <P>Livres et tableaux professionnels : Modernist Pizza (vol. 4), Modernist Bread, Suas, Forkish, Lehmann, Giorilli, Pezzetta, Zaghini, The Dough Formula et le cahier des charges de la pizza napolitaine (STG UE 97/2010). Mesures : Finney et al. 1976 (cuissons d’essai), Nestec (production de gaz entre 4 et 10 °C), Istudor et al. 2020 (production de gaz), Salvadó et al. 2011 (température maximale de croissance de la levure) et Rosso et al. 1993 (modèle à températures cardinales). Sites de recettes, calculateurs et forums complètent les 32 sources : Weekend Bakery, fond.kitchen, dough.school, Dissapore, biancolievito, teigformel, pizzamateur et d’autres. Une nouvelle dose publiée, avec son type de levure, peut rejoindre les données ; les constantes ne bougent que si la vérification sur les sources écartées n’est pas moins bonne.</P>
    </>
  );
}
