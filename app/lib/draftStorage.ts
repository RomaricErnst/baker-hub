/** Compare-before-write protects a resumed draft from stale tabs (including pagehide).
 * Each document keeps the exact serialized value it last read/wrote. A conflicting
 * tab must explicitly resume or replace the current draft before writing again.
 */
export function createDraftStorage(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, key: string, onConflict: () => void = () => {}) {
  let expected = storage.getItem(key);
  let conflicted = false;
  const matches = () => {
    if (storage.getItem(key) === expected) return true;
    if (!conflicted) onConflict();
    conflicted = true;
    return false;
  };
  return {
    read: () => storage.getItem(key),
    acceptCurrent: () => { expected = storage.getItem(key); conflicted = false; },
    write: (value: string) => {
      if (!matches()) return false;
      storage.setItem(key, value); expected = value; return true;
    },
    clear: () => {
      if (!matches()) return false;
      storage.removeItem(key); expected = null; return true;
    },
  };
}
