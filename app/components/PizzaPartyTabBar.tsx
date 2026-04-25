'use client';
import { useTranslations } from 'next-intl';

type Tab = 'pick' | 'shop' | 'prep' | 'bake';

interface PizzaPartyTabBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  locale: string;
}

export default function PizzaPartyTabBar({ activeTab, onTabChange }: PizzaPartyTabBarProps) {
  const t = useTranslations('pizzaParty');

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
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      padding: '0 4px',
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
              textAlign: 'center' as const,
              padding: '10px 4px',
              fontSize: '12px',
              fontFamily: 'DM Sans, sans-serif',
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              position: 'relative' as const,
              marginBottom: '-1px',
              borderBottom: isActive ? '2px solid var(--terra)' : '2px solid transparent',
              color: isActive || isCompleted ? 'var(--terra)' : 'var(--smoke)',
              fontWeight: isActive ? 700 : isCompleted ? 500 : 400,
            }}
          >
            {tab.label}
            {isCompleted && (
              <span style={{
                position: 'absolute',
                top: '6px',
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
  );
}
