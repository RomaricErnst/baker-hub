'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PIZZAS, DESSERT_PIZZAS } from '../../lib/toppingDatabase';
import type { Ingredient } from '../../lib/toppingTypes';

interface Props {
  bakeTime: Date;
  locale: string;
  selectedPizzas: Record<string, number>;
  onGoToBake: () => void;
  styleKey?: string;
}

const STYLE_PREP_NOTES: Partial<Record<string, { en: string; fr: string }[]>> = {
  roman: [
    { en: 'Oil your baking tray generously — the teglia base needs to fry slightly in the oil for the crispy bottom.', fr: "Huiler généreusement votre plaque — la base teglia doit légèrement frire dans l'huile pour le fond croustillant." },
    { en: 'First bake: bake the dough plain at 250°C for 10 min until set. Then add toppings and bake a further 10–12 min.', fr: "Première cuisson : cuire la pâte seule à 250°C pendant 10 min. Puis ajouter les garnitures et cuire encore 10–12 min." },
    { en: 'Dimple the surface with oiled fingers just before the first bake — this gives the teglia its characteristic texture.', fr: "Faire des empreintes dans la surface avec les doigts huilés juste avant la première cuisson." },
  ],
  pan: [
    { en: 'Oil the pan heavily — the cheese at the edges will fry in the oil and create the frico crust. This is not optional.', fr: "Huiler généreusement le moule — le fromage sur les bords va frire dans l'huile et créer la croûte frico." },
    { en: 'Press the cheese all the way to the edges and corners of the pan before baking — it must touch the pan walls.', fr: "Pousser le fromage jusqu'aux bords et coins du moule avant d'enfourner." },
    { en: 'Sauce goes on TOP of the cheese, not underneath. Add it after placing cheese, in stripes across the surface.', fr: "La sauce va SUR le fromage, pas en dessous. L'ajouter après le fromage, en lignes sur la surface." },
    { en: 'Bake at 230°C for 20–25 min. The crust is done when the edges are deep golden and pulling away from the pan.', fr: "Cuire à 230°C pendant 20–25 min. La croûte est prête quand les bords sont bien dorés et se décollent du moule." },
  ],
};

interface PrepTask {
  id: string;
  ingredientName: string;
  text: string;
  textFr: string;
  timing: number;
  mustCool: boolean;
  category: string;
}

const STATIONS = [
  { id: 'cool',    en: 'Needs to cool before topping',    fr: 'Doit refroidir avant de garnir' },
  { id: 'time',    en: 'Needs time — marinade or pickle', fr: 'Nécessite du temps — marinade ou saumure' },
  { id: 'board',   en: 'Board — slice & tear',            fr: 'Planche — trancher & déchirer' },
  { id: 'grate',   en: 'Grate & crush',                   fr: 'Râper & concasser' },
  { id: 'drain',   en: 'Open & drain',                    fr: 'Ouvrir & égoutter' },
  { id: 'herbs',   en: 'Herbs & finish',                  fr: 'Herbes & finitions' },
];

function assignStation(task: PrepTask): string {
  const note = (task.text + ' ' + task.textFr).toLowerCase();
  if (task.mustCool) return 'cool';
  if (task.timing >= 20) return 'time';
  if (note.includes('grate') || note.includes('crush') || note.includes('crumble') || note.includes('blend') || note.includes('râper') || note.includes('concass')) return 'grate';
  if (note.includes('drain') || note.includes('égoutter') || note.includes('pat dry') || note.includes('éponger') || task.timing === 0 || task.timing <= 3) return 'drain';
  if (task.category === 'finish' || task.category === 'spice' || note.includes('pick') || note.includes('chiffonade') || note.includes('zest')) return 'herbs';
  return 'board';
}

export default function PrepTab({ locale, selectedPizzas, onGoToBake, styleKey }: Props) {
  const t = useTranslations('prep');
  const l = locale as 'en' | 'fr';
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Collect tasks from selected pizzas
  const seen = new Set<string>();
  const tasks: PrepTask[] = [];
  const allPizzas = [...PIZZAS, ...DESSERT_PIZZAS];

  Object.keys(selectedPizzas).forEach(pizzaId => {
    if (!selectedPizzas[pizzaId]) return;
    const pizza = allPizzas.find(p => p.id === pizzaId);
    if (!pizza) return;
    pizza.ingredients.forEach((ing: Ingredient) => {
      if (!ing.prepNote || seen.has(ing.id)) return;
      seen.add(ing.id);
      const timing = ing.prepNote.timing ?? 0;
      const mustCool = timing >= 15 && (ing.category === 'meat' || ing.category === 'sauce');
      tasks.push({
        id: `ing_${ing.id}`,
        ingredientName: ing.name[l] ?? ing.name.en,
        text: ing.prepNote.en,
        textFr: ing.prepNote.fr,
        timing,
        mustCool,
        category: ing.category,
      });
    });
  });

  // Split into early (get ahead) and flexible
  const earlyStations = ['cool', 'time'];
  const flexStations = ['board', 'grate', 'drain', 'herbs'];

  const byStation: Record<string, PrepTask[]> = {};
  tasks.forEach(task => {
    const station = assignStation(task);
    if (!byStation[station]) byStation[station] = [];
    byStation[station].push(task);
  });

  // Sort within each station by timing desc
  Object.values(byStation).forEach(arr => arr.sort((a, b) => b.timing - a.timing));

  const hasEarly = earlyStations.some(s => byStation[s]?.length > 0);
  const hasFlex = flexStations.some(s => byStation[s]?.length > 0);
  const hasAny = hasEarly || hasFlex;

  function renderTask(task: PrepTask, isLast: boolean) {
    const done = completed.has(task.id);
    return (
      <div
        key={task.id}
        onClick={() => toggle(task.id)}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          padding: '10px 14px',
          borderTop: '1px solid #E8E0D5',
          cursor: 'pointer',
          background: done ? '#FAFAF8' : '#FDFBF7',
        }}
      >
        <div style={{
          width: '22px', height: '22px', borderRadius: '5px', flexShrink: 0,
          marginTop: '1px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: done ? '1.5px solid #D4A853' : '1.5px solid #E0D8CF',
          background: done ? '#D4A853' : '#FDFBF7',
        }}>
          {done && <span style={{ fontSize: '11px', color: '#1A1612' }}>&#10003;</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            gap: '8px', marginBottom: '2px',
          }}>
            <span style={{
              fontFamily: 'Playfair Display, serif', fontSize: '14px', fontWeight: 600,
              color: done ? '#8A7F78' : '#1A1612',
              textDecoration: done ? 'line-through' : undefined,
            }}>
              {task.ingredientName}
            </span>
            {task.timing > 5 && (
              <span style={{
                fontFamily: 'DM Mono, monospace', fontSize: '10px',
                color: '#8A7F78', flexShrink: 0,
              }}>
                {task.timing} {l === 'fr' ? 'min' : 'min'}
              </span>
            )}
          </div>
          <span style={{
            fontFamily: 'DM Sans, sans-serif', fontSize: '12px', lineHeight: 1.4,
            color: '#8A7F78',
            textDecoration: done ? 'line-through' : undefined,
            opacity: done ? 0.6 : 1,
          }}>
            {l === 'fr' ? task.textFr : task.text}
          </span>
        </div>
      </div>
    );
  }

  function renderStationBlock(stationId: string) {
    const stationTasks = byStation[stationId];
    if (!stationTasks?.length) return null;
    const station = STATIONS.find(s => s.id === stationId)!;
    return (
      <div key={stationId} style={{ marginBottom: '10px' }}>
        <div style={{
          fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: '#8A7F78',
          fontFamily: 'DM Mono, monospace',
          padding: '6px 14px 4px',
          background: '#F5F0E8',
          borderRadius: '10px 10px 0 0',
          border: '1px solid #E8E0D5',
          borderBottom: 'none',
        }}>
          {l === 'fr' ? station.fr : station.en}
        </div>
        <div style={{
          border: '1px solid #E8E0D5',
          borderRadius: '0 0 10px 10px',
          overflow: 'hidden',
        }}>
          {stationTasks.map((task, i) => renderTask(task, i === stationTasks.length - 1))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px 24px' }}>

      {/* Header */}
      <div style={{
        border: '1px solid #E8E0D5', borderRadius: '14px', padding: '14px 16px',
        marginTop: '16px', marginBottom: '20px',
        background: '#FDFBF7',
      }}>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', fontWeight: 700, color: '#1A1612' }}>
          {l === 'fr' ? 'Préparer les garnitures' : 'Prep your toppings'}
        </div>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: '#8A7F78', marginTop: '4px' }}>
          {l === 'fr'
            ? 'Commencez par ce qui a besoin de temps ou de refroidir — le reste est flexible.'
            : 'Start with anything that needs time or to cool — everything else is flexible.'}
        </div>
      </div>

      {/* Style-specific notes */}
      {styleKey && STYLE_PREP_NOTES[styleKey] && (
        <div style={{ margin: '0 0 16px', border: '1px solid #E8E0D5', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ background: '#1A1612', color: 'white', padding: '8px 14px', fontSize: '10px', fontFamily: 'DM Mono, monospace', letterSpacing: '1px', textTransform: 'uppercase' }}>
            {styleKey === 'pan' ? (l === 'fr' ? 'Style Detroit' : 'Detroit Style') : (l === 'fr' ? 'Style Teglia' : 'Teglia Style')}
          </div>
          {STYLE_PREP_NOTES[styleKey]!.map((note, i) => (
            <div key={i} style={{ padding: '10px 14px', borderBottom: i < STYLE_PREP_NOTES[styleKey]!.length - 1 ? '1px solid #E8E0D5' : 'none', fontSize: '13px', color: '#3D3530', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5 }}>
              {l === 'fr' ? note.fr : note.en}
            </div>
          ))}
        </div>
      )}

      {!hasAny ? (
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: '#8A7F78', textAlign: 'center', padding: '32px 0' }}>
          {l === 'fr' ? 'Aucune préparation nécessaire — vous êtes prêt.' : 'No prep needed — you\'re good to go.'}
        </div>
      ) : (
        <>
          {/* Phase 1 — Get ahead */}
          {hasEarly && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '15px', fontWeight: 600, color: '#1A1612', marginBottom: '2px' }}>
                {l === 'fr' ? 'Commencez par là' : 'Get ahead'}
              </div>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: '#8A7F78', marginBottom: '10px' }}>
                {l === 'fr'
                  ? 'Ces ingrédients ont besoin de temps ou doivent refroidir — ils se gardent au frigo.'
                  : 'These need time or must cool — they keep in the fridge until you\'re ready.'}
              </div>
              {earlyStations.map(s => renderStationBlock(s))}
            </div>
          )}

          {/* Divider */}
          {hasEarly && hasFlex && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0 16px' }}>
              <div style={{ flex: 1, height: '1px', background: '#E8E0D5' }} />
              <div style={{ fontSize: '10px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                {l === 'fr' ? 'quand vous voulez' : 'whenever you\'re ready'}
              </div>
              <div style={{ flex: 1, height: '1px', background: '#E8E0D5' }} />
            </div>
          )}

          {/* Phase 2 — Flexible */}
          {hasFlex && (
            <div>
              {!hasEarly && (
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: '#8A7F78', marginBottom: '10px' }}>
                  {l === 'fr' ? 'Tout est flexible — pendant que le four chauffe ou juste avant.' : 'All flexible — while the oven heats or just before.'}
                </div>
              )}
              {flexStations.map(s => renderStationBlock(s))}
            </div>
          )}
        </>
      )}

      {/* CTA */}
      <button
        onClick={onGoToBake}
        style={{
          width: '100%', height: '52px',
          background: '#C4522A', color: 'white',
          fontFamily: 'DM Sans, sans-serif', fontSize: '15px', fontWeight: 600,
          borderRadius: '14px', marginTop: '24px',
          cursor: 'pointer', border: 'none',
        }}
      >
        {t('cta')}
      </button>
    </div>
  );
}
