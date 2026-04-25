'use client';
import { useState, useEffect } from 'react';
import PizzaPartyTabBar from './PizzaPartyTabBar';
import ToppingSelector from './ToppingSelector';
import PrepTab from './pizzaParty/PrepTab';
import BakeTab from './pizzaParty/BakeTab';

type Tab = 'pick' | 'shop' | 'prep' | 'bake';
type Pill = 'pizzas' | 'shopping' | 'party';

interface PizzaPartyProps {
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

export default function PizzaParty({ locale, bakeTime, numItems, styleKey: initialStyleKey, t }: PizzaPartyProps) {
  const [activeTab, setActiveTab] = useState<Tab>('pick');
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [styleKey, setStyleKey] = useState<string>(initialStyleKey);
  const [pickStyleKey, setPickStyleKey] = useState<string | undefined>(initialStyleKey);

  useEffect(() => {
    setPickStyleKey(initialStyleKey);
  }, [initialStyleKey]);

  const showSelector = activeTab === 'pick' || activeTab === 'shop';

  return (
    <div>
      <PizzaPartyTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
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
          styleKey={pickStyleKey}
          activeStyleKey={styleKey}
          onStyleKeyChange={(newKey) => setPickStyleKey(newKey)}
          controlledQtys={qtys}
          onQtysChange={setQtys}
          hidePillBar={true}
          onStyleChange={setStyleKey}
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
