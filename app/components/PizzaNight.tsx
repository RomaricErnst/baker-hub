'use client';
import { useState } from 'react';
import PizzaNightTabBar from './PizzaNightTabBar';
import ToppingSelector from './ToppingSelector';
import PrepTab from './pizzaNight/PrepTab';
import BakeTab from './pizzaNight/BakeTab';

type Tab = 'pick' | 'shop' | 'prep' | 'bake';
type Pill = 'pizzas' | 'shopping' | 'party';

interface PizzaNightProps {
  locale: string;
  bakeTime: Date;
  numItems: number;
  styleKey: string;
  t: (key: string) => string;
}

function tabToPill(tab: Tab): Pill {
  if (tab === 'shop') return 'shopping';
  return 'pizzas';
}

function pillToTab(pill: Pill): Tab {
  if (pill === 'shopping') return 'shop';
  if (pill === 'party') return 'prep';
  return 'pick';
}

export default function PizzaNight({ locale, bakeTime, numItems, styleKey, t }: PizzaNightProps) {
  const [activeTab, setActiveTab] = useState<Tab>('pick');
  const [qtys, setQtys] = useState<Record<string, number>>({});

  const showSelector = activeTab === 'pick' || activeTab === 'shop';

  return (
    <div>
      <PizzaNightTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        bakeTime={bakeTime}
        locale={locale}
      />

      {/* ToppingSelector stays mounted across pick/shop to preserve filter state */}
      <div style={{ display: showSelector ? 'block' : 'none' }}>
        <ToppingSelector
          locale={locale}
          numItems={numItems}
          activePill={tabToPill(activeTab)}
          onPillChange={(pill) => setActiveTab(pillToTab(pill))}
          t={t}
          styleKey={styleKey}
          controlledQtys={qtys}
          onQtysChange={setQtys}
        />
      </div>

      {activeTab === 'prep' && (
        <PrepTab
          bakeTime={bakeTime}
          locale={locale}
          selectedPizzas={qtys}
          onGoToBake={() => setActiveTab('bake')}
        />
      )}

      {activeTab === 'bake' && (
        <BakeTab
          selectedPizzas={qtys}
          locale={locale}
        />
      )}
    </div>
  );
}
