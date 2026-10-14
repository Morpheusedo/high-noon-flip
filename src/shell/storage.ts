/**
 * The part of `Storage` the game needs. `localStorage` fits; tests pass a Map.
 * Every access is guarded: storage can be blocked (Safari private mode, a
 * third-party iframe with cookies off) or full, and the game must still run.
 */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** `localStorage`, or null where reading it throws. */
export function browserStorage(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readJson(store: KeyValueStore | null | undefined, key: string): unknown {
  try {
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function writeJson(
  store: KeyValueStore | null | undefined,
  key: string,
  value: unknown,
): void {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    // full or blocked: the value still holds for this page load
  }
}

/** A store in memory, for tests and for when the browser gives none. */
export function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}
