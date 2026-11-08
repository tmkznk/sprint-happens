import type { SaveManager } from './saveManager';

// Operacja asynchroniczna uruchamiana przyciskiem (przejście do rozdziału, ponowienie): drugie
// dotknięcie w trakcie nic nie robi — dwie równoległe sesje skończyłyby się konfliktem zapisu.
export type FlightGuard = { run(operation: () => Promise<void>): Promise<void> };

export function createFlightGuard(): FlightGuard {
  let running = false;
  return {
    async run(operation) {
      if (running) return;
      running = true;
      try {
        await operation();
      } finally {
        running = false;
      }
    },
  };
}

// Konflikt zapisu (inna karta zapisała grę): zgłaszany także wtedy, gdy wystąpił przed subskrypcją.
export function watchConflict(
  manager: Pick<SaveManager, 'getStatus' | 'subscribe'>,
  onConflict: () => void,
): () => void {
  if (manager.getStatus().kind === 'conflict') {
    onConflict();
    return () => undefined;
  }
  return manager.subscribe(() => {
    if (manager.getStatus().kind === 'conflict') onConflict();
  });
}
