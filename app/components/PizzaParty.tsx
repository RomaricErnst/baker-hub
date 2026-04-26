'use client';
import { useState, useEffect } from 'react';
import { PizzaPartyTab } from './PizzaPartyTabBar';
import ToppingSelector from './ToppingSelector';
import PrepTab from './pizzaParty/PrepTab';
import BakeTab from './pizzaParty/BakeTab';

type Tab = PizzaPartyTab;
type Pill = 'pizzas' | 'shopping' | 'party';

interface PizzaPartyProps {
  locale: string;
  bakeTime: Date;
  numItems: number;
  styleKey?: string;
  t: (key: string) => string;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  doughConfigured?: boolean;
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

export default function PizzaParty({ locale, bakeTime, numItems, styleKey: initialStyleKey, t, activeTab, onTabChange, doughConfigured }: PizzaPartyProps) {
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [styleKey, setStyleKey] = useState<string | undefined>(initialStyleKey);
  const [pickStyleKey, setPickStyleKey] = useState<string | undefined>(initialStyleKey);

  useEffect(() => {
    setPickStyleKey(initialStyleKey);
  }, [initialStyleKey]);

  const showSelector = activeTab === 'pick' || activeTab === 'shop';

  return (
    <div>
      {/* ToppingSelector stays mounted across pick/shop to preserve filter state */}
      <div style={{ display: showSelector ? 'block' : 'none' }}>
        <ToppingSelector
          locale={locale}
          numItems={numItems}
          activePill={tabToPill(activeTab)}
          onPillChange={(pill) => onTabChange(pillToTab(pill))}
          t={t}
          styleKey={pickStyleKey}
          activeStyleKey={styleKey}
          onStyleKeyChange={(newKey) => setPickStyleKey(newKey)}
          controlledQtys={qtys}
          onQtysChange={setQtys}
          hidePillBar={true}
          onStyleChange={setStyleKey}
          doughConfigured={doughConfigured}
        />
      </div>

      {activeTab === 'prep' && (
        <PrepTab
          bakeTime={bakeTime}
          locale={locale}
          selectedPizzas={qtys}
          onGoToBake={() => onTabChange('bake')}
          styleKey={pickStyleKey}
        />
      )}

      {activeTab === 'bake' && (
        <BakeTab
          selectedPizzas={qtys}
          locale={locale}
          styleKey={pickStyleKey}
        />
      )}
    </div>
  );
}
