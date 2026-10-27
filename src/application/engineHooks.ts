import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import type { GameState } from '../domain/state';
import type { Command, CommandResult } from '../simulation/commands';
import type { Engine } from '../simulation/engine';
import { frameBatched, type Subscribe } from './frameBatch';

export const EngineContext = createContext<Engine | null>(null);

function useEngine(): Engine {
  const engine = useContext(EngineContext);
  if (!engine)
    throw new Error('Brak EngineContext — komponent musi być wewnątrz providera silnika');
  return engine;
}

// Jedna subskrypcja silnika na wszystkie komponenty, z powiadomieniami co klatkę (frameBatch).
const uiSubscriptions = new WeakMap<Engine, Subscribe>();

function uiSubscribe(engine: Engine): Subscribe {
  let subscribe = uiSubscriptions.get(engine);
  if (!subscribe) {
    subscribe = frameBatched(engine.subscribe);
    uiSubscriptions.set(engine, subscribe);
  }
  return subscribe;
}

// T:VIEW-02 — komponent subskrybuje wybrany fragment stanu. Selektor powinien zwracać
// wartość prostą lub referencję ze stanu, aby nie wymuszać renderów przy każdej zmianie.
export function useGameSelector<T>(selector: (state: GameState) => T): T {
  const engine = useEngine();
  return useSyncExternalStore(uiSubscribe(engine), () => selector(engine.getState()));
}

// Konfiguracja balansu — dla selektorów, które jej potrzebują (np. prognoza kosztów).
export function useBalanceConfig(): Engine['config'] {
  return useEngine().config;
}

// Jedyna droga zmiany stanu z UI to polecenie wysłane do silnika (T:ARCH-03).
export function useDispatch(): (command: Command) => CommandResult {
  const engine = useEngine();
  return useCallback((command) => engine.dispatch(command), [engine]);
}
