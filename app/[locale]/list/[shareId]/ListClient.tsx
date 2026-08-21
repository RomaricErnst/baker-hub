'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { createClient } from '@/app/lib/supabase/client';

type Locale = { en: string; fr: string };

type SharedItem = {
  id: string;
  name: Locale;
  category: string;
  totalAmount?: number;
  unit?: string;
  forPizzas?: string[];
};

type DoughItem = {
  name: string;
  amount: string;
};

type ShareRow = {
  id: string;
  title: string | null;
  items: SharedItem[];
  dough_items: DoughItem[];
  checked: Record<string, boolean>;
};

const SECTION_ORDER = ['veg', 'cheese', 'base', 'meat', 'seafood', 'sauce', 'finish', 'spice'];

const SECTION_LABELS: Record<string, Locale> = {
  veg:     { en: 'Produce',         fr: 'Fruits & Légumes' },
  cheese:  { en: 'Dairy & Chilled', fr: 'Crèmerie & Frais' },
  base:    { en: 'Dairy & Chilled', fr: 'Crèmerie & Frais' },
  meat:    { en: 'Deli & Meat',     fr: 'Charcuterie & Viande' },
  seafood: { en: 'Fish & Seafood',  fr: 'Poisson & Fruits de mer' },
  sauce:   { en: 'Sauce & Pantry',  fr: 'Sauces & Épicerie' },
  finish:  { en: 'Sauce & Pantry',  fr: 'Sauces & Épicerie' },
  spice:   { en: 'Sauce & Pantry',  fr: 'Sauces & Épicerie' },
};

const UNIT_LABELS: Record<string, Locale> = {
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

function formatQty(amount: number, unit: string, l: 'en' | 'fr'): string {
  const label = UNIT_LABELS[unit]?.[l] ?? unit;
  return `${amount} ${label}`;
}

export default function ListClient({ shareId }: { shareId: string }) {
  const locale = useLocale();
  const l = (locale === 'fr' ? 'fr' : 'en') as 'en' | 'fr';
  const [row, setRow] = useState<ShareRow | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'not_found'>('loading');

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase
      .from('shopping_list_shares')
      .select('id, title, items, dough_items, checked')
      .eq('id', shareId)
      .single()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) { setStatus('not_found'); return; }
        setRow(data as ShareRow);
        setStatus('ok');
      });

    const channel = supabase
      .channel(`shopping_list_shares:${shareId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'shopping_list_shares', filter: `id=eq.${shareId}` },
        (payload) => {
          if (!active) return;
          setRow(payload.new as ShareRow);
        }
      )
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [shareId]);

  const toggle = useCallback((itemId: string) => {
    setRow((prev) => {
      if (!prev) return prev;
      const nextChecked = { ...prev.checked, [itemId]: !prev.checked[itemId] };
      const supabase = createClient();
      supabase.from('shopping_list_shares').update({ checked: nextChecked }).eq('id', shareId).then();
      return { ...prev, checked: nextChecked };
    });
  }, [shareId]);

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100dvh', background: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#8A7F78', fontFamily: 'var(--font-dm-sans)', fontSize: '13px' }}>
          {l === 'fr' ? 'Chargement…' : 'Loading…'}
        </div>
      </div>
    );
  }

  if (status === 'not_found' || !row) {
    return (
      <div style={{ minHeight: '100dvh', background: '#F5F0E8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '20px', color: '#1A1612', marginBottom: '8px' }}>
          {l === 'fr' ? 'Liste introuvable' : 'List not found'}
        </div>
        <div style={{ color: '#8A7F78', fontFamily: 'var(--font-dm-sans)', fontSize: '13px' }}>
          {l === 'fr' ? "Ce lien n'est plus valide." : 'This link is no longer valid.'}
        </div>
      </div>
    );
  }

  const sections = SECTION_ORDER
    .map((cat) => {
      const label = SECTION_LABELS[cat][l];
      const seen = new Set<string>();
      const items = row.items.filter((item) => {
        const itemLabel = SECTION_LABELS[item.category]?.[l];
        return itemLabel === label;
      });
      return { label, items, key: cat };
    })
    .filter((s) => s.items.length > 0)
    // de-dupe sections that share a label (cheese/base both -> Dairy & Chilled)
    .reduce<Array<{ label: string; items: SharedItem[] }>>((acc, s) => {
      const existing = acc.find((a) => a.label === s.label);
      if (existing) existing.items.push(...s.items);
      else acc.push({ label: s.label, items: s.items });
      return acc;
    }, []);

  const totalItems = row.items.length + row.dough_items.length;
  const checkedCount = row.items.filter((i) => row.checked[i.id]).length
    + row.dough_items.filter((_, idx) => row.checked['dough_' + idx]).length;

  return (
    <div style={{ minHeight: '100dvh', background: '#F5F0E8', paddingBottom: '40px' }}>
      <div style={{ background: '#2B2420', padding: '20px 20px 16px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '20px', fontWeight: 700, color: '#F5F0E8' }}>
          Baker Hub
        </div>
        {row.title && (
          <div style={{ color: '#C8A878', fontSize: '13px', marginTop: '4px', fontFamily: 'var(--font-dm-sans)' }}>
            {row.title}
          </div>
        )}
      </div>

      <div style={{ padding: '16px 16px 4px', textAlign: 'center' }}>
        <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'var(--font-dm-mono)' }}>
          {checkedCount} / {totalItems} {l === 'fr' ? 'cochés' : 'checked'}
        </div>
        <div style={{ fontSize: '11px', color: '#8A7F78', marginTop: '4px', fontFamily: 'var(--font-dm-sans)' }}>
          {l === 'fr'
            ? 'Synchronisé en direct — visible par tous ceux qui ont ce lien.'
            : 'Synced live — visible to anyone with this link.'}
        </div>
      </div>

      <div style={{ padding: '8px 16px' }}>
        {sections.map((section) => (
          <div key={section.label} style={{ marginBottom: '20px' }}>
            <div style={{
              fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
              color: '#8A7F78', margin: '0 0 8px 4px', fontFamily: 'var(--font-dm-sans)',
            }}>
              {section.label}
            </div>
            <div style={{ background: '#FDFBF7', borderRadius: '16px', border: '1px solid #E8E0D5', overflow: 'hidden' }}>
              {section.items.map((item, idx) => {
                const isChecked = !!row.checked[item.id];
                return (
                  <div
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 16px',
                      borderTop: idx > 0 ? '1px solid #E8E0D5' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                      border: isChecked ? 'none' : '1.5px solid #C8C0B8',
                      background: isChecked ? '#6B7A5A' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isChecked && (
                        <svg viewBox="0 0 12 12" width={11} height={11} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </div>
                    <span style={{
                      flex: 1, fontSize: '14px', fontFamily: 'var(--font-dm-sans)',
                      color: isChecked ? '#B0A89E' : '#2B2420',
                    }}>
                      {item.name[l] ?? item.name.en}
                    </span>
                    {item.totalAmount != null && item.unit && (
                      <span style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'var(--font-dm-mono)' }}>
                        {formatQty(item.totalAmount, item.unit, l)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {row.dough_items.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
              color: '#8A7F78', margin: '0 0 8px 4px', fontFamily: 'var(--font-dm-sans)',
            }}>
              {l === 'fr' ? 'Pour votre pâte' : 'For your dough'}
            </div>
            <div style={{ background: '#FDFBF7', borderRadius: '16px', border: '1px solid #E8E0D5', overflow: 'hidden' }}>
              {row.dough_items.map((item, idx) => {
                const itemId = 'dough_' + idx;
                const isChecked = !!row.checked[itemId];
                return (
                  <div
                    key={itemId}
                    onClick={() => toggle(itemId)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 16px',
                      borderTop: idx > 0 ? '1px solid #E8E0D5' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                      border: isChecked ? 'none' : '1.5px solid #C8C0B8',
                      background: isChecked ? '#6B7A5A' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isChecked && (
                        <svg viewBox="0 0 12 12" width={11} height={11} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </div>
                    <span style={{
                      flex: 1, fontSize: '14px', fontFamily: 'var(--font-dm-sans)',
                      color: isChecked ? '#B0A89E' : '#2B2420',
                    }}>
                      {item.name}
                    </span>
                    <span style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'var(--font-dm-mono)' }}>
                      {item.amount}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', fontSize: '11px', color: '#B0A89E', fontFamily: 'var(--font-dm-mono)', marginTop: '8px' }}>
        bakerhub.app
      </div>
    </div>
  );
}
