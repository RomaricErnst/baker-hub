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
  onHasSelection?: (hasSelection: boolean) => void;
  bakeEventId?: string | null;
  initialQtys?: Record<string, number>;
  onQtysSnapshot?: (qtys: Record<string, number>) => void;
  getQtysRef?: React.MutableRefObject<() => Record<string, number>>;
  onGoToMyDough?: () => void;
  ovenType?: string;
  onEnsureBakeEvent?: () => Promise<string | null>;
  onShare?: () => Promise<void> | void;
  sessionSaved?: boolean;
  onBakedQtysChange?: (qtys: Record<string, number>) => void;
  recipeIngredients?: Array<{ name: string; amount: string }>;
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

export default function PizzaParty({ locale, bakeTime, numItems, styleKey: initialStyleKey, t, activeTab, onTabChange, doughConfigured, onHasSelection, bakeEventId, initialQtys, onQtysSnapshot, getQtysRef, onGoToMyDough, ovenType, onEnsureBakeEvent, onShare, sessionSaved, onBakedQtysChange, recipeIngredients }: PizzaPartyProps) {
  const [qtys, setQtys] = useState<Record<string, number>>(initialQtys ?? {});
  const [styleKey, setStyleKey] = useState<string | undefined>(initialStyleKey);
  const [pickStyleKey, setPickStyleKey] = useState<string | undefined>(initialStyleKey);

  useEffect(() => {
    setPickStyleKey(initialStyleKey);
  }, [initialStyleKey]);

  useEffect(() => {
    const total = Object.values(qtys).reduce((s, v) => s + v, 0);
    onHasSelection?.(total > 0);
  }, [qtys, onHasSelection]);

  useEffect(() => {
    onQtysSnapshot?.(qtys);
  }, [qtys, onQtysSnapshot]);

  useEffect(() => {
    if (getQtysRef) getQtysRef.current = () => qtys;
  }, [qtys, getQtysRef]);

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
          onGoToMyDough={onGoToMyDough}
          recipeIngredients={recipeIngredients}
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
          bakeEventId={bakeEventId}
          ovenType={ovenType}
          onEnsureBakeEvent={onEnsureBakeEvent}
          onShare={onShare}
          sessionSaved={sessionSaved}
          onBakedQtysChange={onBakedQtysChange}
        />
      )}
    </div>
  );
}
