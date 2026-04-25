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
      background: 'var(--warm)',
      padding: '8px 16px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        display: 'flex',
        background: '#F5F0E8',
        borderRadius: '14px',
        padding: '4px',
        gap: '2px',
      }}>
        {tabs.map((tab, i) => {
          const isActive = i === activeIndex;
          const isCompleted = i < activeIndex;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '9px 4px',
                borderRadius: '10px',
                fontSize: '12px',
                cursor: 'pointer',
                border: 'none',
                position: 'relative',
                fontFamily: 'DM Sans, sans-serif',
                transition: 'all 0.2s',
                ...(isActive ? {
                  background: 'white',
                  color: 'var(--char)',
                  fontWeight: 700,
                  boxShadow: '0 1px 6px rgba(26,22,18,0.12)',
                } : isCompleted ? {
                  background: 'transparent',
                  color: 'var(--terra)',
                  fontWeight: 500,
                } : {
                  background: 'transparent',
                  color: 'var(--smoke)',
                  fontWeight: 400,
                }),
              }}
            >
              {tab.label}
              {isCompleted && (
                <span style={{
                  position: 'absolute',
                  top: '4px',
                  right: '8px',
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: 'var(--terra)',
                  display: 'block',
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
