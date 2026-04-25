'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PIZZAS, ING } from '../../lib/toppingDatabase';

interface Props {
  bakeTime: Date;
  locale: string;
  selectedPizzas: Record<string, number>;
  onGoToBake: () => void;
}

interface PrepTask {
  id: string;
  en: string;
  fr: string;
  timing?: number;
}

const SETUP_TASKS: PrepTask[] = [
  { id: 'fridge_out',      en: 'Take dough out of the fridge',    fr: 'Sortir la pâte du réfrigérateur',         timing: 60 },
  { id: 'preheat',         en: 'Preheat oven to full temperature', fr: 'Préchauffer le four à température max',   timing: 45 },
  { id: 'dough_counter',   en: 'Move dough balls to the counter',  fr: 'Poser les pâtons sur le plan de travail', timing: 15 },
  { id: 'flour_surface',   en: 'Dust work surface with flour',     fr: 'Fariner le plan de travail',              timing: 10 },
  { id: 'topping_station', en: 'Set up topping station',           fr: 'Préparer la station garnitures',          timing: 5 },
];

export default function PrepTab({ locale, selectedPizzas, onGoToBake }: Props) {
  const t = useTranslations('prep');
  const l = locale as 'en' | 'fr';
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  function toggleCompleted(id: string) {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Collect unique ingredient prep tasks from selected pizzas
  const seen = new Set<string>();
  const ingredientTasks: PrepTask[] = [];

  Object.keys(selectedPizzas).forEach(pizzaId => {
    if (!selectedPizzas[pizzaId]) return;
    const pizza = PIZZAS.find(p => p.id === pizzaId);
    if (!pizza) return;
    pizza.ingredients.forEach(ing => {
      if (!ing.prepNote || seen.has(ing.id)) return;
      seen.add(ing.id);
      ingredientTasks.push({
        id: `ing_${ing.id}`,
        en: ing.prepNote.en,
        fr: ing.prepNote.fr,
        timing: ing.prepNote.timing,
      });
    });
  });

  // Merge setup + ingredient tasks, sort by timing descending (longest first)
  const allTasks: PrepTask[] = [...SETUP_TASKS, ...ingredientTasks]
    .sort((a, b) => (b.timing ?? 0) - (a.timing ?? 0));

  return (
    <div style={{ padding: '0 16px 24px' }}>
      {/* Header */}
      <div style={{
        border: '1px solid var(--border)', borderRadius: '14px', padding: '16px',
        marginTop: '16px', marginBottom: '16px',
        background: 'linear-gradient(135deg, rgba(196,82,42,0.06) 0%, transparent 60%)',
      }}>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '20px', fontWeight: 700, color: 'var(--char)' }}>
          {t('header.title')}
        </div>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--smoke)', marginTop: '4px' }}>
          {t('header.subtitle')}
        </div>
      </div>

      {/* Task list */}
      {allTasks.length === 0 ? (
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--smoke)', textAlign: 'center', padding: '32px 0' }}>
          {t('empty')}
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
          {allTasks.map((task, i) => {
            const done = completed.has(task.id);
            const label = l === 'fr' ? task.fr : task.en;
            const showTiming = (task.timing ?? 0) > 5;
            return (
              <div
                key={task.id}
                onClick={() => toggleCompleted(task.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  minHeight: '56px', padding: '10px 14px',
                  borderBottom: i < allTasks.length - 1 ? '1px solid var(--border)' : undefined,
                  cursor: 'pointer',
                  background: done ? 'rgba(138,127,120,0.04)' : 'white',
                }}
              >
                <div style={{
                  width: '24px', height: '24px', borderRadius: '6px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: done ? '1.5px solid var(--gold)' : '1.5px solid var(--border)',
                  background: done ? 'var(--gold)' : 'var(--warm)',
                }}>
                  {done && (
                    <span style={{ fontSize: '13px', color: 'white', fontFamily: 'DM Sans, sans-serif', lineHeight: 1 }}>
                      &#10003;
                    </span>
                  )}
                </div>
                <span style={{
                  fontFamily: 'DM Sans, sans-serif', fontSize: '15px', lineHeight: 1.4, flex: 1,
                  color: done ? 'var(--smoke)' : 'var(--char)',
                  textDecoration: done ? 'line-through' : undefined,
                  opacity: done ? 0.55 : 1,
                }}>
                  {label}
                </span>
                {showTiming && (
                  <span style={{
                    fontFamily: 'DM Mono, monospace', fontSize: '11px',
                    color: 'var(--smoke)', flexShrink: 0,
                  }}>
                    {t('timing', { n: task.timing ?? 0 })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Always-visible CTA */}
      <button
        onClick={onGoToBake}
        style={{
          width: '100%', height: '56px',
          background: 'var(--terra)', color: 'white',
          fontFamily: 'DM Sans, sans-serif', fontSize: '16px', fontWeight: 600,
          borderRadius: '14px', marginTop: '24px',
          cursor: 'pointer', border: 'none',
        }}
      >
        {t('cta')}
      </button>
    </div>
  );
}
