'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface PrepTask {
  id: string;
  text: string;
  textFr: string;
  minutesBeforeBake: number;
  source: 'dough' | 'topping';
}

const DOUGH_TASKS: PrepTask[] = [
  { id: 'fridge_out',      text: 'Take dough out of the fridge',        textFr: 'Sortir la pâte du réfrigérateur',            minutesBeforeBake: 60, source: 'dough' },
  { id: 'preheat',         text: 'Preheat oven to full temperature',     textFr: 'Préchauffer le four à température maximale', minutesBeforeBake: 45, source: 'dough' },
  { id: 'flour_surface',   text: 'Dust work surface with flour',         textFr: 'Fariner le plan de travail',                 minutesBeforeBake: 15, source: 'dough' },
  { id: 'dough_counter',   text: 'Move dough balls to the counter',      textFr: 'Poser les pâtons sur le plan de travail',    minutesBeforeBake: 15, source: 'dough' },
  { id: 'topping_station', text: 'Set up topping station',               textFr: 'Préparer la station garnitures',             minutesBeforeBake: 10, source: 'dough' },
];

type Bucket = 'now' | '30min' | '15min' | 'ready';
type BucketedTask = PrepTask & { bucket: Bucket };

interface Props {
  bakeTime: Date;
  locale: string;
  selectedPizzas: Record<string, number>;
  onGoToBake: () => void;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getBucket(task: PrepTask, minutesLeft: number): Bucket | null {
  if (task.minutesBeforeBake >= minutesLeft + 5) return null; // past — time has passed
  if (task.minutesBeforeBake >= minutesLeft - 5) return 'now'; // currently due
  if (task.minutesBeforeBake >= 25 && task.minutesBeforeBake <= 35) return '30min';
  if (task.minutesBeforeBake >= 10 && task.minutesBeforeBake <= 20) return '15min';
  if (task.minutesBeforeBake >= -5 && task.minutesBeforeBake <= 5) return 'ready';
  return null; // future, not yet in a named bucket
}

const BUCKET_ORDER: Bucket[] = ['now', '30min', '15min', 'ready'];

export default function PrepTab({ bakeTime, locale, onGoToBake }: Props) {
  const t = useTranslations('prep');
  const l = locale as 'en' | 'fr';
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const minutesLeft = (bakeTime.getTime() - now.getTime()) / 60000;
  const isPast = minutesLeft < 0;

  const allTasks: PrepTask[] = [...DOUGH_TASKS].sort((a, b) => b.minutesBeforeBake - a.minutesBeforeBake);

  const bucketed: BucketedTask[] = allTasks
    .map(task => {
      const bucket = getBucket(task, minutesLeft);
      return bucket ? { ...task, bucket } : null;
    })
    .filter((item): item is BucketedTask => item !== null);

  const grouped = BUCKET_ORDER.reduce<Record<Bucket, BucketedTask[]>>((acc, b) => {
    acc[b] = bucketed.filter(task => task.bucket === b);
    return acc;
  }, { now: [], '30min': [], '15min': [], ready: [] });

  const nowTasks = grouped['now'];
  const allNowDone = nowTasks.length > 0 && nowTasks.every(task => completed.has(task.id));

  function toggleCompleted(id: string) {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function bucketLabel(bucket: Bucket): string {
    switch (bucket) {
      case 'now': return t('bucket.now');
      case '30min': return `${t('bucket.30min')} (${formatTime(new Date(bakeTime.getTime() - 30 * 60000))})`;
      case '15min': return `${t('bucket.15min')} (${formatTime(new Date(bakeTime.getTime() - 15 * 60000))})`;
      case 'ready': return t('bucket.ready');
    }
  }

  const hasAnyTasks = bucketed.length > 0;

  return (
    <div style={{ padding: '0 16px 24px' }}>
      {/* Header card */}
      <div style={{
        border: '1px solid var(--border)', borderRadius: '14px', padding: '16px',
        marginTop: '16px', marginBottom: '16px',
        background: 'linear-gradient(135deg, rgba(196,82,42,0.06) 0%, transparent 60%)',
      }}>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '20px', fontWeight: 700, color: 'var(--char)', marginBottom: '4px' }}>
          {t('header.title', { time: formatTime(bakeTime) })}
        </div>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '13px', color: isPast ? 'var(--sage)' : 'var(--terra)' }}>
          {isPast
            ? t('header.past')
            : t('header.subtitle', { n: Math.round(minutesLeft) })}
        </div>
      </div>

      {/* Empty state when no tasks in any bucket */}
      {!hasAnyTasks && (
        <div style={{ textAlign: 'center', color: 'var(--smoke)', fontFamily: 'DM Sans, sans-serif', fontSize: '15px', paddingTop: '24px' }}>
          {l === 'fr'
            ? "Vos tâches apparaîtront ici à l'approche de la cuisson"
            : 'Your tasks will appear here as bake time approaches'}
        </div>
      )}

      {/* Bucket sections */}
      {BUCKET_ORDER.map(bucket => {
        const tasks = grouped[bucket];
        if (tasks.length === 0) return null;
        return (
          <div key={bucket}>
            <div style={{
              fontFamily: 'DM Sans, sans-serif', fontSize: '11px', textTransform: 'uppercase',
              letterSpacing: '1.5px', color: 'var(--smoke)',
              marginBottom: '8px', marginTop: '20px',
            }}>
              {bucketLabel(bucket)}
            </div>
            {tasks.map((task, i) => {
              const done = completed.has(task.id);
              return (
                <div
                  key={task.id}
                  onClick={() => toggleCompleted(task.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    minHeight: '56px', padding: '10px 0',
                    borderBottom: i < tasks.length - 1 ? '1px solid var(--border)' : undefined,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: done ? '1.5px solid var(--gold)' : '1.5px solid var(--border)',
                    background: done ? 'var(--gold)' : 'var(--warm)',
                  }}>
                    {done && (
                      <span style={{ fontSize: '14px', color: 'var(--char)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1 }}>
                        &#10003;
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontFamily: 'DM Sans, sans-serif', fontSize: '16px', lineHeight: 1.4,
                    color: done ? 'var(--smoke)' : 'var(--char)',
                    textDecoration: done ? 'line-through' : undefined,
                    opacity: done ? 0.6 : 1,
                  }}>
                    {l === 'fr' ? task.textFr : task.text}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* CTA — appears when all NOW tasks are checked */}
      {allNowDone && (
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
      )}
    </div>
  );
}
