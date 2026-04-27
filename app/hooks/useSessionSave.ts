import { useEffect, useRef } from 'react';
import { saveSession, type SessionData } from '../lib/session';

type SavePayload = Omit<SessionData, 'version' | 'savedAt'>;

export function useSessionSave(
  data: SavePayload,
  onSaved: () => void,
  debounceMs = 1200,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    if (!data.bakeType) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveSession(dataRef.current);
      onSaved();
    }, debounceMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, Object.values(data));
}
