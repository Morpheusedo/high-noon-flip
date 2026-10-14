import { useEffect, useState } from 'preact/hooks';
import type { Store } from './store';

/** The store's current state; the component re-renders whenever it changes. */
export function useStore<T>(store: Store<T>): T {
  const [state, setState] = useState(store.get());
  useEffect(() => {
    setState(store.get());
    return store.subscribe(setState);
  }, [store]);
  return state;
}
