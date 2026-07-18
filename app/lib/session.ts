const SESSION_KEY = 'bh_session_v1';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionData {
  version: 1;
  savedAt: number;
  tab: string;
  bakeType: string | null;
  styleKey: string | null;
  numItems: number;
  itemWeight: number;
  pizzaDiameter: number;
  ovenType: string | null;
  mixerType: string | null;
  yeastType: string | null;
  kitchenTemp: number;
  humidity: string;
  fridgeTemp: number;
  flourBlend: unknown;
  prefermentType: string;
  prefermentFlourPct: number | undefined;
  prefOffsetH: number;
  manualHydration: number | undefined;
  manualOil: number | undefined;
  manualSugar: number | undefined;
  manualSalt: number | undefined;
  targetDoughTemp: number | undefined;
  flourInFridge: boolean;
  wastePct: number | undefined;
  priorityOverride: string | null | undefined;
  startTime?: number | null;
  eatTime: number | null;
  blocks: unknown[];
  recipeGenerated: boolean;
  activeTab: string;
  modeChosen: boolean;
  pizzaParty?: { qtys: Record<string, number>; bakedQtys?: Record<string, number>; shopTicks?: Record<string, boolean>; prepTicks?: string[] } | null;
  bakedDone?: boolean;
  prefGoesInFridge?: boolean;
  starterState?: string;
  starterLocation?: string;
  planningMode?: string;
  lastFedTime?: number | null;
  knownPeakTime?: number | null;
  hasNotFedYet?: boolean;
  lastFedAge?: string | null;
  feedRatio?: number;
  lastFeedRatio?: number;
  nextFeedRatio?: number;
  nextFeedRatioOverride?: number | null;
  ratioMode?: 'recommend' | 'keep';
  starterMature?: boolean;
  starterHasRye?: boolean;
  tang?: string;
  fridgeOutTime?: number | null;
  usingPeak2?: boolean;
  feed2Time?: number | null;
  starterFridgeInTime?: number | null;
  computedRecipe?: {
    flour: number;
    water: number;
    salt: number;
    oil: number;
    sugar: number;
    hydration: number;
    yeastGrams: number | null;
    coldH: number;
    rtH: number;
    hasPreferment?: boolean;
    totalIngredients?: { yeast?: number };
    timelineSteps?: Array<{ id: string; time: number; label: string }>;
  } | null;
}

export function saveSession(data: Omit<SessionData, 'version' | 'savedAt'>): void {
  try {
    const payload: SessionData = { ...data, version: 1, savedAt: Date.now() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {}
}

export function loadSession(): SessionData | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SessionData;
    if (data.version !== 1) return null;
    if (Date.now() - data.savedAt > SESSION_TTL_MS) { clearSession(); return null; }
    return data;
  } catch { return null; }
}

export function clearSession(): void {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

export function hasSession(): boolean {
  return loadSession() !== null;
}
