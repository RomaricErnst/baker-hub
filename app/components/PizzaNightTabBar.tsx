'use client';
import { useTranslations } from 'next-intl';

type Tab = 'pick' | 'shop' | 'prep' | 'bake';

interface PizzaNightTabBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  bakeTime: Date;
  locale: string;
}

export default function PizzaNightTabBar({ activeTab, onTabChange, bakeTime }: PizzaNightTabBarProps) {
  const t = useTranslations('pizzaNight');
  const now = new Date();
  const msToBake = bakeTime.getTime() - now.getTime();
  const withinPrepWindow = msToBake > 0 && msToBake <= 60 * 60 * 1000;
  const bakeStarted = now >= bakeTime;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'pick', label: t('tab.pick') },
    { id: 'shop', label: t('tab.shop') },
    { id: 'prep', label: t('tab.prep') },
    { id: 'bake', label: t('tab.bake') },
  ];

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 20,
      padding: '8px 16px 0',
      background: 'var(--warm)',
    }}>
      <div style={{
        background: 'var(--cream)',
        borderRadius: '12px',
        padding: '3px',
        display: 'flex',
      }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const showDot =
            (tab.id === 'prep' && withinPrepWindow) ||
            (tab.id === 'bake' && bakeStarted);

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                flex: 1,
                height: '44px',
                borderRadius: '10px',
                cursor: 'pointer',
                border: 'none',
                fontSize: '13px',
                fontFamily: 'DM Sans, sans-serif',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--char)' : 'var(--smoke)',
                background: isActive ? 'white' : 'transparent',
                boxShadow: isActive ? '0 2px 8px rgba(26,22,18,0.10)' : 'none',
                position: 'relative',
              }}
            >
              {tab.label}
              {showDot && (
                <span style={{
                  position: 'absolute',
                  top: '6px',
                  right: '8px',
                  width: '6px',
                  height: '6px',
                  background: 'var(--gold)',
                  borderRadius: '50%',
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
