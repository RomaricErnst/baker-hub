'use client';
import { useTranslations } from 'next-intl';

type Tab = 'pick' | 'shop' | 'prep' | 'bake';

interface PizzaNightTabBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  locale: string;
}

export default function PizzaNightTabBar({ activeTab, onTabChange }: PizzaNightTabBarProps) {
  const t = useTranslations('pizzaNight');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'pick', label: t('tab.pick') },
    { id: 'shop', label: t('tab.shop') },
    { id: 'prep', label: t('tab.prep') },
    { id: 'bake', label: t('tab.bake') },
  ];

  const activeIndex = tabs.findIndex(tab => tab.id === activeTab);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      padding: '12px 20px 16px',
      background: 'var(--warm)',
      borderBottom: '1px solid var(--border)',
    }}>
      {tabs.map((tab, i) => {
        const isActive = i === activeIndex;
        const isCompleted = i < activeIndex;
        const isFuture = i > activeIndex;

        const leftLineColor = i <= activeIndex ? 'var(--gold)' : 'var(--border)';
        const rightLineColor = i < activeIndex ? 'var(--gold)' : 'var(--border)';

        const dotSize = isActive ? '12px' : '8px';
        const dotBackground = isActive ? 'var(--terra)' : isCompleted ? 'var(--gold)' : 'var(--border)';
        const dotBorder = isFuture ? '1.5px solid var(--smoke)' : undefined;

        const labelColor = isActive ? 'var(--char)' : isCompleted ? 'var(--gold)' : 'var(--smoke)';
        const labelWeight = isActive ? 700 : isCompleted ? 500 : 400;
        const labelSize = isActive ? '14px' : '12px';

        return (
          <div
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, cursor: 'pointer' }}
          >
            <span style={{
              fontFamily: 'DM Sans, sans-serif', fontSize: labelSize,
              marginBottom: '6px', color: labelColor, fontWeight: labelWeight,
            }}>
              {tab.label}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <div style={{ flex: 1, height: '1px', background: i === 0 ? 'transparent' : leftLineColor }} />
              <div style={{
                width: dotSize, height: dotSize, borderRadius: '50%', flexShrink: 0,
                background: dotBackground,
                border: dotBorder,
              }} />
              <div style={{ flex: 1, height: '1px', background: i === tabs.length - 1 ? 'transparent' : rightLineColor }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
