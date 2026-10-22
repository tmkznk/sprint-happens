import { useSyncExternalStore } from 'react';
import { pwa } from '../pwa/register';

// T:PWA-T01: „Gotowe offline” dopiero po potwierdzeniu kompletu zasobów przez service workera
// — sama możliwość instalacji niczego nie potwierdza.
export function OfflineBadge() {
  const instance = pwa();
  const status = useSyncExternalStore(instance.subscribe, instance.getStatus);
  if (!status.offlineReady) return null;
  return (
    <span className="offline-badge" title="Gra działa także bez internetu">
      Gotowe offline
    </span>
  );
}
