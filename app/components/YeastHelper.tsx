'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { type YeastType } from '../data';
import DecisionList from './DecisionList';
import DecisionSummary from './DecisionSummary';

interface CalcData {
  rtHours: number;
  coldHours: number;
  kitchenTemp: number;
  fridgeTemp: number;
  idyPct: number;
  idyGrams: number;
}

interface YeastHelperProps {
  onSelect: (yeastType: YeastType) => void;
  onClose: () => void;
  selected?: YeastType | null;
  calcData?: CalcData;
}

export default function YeastHelper({ onSelect, onClose, selected, calcData }: YeastHelperProps) {
  const t = useTranslations('yeast');
  const [expanded, setExpanded] = useState(!selected);
  const [showCalc, setShowCalc] = useState(false);

  // Option IDs use YEAST_TYPES keys; i18n keys use simplified aliases (idy/ady)
  const options = [
    { id: 'instant',    image: '/yeast_instant.png',   title: t('idy.title'),       tagline: t('idy.tagline') },
    { id: 'active_dry', image: '/yeast_active.png',    title: t('ady.title'),       tagline: t('ady.tagline') },
    { id: 'fresh',      image: '/yeast_fresh.png',     title: t('fresh.title'),     tagline: t('fresh.tagline') },
    { id: 'sourdough',  image: '/yeast_sourdough.png', title: t('sourdough.title'), tagline: t('sourdough.tagline') },
  ];

  const selectedOpt = options.find(o => o.id === selected);

  return (
    <div>
      {!expanded && selectedOpt ? (
        <DecisionSummary
          thumbnail={selectedOpt.image}
          title={selectedOpt.title}
          tagline={selectedOpt.tagline}
          onExpand={() => setExpanded(true)}
        />
      ) : (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'Playfair Display', fontSize: 22, fontWeight: 700, color: 'var(--char)', margin: 0 }}>
              {t('heading')}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--smoke)', margin: '4px 0 0', fontFamily: 'DM Sans' }}>
              {t('subtitle')}
            </p>
          </div>
          <DecisionList
            options={options}
            selectedId={selected ?? ''}
            onSelect={(id) => { onSelect(id as YeastType); setExpanded(false); }}
          />
        </div>
      )}

      {/* Transparency panel — always visible when calcData is present */}
      {calcData && (
        <div style={{ marginTop: '.75rem' }}>
          <button
            onClick={() => setShowCalc(v => !v)}
            style={{
              fontSize: '.72rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)',
              cursor: 'pointer', textDecoration: 'underline', background: 'none',
              border: 'none', padding: 0,
            }}
          >
            {showCalc ? 'Hide calculation ↑' : 'How was this calculated? ↓'}
          </button>

          {showCalc && (
            <div style={{
              background: 'var(--cream)', border: '1.5px solid var(--border)',
              borderRadius: '10px', padding: '.85rem 1rem', marginTop: '.5rem',
              fontSize: '.75rem', color: 'var(--ash)', lineHeight: 1.7,
            }}>
              <div>Model: Craig&apos;s per-stage formula v1.1</div>
              <div style={{ fontFamily: 'var(--font-dm-mono)' }}>
                RT phases: IDY% = 9.5 / (hours^1.65 × 2.5^((temp−25)/10))
              </div>
              <div style={{ fontFamily: 'var(--font-dm-mono)' }}>
                Cold phase: IDY% = 7.5 / hours^1.313
              </div>
              {calcData.kitchenTemp >= 30 && (
                <div>
                  Tropical correction applied:{' '}
                  <span style={{ fontFamily: 'var(--font-dm-mono)' }}>
                    ÷{calcData.kitchenTemp <= 32 ? '1.15' : '1.25'} at {calcData.kitchenTemp <= 32 ? '30–32°C' : '33–35°C'}
                  </span>
                </div>
              )}
              <div style={{ marginTop: '.35rem' }}>
                <span style={{ fontFamily: 'var(--font-dm-mono)' }}>
                  RT hours: {calcData.rtHours}h
                  {' · '}Cold hours: {calcData.coldHours}h
                  {' · '}Kitchen: {calcData.kitchenTemp}°C
                  {' · '}Fridge: {calcData.fridgeTemp}°C
                </span>
              </div>
              <div>
                Result:{' '}
                <span style={{ fontFamily: 'var(--font-dm-mono)' }}>
                  IDY: {calcData.idyPct}% → {calcData.idyGrams}g
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
