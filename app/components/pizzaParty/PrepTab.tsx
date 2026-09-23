'use client';
import { useState, useEffect } from 'react';
import { PIZZAS, DESSERT_PIZZAS, getCustomPizzaList } from '../../lib/toppingDatabase';
import type { Ingredient, IngredientUnit } from '../../lib/toppingTypes';

function formatQty(amount: number, unit: IngredientUnit, locale: string): string {
  const unitLabels: Record<IngredientUnit, { en: string; fr: string }> = {
    g:      { en: 'g',       fr: 'g' },
    ml:     { en: 'ml',      fr: 'ml' },
    pcs:    { en: 'pcs',     fr: 'pcs' },
    slices: { en: 'slices',  fr: 'tranches' },
    leaves: { en: 'leaves',  fr: 'feuilles' },
    sprigs: { en: 'sprigs',  fr: 'brins' },
    tbsp:   { en: 'tbsp',    fr: 'càs' },
    pinch:  { en: 'pinches', fr: 'pincées' },
    drizzle:{ en: 'drizzles', fr: 'filets' },
  };
  const singular: Record<string, {en:string;fr:string}> = { slices: {en:'slice',fr:'tranche'}, leaves: {en:'leaf',fr:'feuille'}, sprigs: {en:'sprig',fr:'brin'}, pinch: {en:'pinch',fr:'pincée'}, drizzle: {en:'drizzle',fr:'filet'} };
  const label = (amount === 1 ? singular[unit]?.[locale as 'en'|'fr'] : undefined) ?? unitLabels[unit]?.[locale as 'en' | 'fr'] ?? unit;
  return `${Math.round(amount)} ${label}`;
}

interface Props {
  storagePrefix?:string;
  bakeTime: Date;
  locale: string;
  selectedPizzas: Record<string, number>;
  onGoToBake: () => void;
  onGoToShopping: () => void;
  onGoToPizzas: () => void;
  styleKey?: string;
}

const STYLE_PREP_NOTES: Partial<Record<string, { en: string; fr: string }[]>> = {
  roman: [
    { en: 'Oil the tray to help release the dough and crisp the base.', fr: 'Huilez la plaque pour faciliter le démoulage et rendre le dessous croustillant.' },
    { en: 'Follow the baking steps for your oven. Add each topping before or after baking as indicated for the selected pizza.', fr: 'Suivez les étapes de cuisson adaptées à votre four. Ajoutez chaque garniture avant ou après cuisson selon la pizza choisie.' },
    { en: 'Dimple the dough gently with oiled fingers before baking.', fr: 'Marquez doucement la pâte du bout des doigts huilés avant la cuisson.' },
  ],
  pan: [
    { en: 'Oil the pan, including the corners, to help release the pizza.', fr: 'Huilez le moule, y compris les coins, pour faciliter le démoulage.' },
    { en: 'Follow the topping order for the selected pizza; not every pan pizza uses cheese or sauce.', fr: 'Suivez l’ordre des garnitures de la pizza choisie ; une pizza en moule ne contient pas toujours du fromage ou de la sauce.' },
    { en: 'Use the baking steps for your oven. Check that the base is cooked as well as the edges.', fr: 'Suivez les étapes de cuisson adaptées à votre four. Vérifiez la cuisson du dessous, pas seulement celle des bords.' },
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
  totalAmount?: number;
  unit?: IngredientUnit;
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

export default function PrepTab({ locale, selectedPizzas, onGoToBake, onGoToShopping, onGoToPizzas, styleKey, storagePrefix="bh" }: Props) {
  const l = locale as 'en' | 'fr';
  // Persisted so ticks survive leaving/reopening the app (cleared on Start Over)
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const ticksHydrated = useState(() => ({ done: false }))[0];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${storagePrefix}_prep_ticks_v1`);
      if (raw) setCompleted(new Set(JSON.parse(raw) as string[]));
    } catch {}
    ticksHydrated.done = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ticksHydrated.done) return;
    try { localStorage.setItem(`${storagePrefix}_prep_ticks_v1`, JSON.stringify([...completed])); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed]);

  function toggle(id: string) {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Collect tasks from selected pizzas — accumulate quantities across multiple pizzas
  const taskMap: Record<string, PrepTask> = {};
  const allPizzas = [...PIZZAS, ...DESSERT_PIZZAS, ...getCustomPizzaList()];

  Object.entries(selectedPizzas).forEach(([pizzaId, qty]) => {
    if (!qty) return;
    const pizza = allPizzas.find(p => p.id === pizzaId);
    if (!pizza) return;
    pizza.ingredients.forEach((ing: Ingredient) => {
      if (!ing.prepNote) return;
      if (!taskMap[ing.id]) {
        const styleNote = styleKey ? (ing as any).prepNoteByStyle?.[styleKey] : undefined;
        const note = styleNote ?? ing.prepNote;
        const timing = note.timing ?? 0;
        const mustCool = timing >= 15 && (ing.category === 'meat' || ing.category === 'sauce');
        taskMap[ing.id] = {
          id: `ing_${ing.id}`,
          ingredientName: ing.name[l] ?? ing.name.en,
          text: note.en,
          textFr: note.fr,
          timing,
          mustCool,
          category: ing.category,
          totalAmount: undefined,
          unit: undefined,
        };
      }
      if (ing.qtyPerPizza) {
        const multiplier = styleKey ? ((ing as any).qtyMultiplierByStyle?.[styleKey] ?? 1) : 1;
        taskMap[ing.id].totalAmount = (taskMap[ing.id].totalAmount ?? 0) + ing.qtyPerPizza.amount * qty * multiplier;
        taskMap[ing.id].unit = ing.qtyPerPizza.unit;
      }
    });
  });

  const tasks = Object.values(taskMap);

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
          display: 'flex', alignItems: 'flex-start', gap: '12px',
          padding: '12px 16px',
          borderTop: '1px solid #E8E0D5',
          cursor: 'pointer',
          background: done ? '#FAFAF8' : '#FDFBF7',
        }}
      >
        <div style={{
          width: '22px', height: '22px', borderRadius: '16px', flexShrink: 0,
          marginTop: '1px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: done ? '1.5px solid #9C8248' : '1.5px solid #E0D8CF',
          background: done ? '#9C8248' : '#FDFBF7',
        }}>
          {done && <span style={{ fontSize: '11px', color: '#2B2420' }}>&#10003;</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            gap: '8px', marginBottom: '2px',
          }}>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0 }}>
              <span style={{
                fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600,
                color: done ? '#8A7F78' : '#2B2420',
                textDecoration: done ? 'line-through' : undefined,
              }}>
                {task.ingredientName}
              </span>
              {task.totalAmount != null && task.unit && (
                <span style={{
                  fontFamily: 'var(--font-ui)', fontSize: '11px',
                  color: done ? '#B8A9A0' : '#6B4423', flexShrink: 0,
                }}>
                  {formatQty(task.totalAmount, task.unit, l)}
                </span>
              )}
            </span>
            {task.timing > 5 && (
              <span style={{
                fontFamily: 'var(--font-ui)', fontSize: '11px',
                color: '#8A7F78', flexShrink: 0,
              }}>
                {task.timing} {l === 'fr' ? 'min' : 'min'}
              </span>
            )}
          </div>
          <span style={{
            fontFamily: 'var(--font-ui)', fontSize: '12px', lineHeight: 1.4,
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
      <div key={stationId} style={{ marginBottom: '20px' }}>
        <div style={{
          fontSize: '15px', fontWeight: 700,
          color: '#2B2420',
          fontFamily: 'var(--font-ui)',
          padding: '12px 2px 8px',
        }}>
          {l === 'fr' ? station.fr : station.en}
        </div>
        <div style={{
          border: '1px solid #E8E0D5',
          borderRadius: '0 0 16px 16px',
          overflow: 'hidden',
        }}>
          {stationTasks.map((task, i) => renderTask(task, i === stationTasks.length - 1))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px 24px' }}>
      {allPizzas.filter(p => (selectedPizzas[p.id] ?? 0) > 0 && p.preparationSequence).map(p => <details key={p.id} style={{ marginBottom: 12 }}>
        <summary>{p.name[l]} · {l === 'fr' ? 'Ordre de préparation' : 'Preparation order'}</summary>
        <p style={{ fontSize: 13, lineHeight: 1.5 }}>{p.preparationSequence?.[l]}</p>
      </details>)}

      {/* Style-specific notes */}
      {styleKey && STYLE_PREP_NOTES[styleKey] && (
        <div style={{ margin: '0 0 16px', border: '1px solid #E8E0D5', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ background: '#2B2420', color: 'white', padding: '8px 16px', fontSize: '11px', fontFamily: 'var(--font-ui)', letterSpacing: '1px', textTransform: 'uppercase' }}>
            {styleKey === 'pan' ? (l === 'fr' ? 'Pizza en moule' : 'Pan pizza') : (l === 'fr' ? 'Pizza sur plaque' : 'Tray pizza')}
          </div>
          {STYLE_PREP_NOTES[styleKey]!.map((note, i) => (
            <div key={i} style={{ padding: '12px 16px', borderBottom: i < STYLE_PREP_NOTES[styleKey]!.length - 1 ? '1px solid #E8E0D5' : 'none', fontSize: '13px', color: '#3D3530', fontFamily: 'var(--font-ui)', lineHeight: 1.5 }}>
              {l === 'fr' ? note.fr : note.en}
            </div>
          ))}
        </div>
      )}

      {!hasAny ? (
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: '#8A7F78', textAlign: 'center', padding: '32px 0' }}>
          {l === 'fr' ? 'Aucune préparation nécessaire — vous êtes prêt.' : 'No prep needed — you\'re good to go.'}
        </div>
      ) : (
        <>
          {/* Phase 1 — Get ahead */}
          {hasEarly && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, color: '#2B2420', marginBottom: '2px' }}>
                {l === 'fr' ? 'Commencez par là' : 'Get ahead'}
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: '#8A7F78', marginBottom: '12px' }}>
                {l === 'fr'
                  ? 'Ces ingrédients ont besoin de temps ou doivent refroidir — ils se gardent au frigo.'
                  : 'These need time or must cool — they keep in the fridge until you\'re ready.'}
              </div>
              {earlyStations.map(s => renderStationBlock(s))}
            </div>
          )}

          {/* Divider */}
          {hasEarly && hasFlex && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0 16px' }}>
              <div style={{ flex: 1, height: '1px', background: '#E8E0D5' }} />
              <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'var(--font-ui)', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                {l === 'fr' ? 'quand vous voulez' : 'whenever you\'re ready'}
              </div>
              <div style={{ flex: 1, height: '1px', background: '#E8E0D5' }} />
            </div>
          )}

          {/* Phase 2 — Flexible */}
          {hasFlex && (
            <div>
              {!hasEarly && (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: '#8A7F78', marginBottom: '12px' }}>
                  {l === 'fr' ? 'Préparez ces ingrédients pendant le préchauffage ou juste avant de garnir.' : 'Prepare these ingredients during preheating or just before topping.'}
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
          background: '#6B4423', color: 'white',
          fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600,
          borderRadius: '12px', marginTop: '24px',
          cursor: 'pointer', border: 'none',
        }}
      >
        {l === 'fr' ? 'Cuire les pizzas →' : 'Cook pizzas →'}
      </button>
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button
          type="button"
          onClick={onGoToShopping}
          style={{
            flex: 1, minHeight: '44px', padding: '10px 12px',
            border: '1px solid #E0D8CF', borderRadius: '12px',
            background: '#FDFBF7', color: '#3D3530',
            fontFamily: 'var(--font-ui)', fontSize: '13px', cursor: 'pointer',
          }}
        >
          {l === 'fr' ? 'Liste de courses' : 'Shopping list'}
        </button>
        <button
          type="button"
          onClick={onGoToPizzas}
          style={{
            flex: 1, minHeight: '44px', padding: '10px 12px',
            border: '1px solid #E0D8CF', borderRadius: '12px',
            background: '#FDFBF7', color: '#3D3530',
            fontFamily: 'var(--font-ui)', fontSize: '13px', cursor: 'pointer',
          }}
        >
          {l === 'fr' ? 'Modifier les pizzas' : 'Change pizzas'}
        </button>
      </div>
    </div>
  );
}
