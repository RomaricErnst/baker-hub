'use client';
// "The yeast engine" on the About page, in both locales. Every constant and worked example here is the
// engine's own: tests/yeast-model.test.cjs recomputes the examples from app/utils/yeastModel.ts and
// checks each number appears in both locales. Present tense, no file references (bakers cannot open them).
import React from 'react';
import { YeastSourcesSectionEn, YeastSourcesSectionFr } from './yeastSourcesSection';

const CHAR = '#2B2420';
const SMOKE = '#6B635D';
const text: React.CSSProperties = { fontFamily: 'var(--font-ui)', fontSize: '15px', lineHeight: 1.65, color: CHAR };
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: '13px', background: 'rgba(43,36,32,0.06)', borderRadius: '8px', padding: '8px 10px', display: 'block', overflowX: 'auto', whiteSpace: 'pre-wrap', color: CHAR };
const cell: React.CSSProperties = { padding: '8px 10px', borderTop: '1px solid #E0D8CC', verticalAlign: 'top', fontFamily: 'var(--font-ui)', fontSize: '13px', lineHeight: 1.5, color: CHAR };
const head: React.CSSProperties = { ...cell, borderTop: 'none', fontSize: '12px', color: SMOKE, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 500, textAlign: 'left' };

function P({ children }: { children: React.ReactNode }) { return <p style={{ margin: '0 0 12px', ...text }}>{children}</p>; }
function H({ children }: { children: React.ReactNode }) { return <p style={{ margin: '16px 0 8px', ...text }}><strong>{children}</strong></p>; }
function Eq({ children }: { children: React.ReactNode }) { return <code style={{ ...mono, margin: '0 0 12px' }}>{children}</code>; }
export function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto', margin: '4px 0 12px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{headers.map(h => <th key={h} style={head}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j} style={cell}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}


/** The equations, the constants, the worked examples and the sources, under one disclosure (owner's rule C:
 *  the plain explanation and the tables stay visible; the formulas are for reviewers). A native <details>, its
 *  summary a 44 px target. The sourdough section reuses it. */
export function Maths({ fr, children }: { fr: boolean; children: React.ReactNode }) {
  return (
    <details data-yeast-maths style={{ margin: '4px 0 12px' }}>
      <summary className="bh-chevron" style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', ...text, color: 'var(--terra)', fontWeight: 600 }}>{fr ? 'Les calculs' : 'The maths'}</summary>
      <div style={{ paddingTop: 4 }}>{children}</div>
    </details>
  );
}

export function YeastModelSectionEn() {
  return (
    <>
      <P>One model sets every commercial-yeast amount in the app: a straight dough, a cold retard, a hot kitchen, a poolish or a biga, and the timing when you enter your own amount. It is fitted to 157 published doses from 32 sources, from professional books to measured test bakes (named under The maths).</P>
      <H>How it works</H>
      <P>Yeast works faster in warm dough and slower in cold dough. The engine follows your dough’s temperature through the plan: it leaves the bowl at its target dough temperature, drifts towards the kitchen, cools slowly in the fridge and warms again when it comes out. Each hour counts for what an hour at 25 °C would do at that temperature. The sum is the plan’s <strong>equivalent hours at 25 °C</strong> (Heq).</P>
      <Table headers={['Dough temperature', 'Activity vs 25 °C']} rows={[
        ['4 °C', '0.07'], ['6 °C', '0.11'], ['15 °C', '0.43'], ['21 °C', '0.75'], ['25 °C', '1.00'], ['30 °C', '1.35'], ['35 °C', '1.70'],
      ]} />
      <P>So a fridge mostly holds the dough: an hour at 6 °C does about a tenth of an hour at 25 °C, and the dough finishes rising at room temperature, as professional and hot-climate bakers plan it. Above 30 °C the yeast keeps getting faster up to about 35 °C, the warmest dough in the data.</P>
      <H>Preferments</H>
      <P>A poolish or biga gets the amount that ripens it for its own time and temperature, made at kitchen temperature and including its time in the fridge and its warm-up. The final dough then gets its own yeast for the time from the mix to the bake, as Modernist, Suas and Hamelman do: across Modernist’s poolish doughs, the total is about what a straight dough of the same schedule would take.</P>
      <H>Your own amount</H>
      <P>When you enter an amount, the planner runs the same model backwards and times the plan so the dough is ready at your bake. A plan long enough to need the fridge can ferment less than a slightly shorter room-temperature plan, so the planner picks the window closest to your style’s usual one. An amount you enter for a poolish or biga, as a % of its own flour, re-times that stage the same way: it is ready where the amount meets 0.9 to 1.1 of what the model asks, within 6–14 h at room temperature or 12–24 h in the fridge for a poolish, and 12–72 h in the fridge for a biga. The final dough can take its own entered amount too.</P>
      <H>Limits</H>
      <P>Measured dough data are rare. Hot kitchens, the fridge and fridge poolish rest on fewer than three strong independent sources each, so those numbers are marked low confidence and are the first to check in a kitchen trial. Community cold tables expect the dough to rise in the fridge and use about half the yeast the model gives; the measured and professional sources do not, and the model follows them. Fresh-yeast sources sit lower than dry-yeast sources on the same schedule, which may mean fresh yeast is worth less than three times instant in practice. Salt, hydration and flour have no separate factor because no source quantifies them. Enriched doughs (10 % sugar or more) keep a fixed 1 % instant yeast, and levain has its own model.</P>

      <Maths fr={false}>
        <Eq>{'activity r(T) = CTMI(T) / CTMI(25 °C)    (Rosso’s cardinal-temperature model)\nHeq = sum over the plan of r(dough temperature) × hours\ninstant yeast % = 1.41 × M × R × Heq^−1.15'}</Eq>
        <P>M is the medium: 1 for a salted dough, 0.70 for a poolish, 1.55 for a biga. R is the rise the dough is planned to: 1 (about doubled). When the dough ends warmer than 25 °C, R eases down to 0.76 by 28 °C: warm doughs are used at a smaller rise because they over-proof and weaken faster, and hot-kitchen bakers use 20–50 % less yeast than the speed-up alone would explain.</P>
        <H>Where each number comes from</H>
        <Table headers={['Constant', 'Value', 'Basis']} rows={[
          ['Highest temperature Tmax', '45.4 °C', 'Published: Salvadó et al. 2011, S. cerevisiae'],
          ['Optimum Topt', '40 °C', 'Fitted, at its upper bound: the data reach 35 °C and keep rising; Salvadó’s 32.3 °C fits worse'],
          ['Cold limit Tmin', '−3.2 °C', 'Fitted: cold-retard recipes and Nestec’s measured gas at 4–10 °C. Low confidence: few strong sources'],
          ['A, b (dose law)', '1.41, 1.15', 'Fitted: 157 rows from 28 independent lineages, each source with its own level'],
          ['Poolish M', '0.70', 'Fitted: eight poolish lineages (Modernist, Suas, Pezzetta and others)'],
          ['Biga M', '1.55', 'Fitted: nine biga lineages (Modernist Bread, Giorilli, Zaghini and others)'],
          ['Warm-dough rise R', '0.76 from 28 °C', 'Fitted (± 0.06) to hot-kitchen doses and temperature-speed statements'],
          ['Fresh, active dry', '× 3, × 1.33', 'Published: Modernist Bread Vol. 6 KM p. xi'],
        ]} />
        <P>Sources set their own level (how far the dough rises, the flour, the style), and they differ from each other by a factor of about 1.9. Once each source has its level, the model follows the shape of its numbers within a factor of about 1.4. Seven sources held back from the fit followed it within a factor of 1.55 inside each source. Copies of the same table count once, and measured data and professional books count more than recipe sites and forums.</P>
        <H>Worked examples</H>
        <Table headers={['Plan', 'Heq', 'Instant yeast']} rows={[
          ['12 h at 21 °C, dough at 21 °C', '9.0 h', '0.11 %'],
          ['2 h at 21 °C, 46 h at 6 °C, 2 h at 21 °C (dough mixed at 24 °C)', '8.5 h', '0.12 %'],
          ['Poolish, 12 h at 21 °C', '9.0 h', '0.08 % of its flour'],
          ['6 h at 30 °C, dough mixed at 24 °C (ends at 29.7 °C, R 0.76)', '7.3 h', '0.11 %'],
        ]} />
        <P>(Examples use a 2-hour thermal time constant; the app uses the one for your dough’s weight.)</P>
        <H>Behind the yeast model: comparing the sources</H>
        <YeastSourcesSectionEn />
      </Maths>
    </>
  );
}

export function YeastModelSectionFr() {
  return (
    <>
      <P>Un seul modèle fixe toutes les quantités de levure du commerce dans l’app : pâte directe, pousse au froid, cuisine chaude, poolish ou biga, et le planning quand vous saisissez votre propre quantité. Il est ajusté sur 157 doses publiées issues de 32 sources, des livres professionnels aux cuissons d’essai mesurées (citées sous Les calculs).</P>
      <H>Comment ça marche</H>
      <P>La levure travaille plus vite dans une pâte chaude, plus lentement dans une pâte froide. Le moteur suit la température de votre pâte tout au long du plan : elle sort du pétrin à sa température cible, rejoint peu à peu celle de la cuisine, refroidit lentement au frigo et se réchauffe à la sortie. Chaque heure compte pour ce qu’une heure à 25 °C ferait à cette température. La somme donne les <strong>heures équivalentes à 25 °C</strong> du plan (Héq).</P>
      <Table headers={['Température de la pâte', 'Activité par rapport à 25 °C']} rows={[
        ['4 °C', '0,07'], ['6 °C', '0,11'], ['15 °C', '0,43'], ['21 °C', '0,75'], ['25 °C', '1,00'], ['30 °C', '1,35'], ['35 °C', '1,70'],
      ]} />
      <P>Le frigo conserve donc surtout la pâte : une heure à 6 °C fait environ un dixième d’une heure à 25 °C, et la pâte finit de lever à température ambiante, comme le prévoient les professionnels et les boulangers des pays chauds. Au-delà de 30 °C, la levure continue d’accélérer jusqu’à environ 35 °C, la pâte la plus chaude des données.</P>
      <H>Préferments</H>
      <P>Un poolish ou un biga reçoit la quantité qui le mène à maturité pour sa propre durée et sa température, préparé à la température de la cuisine, temps au frigo et remise en température compris. La pâte finale reçoit ensuite sa propre levure pour le temps du pétrissage à la cuisson, comme chez Modernist, Suas et Hamelman : sur les pâtes au poolish de Modernist, le total vaut à peu près ce que prendrait une pâte directe au même planning.</P>
      <H>Votre propre quantité</H>
      <P>Quand vous saisissez une quantité, le planificateur fait tourner le même modèle à l’envers et cale le plan pour que la pâte soit prête à votre heure de cuisson. Un plan assez long pour passer par le frigo peut fermenter moins qu’un plan un peu plus court à température ambiante : le planificateur retient la durée la plus proche de celle de votre style. Une quantité saisie pour un poolish ou une biga, en % de sa propre farine, recale cette étape de la même façon : elle est prête là où la quantité vaut 0,9 à 1,1 fois ce que demande le modèle, entre 6 et 14 h à température ambiante ou 12 et 24 h au frigo pour un poolish, et entre 12 et 72 h au frigo pour une biga. La pâte finale peut aussi recevoir sa propre quantité saisie.</P>
      <H>Limites</H>
      <P>Les mesures sur pâte sont rares. Les cuisines chaudes, le frigo et le poolish au frigo reposent chacun sur moins de trois sources solides indépendantes : ces chiffres sont marqués confiance faible et sont les premiers à vérifier par un essai en cuisine. Les tableaux communautaires pour le froid comptent sur une pousse au frigo et utilisent environ moitié moins de levure que le modèle ; les mesures et les sources professionnelles non, et le modèle les suit. Les sources à la levure fraîche se situent plus bas que celles à la levure sèche pour le même planning, ce qui pourrait vouloir dire que la levure fraîche vaut en pratique moins de trois fois l’instantanée. Le sel, l’hydratation et la farine n’ont pas de facteur propre, faute de source qui les chiffre. Les pâtes enrichies (10 % de sucre ou plus) gardent une dose fixe de 1 % de levure instantanée, et le levain a son propre modèle.</P>

      <Maths fr={true}>
        <Eq>{'activité r(T) = CTMI(T) / CTMI(25 °C)    (modèle à températures cardinales de Rosso)\nHéq = somme sur le plan de r(température de la pâte) × heures\n% de levure instantanée = 1,41 × M × R × Héq^−1,15'}</Eq>
        <P>M est le milieu : 1 pour une pâte salée, 0,70 pour un poolish, 1,55 pour un biga. R est la pousse visée : 1 (environ le double). Quand la pâte finit au-dessus de 25 °C, R descend doucement jusqu’à 0,76 à 28 °C : une pâte chaude s’utilise à une pousse plus faible car elle surpousse et s’affaiblit plus vite, et les boulangers des cuisines chaudes mettent 20 à 50 % de levure en moins que ce qu’expliquerait la seule accélération.</P>
        <H>D’où vient chaque nombre</H>
        <Table headers={['Constante', 'Valeur', 'Fondement']} rows={[
          ['Température maximale Tmax', '45,4 °C', 'Publiée : Salvadó et al. 2011, S. cerevisiae'],
          ['Optimum Topt', '40 °C', 'Ajusté, à sa borne haute : les données vont jusqu’à 35 °C et montent encore ; les 32,3 °C de Salvadó s’ajustent moins bien'],
          ['Limite froide Tmin', '−3,2 °C', 'Ajustée : recettes avec pousse au froid et gaz mesuré par Nestec entre 4 et 10 °C. Confiance faible : peu de sources solides'],
          ['A, b (loi de dose)', '1,41, 1,15', 'Ajustés : 157 lignes issues de 28 lignées indépendantes, chaque source avec son propre niveau'],
          ['M du poolish', '0,70', 'Ajusté : huit lignées de poolish (Modernist, Suas, Pezzetta et d’autres)'],
          ['M du biga', '1,55', 'Ajusté : neuf lignées de biga (Modernist Bread, Giorilli, Zaghini et d’autres)'],
          ['Pousse d’une pâte chaude R', '0,76 dès 28 °C', 'Ajusté (± 0,06) sur les doses des cuisines chaudes et les rapports de vitesse selon la température'],
          ['Fraîche, sèche active', '× 3, × 1,33', 'Publié : Modernist Bread vol. 6 KM p. xi'],
        ]} />
        <P>Chaque source a son propre niveau (jusqu’où la pâte lève, la farine, le style), et les sources diffèrent entre elles d’un facteur 1,9 environ. Une fois ce niveau pris en compte, le modèle suit la forme de leurs chiffres à un facteur 1,4 près environ. Sept sources écartées de l’ajustement l’ont suivi à un facteur 1,55 près au sein de chaque source. Les copies d’un même tableau comptent une seule fois, et les mesures et les livres professionnels comptent davantage que les sites de recettes et les forums.</P>
        <H>Exemples chiffrés</H>
        <Table headers={['Plan', 'Héq', 'Levure instantanée']} rows={[
          ['12 h à 21 °C, pâte à 21 °C', '9,0 h', '0,11 %'],
          ['2 h à 21 °C, 46 h à 6 °C, 2 h à 21 °C (pâte pétrie à 24 °C)', '8,5 h', '0,12 %'],
          ['Poolish, 12 h à 21 °C', '9,0 h', '0,08 % de sa farine'],
          ['6 h à 30 °C, pâte pétrie à 24 °C (finit à 29,7 °C, R 0,76)', '7,3 h', '0,11 %'],
        ]} />
        <P>(Les exemples prennent une constante de temps thermique de 2 heures ; l’app utilise celle du poids de votre pâte.)</P>
        <H>Les coulisses du modèle de levure : comparer les sources</H>
        <YeastSourcesSectionFr />
      </Maths>
    </>
  );
}
