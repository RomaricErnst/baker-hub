import { useEffect, useRef, type RefObject } from 'react';
import { saveSession, type SessionData } from '../lib/session';

type SavePayload = Omit<SessionData, 'version' | 'savedAt'>;

export function hasSessionWork(data: Pick<SavePayload, 'bakeType' | 'styleKey' | 'recipeGenerated' | 'pizzaParty' | 'sandwichParty'>): boolean {
  if (!data.bakeType) return false;
  if (data.styleKey || data.recipeGenerated) return true;
  const positiveQuantity = (qty: number) => Number.isFinite(qty) && qty > 0;
  if (data.bakeType === 'pizza') return Object.values(data.pizzaParty?.qtys ?? {}).some(positiveQuantity);
  if (data.bakeType === 'bread') {
    // A family is an explicit browsing choice, unlike untouched dough defaults.
    return !!data.sandwichParty?.familyId || Object.values(data.sandwichParty?.qtys ?? {}).some(positiveQuantity);
  }
  return false;
}

export function useSessionSave(
  data: SavePayload,
  onSaved: () => void,
  debounceMs = 1200,
  // Guard: while true (e.g. during session restore/hydration), skip writes.
  // Without this, a save armed mid-restore could persist a payload mixing
  // default state (tab: 'simple') with restored state (recipeGenerated: true).
  skipRef?: RefObject<boolean>,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    // Persist explicit dough or companion choices, never an untouched landing
    // page. Recipe browsing is available before dough setup now.
    if (!hasSessionWork(data)) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (skipRef?.current) return; // restore in flight — never persist mixed state
      saveSession(dataRef.current);
      onSaved();
    }, debounceMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, Object.values(data));
}
