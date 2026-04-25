'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PIZZAS } from '../../lib/toppingDatabase';

interface Props {
  bakeTime: Date;
  locale: string;
  selectedPizzas: Record<string, number>;
  onGoToBake: () => void;
  styleKey?: string;
}

const STYLE_PREP_NOTES: Partial<Record<string, { en: string; fr: string }[]>> = {
  roman: [
    {
      en: 'Oil your baking tray generously — the teglia base needs to fry slightly in the oil for the crispy bottom.',
      fr: "Huiler généreusement votre plaque — la base teglia doit légèrement frire dans l'huile pour le fond croustillant.",
    },
    {
      en: 'First bake: bake the dough plain at 250°C for 10 min until set. Then add toppings and bake a further 10–12 min.',
      fr: 'Première cuisson : cuire la pâte seule à 250°C pendant 10 min jusqu\'à ce qu\'elle soit prise. Puis ajouter les garnitures et cuire encore 10–12 min.',
    },
    {
      en: 'Dimple the surface with oiled fingers just before the first bake — this gives the teglia its characteristic texture.',
      fr: "Faire des empreintes dans la surface avec les doigts huilés juste avant la première cuisson — c'est ce qui donne à la teglia sa texture caractéristique.",
    },
  ],
  pan: [
    {
      en: 'Oil the pan heavily — the cheese at the edges will fry in the oil and create the frico crust. This is not optional.',
      fr: "Huiler généreusement le moule — le fromage sur les bords va frire dans l'huile et créer la croûte frico. Ce n'est pas optionnel.",
    },
    {
      en: 'Press the cheese all the way to the edges and corners of the pan before baking — it must touch the pan walls.',
      fr: 'Pousser le fromage jusqu\'aux bords et coins du moule avant d\'enfourner — il doit toucher les parois du moule.',
    },
    {
      en: 'Sauce goes on TOP of the cheese, not underneath. Add it after placing cheese, in stripes across the surface.',
      fr: 'La sauce va SUR le fromage, pas en dessous. L\'ajouter après le fromage, en lignes sur la surface.',
    },
    {
      en: 'Bake at 230°C for 20–25 min. The crust is done when the edges are deep golden and pulling away from the pan.',
      fr: 'Cuire à 230°C pendant 20–25 min. La croûte est prête quand les bords sont bien dorés et se décollent du moule.',
    },
  ],
};

interface PrepTask {
  id: string;
  ingredientName: string;
  text: string;
  textFr: string;
  timing: number;
}

const SETUP_TASKS: PrepTask[] = [
  { id: 'fridge_out',      ingredientName: '', text: 'Take dough out of the fridge',    textFr: 'Sortir la pâte du réfrigérateur',         timing: 60 },
  { id: 'preheat',         ingredientName: '', text: 'Preheat oven to full temperature', textFr: 'Préchauffer le four à température max',   timing: 45 },
  { id: 'dough_counter',   ingredientName: '', text: 'Move dough balls to the counter',  textFr: 'Poser les pâtons sur le plan de travail', timing: 15 },
  { id: 'flour_surface',   ingredientName: '', text: 'Dust work surface with flour',     textFr: 'Fariner le plan de travail',              timing: 10 },
  { id: 'topping_station', ingredientName: '', text: 'Set up topping station',           textFr: 'Préparer la station garnitures',          timing: 5 },
];

export default function PrepTab({ locale, selectedPizzas, onGoToBake, styleKey }: Props) {
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
        ingredientName: ing.name[l] ?? ing.name.en,
        text: ing.prepNote.en,
        textFr: ing.prepNote.fr,
        timing: ing.prepNote.timing ?? 0,
      });
    });
  });

  // Merge setup + ingredient tasks, sort by timing descending (longest first)
  const allTasks: PrepTask[] = [...SETUP_TASKS, ...ingredientTasks]
    .sort((a, b) => b.timing - a.timing);

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

      {/* Style-specific prep notes (Teglia / Detroit only) */}
      {styleKey && STYLE_PREP_NOTES[styleKey] && (
        <div style={{
          margin: '16px 0',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          <div style={{
            background: 'var(--char)',
            color: 'white',
            padding: '8px 14px',
            fontSize: '10px',
            fontFamily: 'DM Mono, monospace',
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}>
            {styleKey === 'pan'
              ? (l === 'fr' ? 'Style Detroit' : 'Detroit Style')
              : (l === 'fr' ? 'Style Teglia' : 'Teglia Style')}
          </div>
          {STYLE_PREP_NOTES[styleKey]!.map((note, i) => (
            <div key={i} style={{
              padding: '10px 14px',
              borderBottom: i < STYLE_PREP_NOTES[styleKey]!.length - 1
                ? '1px solid var(--border)' : 'none',
              fontSize: '13px',
              color: 'var(--ash)',
              fontFamily: 'DM Sans, sans-serif',
              lineHeight: 1.5,
            }}>
              {l === 'fr' ? note.fr : note.en}
            </div>
          ))}
        </div>
      )}

      {/* Task list */}
      {allTasks.length === 0 ? (
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--smoke)', textAlign: 'center', padding: '32px 0' }}>
          {t('empty')}
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
          {allTasks.map((task, i) => {
            const done = completed.has(task.id);
            return (
              <div
                key={task.id}
                onClick={() => toggleCompleted(task.id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  minHeight: '64px', padding: '12px 14px',
                  borderBottom: i < allTasks.length - 1 ? '1px solid var(--border)' : undefined,
                  cursor: 'pointer',
                }}
              >
                {/* Checkbox */}
                <div style={{
                  width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
                  marginTop: '2px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: done ? '1.5px solid var(--gold)' : '1.5px solid var(--border)',
                  background: done ? 'var(--gold)' : 'var(--warm)',
                }}>
                  {done && <span style={{ fontSize: '14px', color: 'var(--char)' }}>&#10003;</span>}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {task.ingredientName ? (
                    <>
                      {/* Row 1: ingredient name + timing */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                        <span style={{
                          fontFamily: 'Playfair Display, serif',
                          fontSize: '14px', fontWeight: 600,
                          color: done ? 'var(--smoke)' : 'var(--char)',
                          textDecoration: done ? 'line-through' : undefined,
                        }}>
                          {task.ingredientName}
                        </span>
                        {task.timing > 5 && (
                          <span style={{
                            fontFamily: 'DM Mono, monospace', fontSize: '10px',
                            color: 'var(--smoke)', flexShrink: 0, marginLeft: '8px',
                          }}>
                            {task.timing} min before
                          </span>
                        )}
                      </div>
                      {/* Row 2: prep instruction */}
                      <span style={{
                        fontFamily: 'DM Sans, sans-serif',
                        fontSize: '13px', lineHeight: 1.4,
                        color: 'var(--smoke)',
                        textDecoration: done ? 'line-through' : undefined,
                        opacity: done ? 0.6 : 1,
                      }}>
                        {l === 'fr' ? task.textFr : task.text}
                      </span>
                    </>
                  ) : (
                    /* Setup task — single line with optional timing */
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontFamily: 'DM Sans, sans-serif', fontSize: '15px', lineHeight: 1.4,
                        color: done ? 'var(--smoke)' : 'var(--char)',
                        textDecoration: done ? 'line-through' : undefined,
                        opacity: done ? 0.55 : 1,
                      }}>
                        {l === 'fr' ? task.textFr : task.text}
                      </span>
                      {task.timing > 5 && (
                        <span style={{
                          fontFamily: 'DM Mono, monospace', fontSize: '10px',
                          color: 'var(--smoke)', flexShrink: 0, marginLeft: '8px',
                        }}>
                          {task.timing} min before
                        </span>
                      )}
                    </div>
                  )}
                </div>
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
