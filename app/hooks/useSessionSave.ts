import { useEffect, useRef, type RefObject } from 'react';
import { saveSession, type SessionData } from '../lib/session';

type SavePayload = Omit<SessionData, 'version' | 'savedAt'>;

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
    // Nothing is written until the baker has actually chosen something. This
    // is what keeps autosave from manufacturing a history: no bake type and no
    // style means there is nothing to resume, and a session written at that
    // point would be indistinguishable from a completed setup on the next
    // launch. Load-bearing — do not relax it to "save early, filter later".
    if (!data.bakeType) return;
    if (!data.styleKey && !data.recipeGenerated) return;
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
