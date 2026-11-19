'use client';
// "The yeast engine" on the About page, in both locales (19 Nov 2026, yeast model).
// A summary of docs/YEAST-MODEL.md. Every constant and worked example here is the
// engine's own: tests/yeast-model.test.cjs recomputes the examples from
// app/utils/yeastModel.ts and checks each number appears in both locales.
import React from 'react';

const CHAR = '#2B2420';
const SMOKE = '#6B635D';
const text: React.CSSProperties = { fontFamily: 'var(--font-ui)', fontSize: '15px', lineHeight: 1.65, color: CHAR };
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: '13px', background: 'rgba(43,36,32,0.06)', borderRadius: '8px', padding: '8px 10px', display: 'block', overflowX: 'auto', whiteSpace: 'pre-wrap', color: CHAR };
const cell: React.CSSProperties = { padding: '8px 10px', borderTop: '1px solid #E0D8CC', verticalAlign: 'top', fontFamily: 'var(--font-ui)', fontSize: '13px', lineHeight: 1.5, color: CHAR };
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

export function YeastModelSectionEn() {
  return (
    <>
      <P>One model sets every commercial-yeast amount in the app: a straight dough, a cold retard, a hot kitchen, a poolish or a biga, and the timing when you enter your own amount. It replaced the earlier community curve, its separate fridge formula and its tropical corrections in November 2026. The full method, every data point and every residual are in the project’s <code>docs/YEAST-MODEL.md</code>.</P>
      <H>How it works</H>
      <P>Yeast works faster in warm dough and slower in cold dough. The engine follows your dough’s temperature through the plan: it leaves the bowl at its target dough temperature, drifts towards the kitchen, cools slowly in the fridge and warms again when it comes out. Each hour counts for what an hour at 25 °C would do at that temperature. The sum is the plan’s <strong>equivalent hours at 25 °C</strong> (Heq).</P>
      <Eq>{'activity r(T) = CTMI(T) / CTMI(25 °C)    (Rosso’s cardinal-temperature model)\nHeq = sum over the plan of r(dough temperature) × hours\ninstant yeast % = 2.05 × M × R × Heq^−1.24'}</Eq>
      <P>M is the medium: 1 for a salted dough, 0.83 for a poolish, 2.67 for a biga. R is the rise the dough is planned to: 1 (about doubled). When the dough ends warmer than 25 °C, R eases down to 0.6 by 28 °C: warm doughs are used at a smaller rise (30 % rather than 50 % in bulk, You Knead Sourdough), because they over-proof and weaken faster.</P>
      <Table headers={['Dough temperature', 'Activity vs 25 °C']} rows={[
        ['4 °C', '0.05'], ['6 °C', '0.10'], ['15 °C', '0.48'], ['21 °C', '0.81'], ['25 °C', '1.00'], ['30 °C', '1.16'], ['35 °C', '1.15'],
      ]} />
      <P>So a fridge mostly holds the dough: an hour at 6 °C does about a tenth of an hour at 25 °C, and the dough finishes rising at room temperature, as professional and hot-climate bakers plan it. Above about 30 °C the yeast does not get much faster.</P>
      <H>Where each number comes from</H>
      <Table headers={['Constant', 'Value', 'Basis']} rows={[
        ['Highest temperature Tmax', '45.4 °C', 'Published: Salvadó et al. 2011, S. cerevisiae'],
        ['Optimum Topt', '32.3 °C', 'Published: Salvadó et al. 2011 (the data alone gave 34 ± 4 °C)'],
        ['Cold limit Tmin', '−0.5 °C', 'Fitted: cold-retard recipes and Nestec’s measured gas at 4–10 °C'],
        ['A, b (dose law)', '2.05, 1.24', 'Fitted: 79 points from 21 independent sources (books, tables, recipes)'],
        ['Poolish M', '0.83', 'Fitted: Modernist Pizza Vol. 4 KM p. 2, Modernist Bread Vol. 6 KM p. 20 and seven other poolish tables'],
        ['Biga M', '2.67', 'Fitted: Modernist Bread Vol. 6 KM pp. 19 and 22, Giorilli'],
        ['Warm-dough rise R', '0.6 from 28 °C', 'Published ratio 30 % / 50 % (You Knead Sourdough)'],
        ['Fresh, active dry', '× 3, × 1.33', 'Published: Modernist Bread Vol. 6 KM p. xi'],
      ]} />
      <P>Across the 79 points the model is within a factor of 1.8 of the source, typically (the sources disagree with each other by about that much). Five sources held back from the fit were predicted within a factor of 1.9. The previous engine was within a factor of 2.6 on the same points.</P>
      <H>Worked examples</H>
      <Table headers={['Plan', 'Heq', 'Instant yeast']} rows={[
        ['12 h at 21 °C, dough at 21 °C', '9.7 h', '0.12 %'],
        ['2 h at 21 °C, 46 h at 6 °C, 2 h at 21 °C (dough mixed at 24 °C)', '8.3 h', '0.15 %'],
        ['Poolish, 12 h at 21 °C', '9.7 h', '0.10 % of its flour'],
        ['6 h at 30 °C, dough mixed at 24 °C (ends at 29.7 °C, R 0.6)', '6.7 h', '0.12 %'],
      ]} />
      <P>(Examples use a 2-hour thermal time constant; the app uses the one for your dough’s weight.)</P>
      <H>Preferments</H>
      <P>A poolish or biga gets the amount that ripens it for its own time and temperature, made at kitchen temperature and including its time in the fridge and its warm-up. The final dough then gets its own yeast for the time from the mix to the bake, as Modernist, Suas and Hamelman do: across Modernist’s poolish doughs, the total is about what a straight dough of the same schedule would take.</P>
      <H>Your own amount</H>
      <P>When you enter an amount, the planner runs the same model backwards and times the plan so the dough is ready at your bake. A plan long enough to need the fridge can ferment less than a slightly shorter room-temperature plan, so the planner picks the window closest to your style’s usual one.</P>
      <H>Limits</H>
      <P>Measured dough data are rare. Above 30 °C and below 10 °C the model rests on few points, and some sources there disagree (short-term gas tests keep rising to 39 °C; a summer pizzeria reports faster dough at 35 °C than the model). Community cold tables expect the dough to rise in the fridge and use two to five times less yeast than the model; the model follows the professional practice instead. Salt, hydration and flour have no separate factor because no source quantifies them. Enriched doughs (10 % sugar or more) keep a fixed 1 % instant yeast, and levain has its own model.</P>
    </>
  );
}

export function YeastModelSectionFr() {
  return (
    <>
      <P>Un seul modèle fixe toutes les quantités de levure du commerce dans l’app : pâte directe, pousse au froid, cuisine chaude, poolish ou biga, et le planning quand vous saisissez votre propre quantité. Il a remplacé en novembre 2026 l’ancienne courbe communautaire, sa formule séparée pour le frigo et ses corrections tropicales. La méthode complète, chaque point de données et chaque résidu sont dans le document du projet <code>docs/YEAST-MODEL.md</code>.</P>
      <H>Comment ça marche</H>
      <P>La levure travaille plus vite dans une pâte chaude, plus lentement dans une pâte froide. Le moteur suit la température de votre pâte tout au long du plan : elle sort du pétrin à sa température cible, rejoint peu à peu celle de la cuisine, refroidit lentement au frigo et se réchauffe à la sortie. Chaque heure compte pour ce qu’une heure à 25 °C ferait à cette température. La somme donne les <strong>heures équivalentes à 25 °C</strong> du plan (Héq).</P>
      <Eq>{'activité r(T) = CTMI(T) / CTMI(25 °C)    (modèle à températures cardinales de Rosso)\nHéq = somme sur le plan de r(température de la pâte) × heures\n% de levure instantanée = 2,05 × M × R × Héq^−1,24'}</Eq>
      <P>M est le milieu : 1 pour une pâte salée, 0,83 pour un poolish, 2,67 pour un biga. R est la pousse visée : 1 (environ le double). Quand la pâte finit au-dessus de 25 °C, R descend doucement jusqu’à 0,6 à 28 °C : une pâte chaude s’utilise à une pousse plus faible (30 % plutôt que 50 % au pointage, You Knead Sourdough), car elle surpousse et s’affaiblit plus vite.</P>
      <Table headers={['Température de la pâte', 'Activité par rapport à 25 °C']} rows={[
        ['4 °C', '0,05'], ['6 °C', '0,10'], ['15 °C', '0,48'], ['21 °C', '0,81'], ['25 °C', '1,00'], ['30 °C', '1,16'], ['35 °C', '1,15'],
      ]} />
      <P>Le frigo conserve donc surtout la pâte : une heure à 6 °C fait environ un dixième d’une heure à 25 °C, et la pâte finit de lever à température ambiante, comme le prévoient les professionnels et les boulangers des pays chauds. Au-delà d’environ 30 °C, la levure n’accélère plus beaucoup.</P>
      <H>D’où vient chaque nombre</H>
      <Table headers={['Constante', 'Valeur', 'Fondement']} rows={[
        ['Température maximale Tmax', '45,4 °C', 'Publiée : Salvadó et al. 2011, S. cerevisiae'],
        ['Optimum Topt', '32,3 °C', 'Publié : Salvadó et al. 2011 (les données seules donnaient 34 ± 4 °C)'],
        ['Limite froide Tmin', '−0,5 °C', 'Ajustée : recettes avec pousse au froid et gaz mesuré par Nestec entre 4 et 10 °C'],
        ['A, b (loi de dose)', '2,05, 1,24', 'Ajustés : 79 points issus de 21 sources indépendantes (livres, tableaux, recettes)'],
        ['M du poolish', '0,83', 'Ajusté : Modernist Pizza vol. 4 KM p. 2, Modernist Bread vol. 6 KM p. 20 et sept autres tableaux de poolish'],
        ['M du biga', '2,67', 'Ajusté : Modernist Bread vol. 6 KM p. 19 et 22, Giorilli'],
        ['Pousse d’une pâte chaude R', '0,6 dès 28 °C', 'Rapport publié 30 % / 50 % (You Knead Sourdough)'],
        ['Fraîche, sèche active', '× 3, × 1,33', 'Publié : Modernist Bread vol. 6 KM p. xi'],
      ]} />
      <P>Sur les 79 points, le modèle reste en général à un facteur 1,8 de la source (les sources divergent entre elles d’environ autant). Cinq sources écartées de l’ajustement ont été prédites à un facteur 1,9 près. L’ancien moteur était à un facteur 2,6 sur les mêmes points.</P>
      <H>Exemples chiffrés</H>
      <Table headers={['Plan', 'Héq', 'Levure instantanée']} rows={[
        ['12 h à 21 °C, pâte à 21 °C', '9,7 h', '0,12 %'],
        ['2 h à 21 °C, 46 h à 6 °C, 2 h à 21 °C (pâte pétrie à 24 °C)', '8,3 h', '0,15 %'],
        ['Poolish, 12 h à 21 °C', '9,7 h', '0,10 % de sa farine'],
        ['6 h à 30 °C, pâte pétrie à 24 °C (finit à 29,7 °C, R 0,6)', '6,7 h', '0,12 %'],
      ]} />
      <P>(Les exemples prennent une constante de temps thermique de 2 heures ; l’app utilise celle du poids de votre pâte.)</P>
      <H>Préferments</H>
      <P>Un poolish ou un biga reçoit la quantité qui le mène à maturité pour sa propre durée et sa température, préparé à la température de la cuisine, temps au frigo et remise en température compris. La pâte finale reçoit ensuite sa propre levure pour le temps du pétrissage à la cuisson, comme chez Modernist, Suas et Hamelman : sur les pâtes au poolish de Modernist, le total vaut à peu près ce que prendrait une pâte directe au même planning.</P>
      <H>Votre propre quantité</H>
      <P>Quand vous saisissez une quantité, le planificateur fait tourner le même modèle à l’envers et cale le plan pour que la pâte soit prête à votre heure de cuisson. Un plan assez long pour passer par le frigo peut fermenter moins qu’un plan un peu plus court à température ambiante : le planificateur retient la durée la plus proche de celle de votre style.</P>
      <H>Limites</H>
      <P>Les mesures sur pâte sont rares. Au-delà de 30 °C et en dessous de 10 °C, le modèle repose sur peu de points, et certaines sources y divergent (des mesures de gaz sur une heure continuent de monter jusqu’à 39 °C ; une pizzeria en été décrit une pâte plus rapide à 35 °C que le modèle). Les tableaux communautaires pour le froid comptent sur une pousse au frigo et utilisent deux à cinq fois moins de levure que le modèle ; le modèle suit plutôt la pratique professionnelle. Le sel, l’hydratation et la farine n’ont pas de facteur propre, faute de source qui les chiffre. Les pâtes enrichies (10 % de sucre ou plus) gardent une dose fixe de 1 % de levure instantanée, et le levain a son propre modèle.</P>
    </>
  );
}
