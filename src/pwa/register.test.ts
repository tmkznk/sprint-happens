import { describe, expect, it, vi } from 'vitest';
import type { WorkerRequest } from './precache';
import { createPwa } from './register';

class FakeWorker extends EventTarget {
  state = 'activated';
  sent: WorkerRequest[] = [];
  postMessage(message: WorkerRequest) {
    this.sent.push(message);
  }
}

function fakeContainer(options: { controlled: boolean; waiting?: FakeWorker }) {
  const active = new FakeWorker();
  const registration = Object.assign(new EventTarget(), {
    active,
    installing: null,
    waiting: options.waiting ?? null,
    update: () => Promise.resolve(),
  });
  const container = Object.assign(new EventTarget(), {
    controller: options.controlled ? active : null,
    register: vi.fn(() => Promise.resolve(registration)),
  });
  const reply = (ready: boolean) =>
    container.dispatchEvent(
      new MessageEvent('message', { data: { type: 'status', version: 'v', ready, missing: 0 } }),
    );
  return { container: container as unknown as ServiceWorkerContainer, active, reply };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('rejestracja PWA (PWA-T01, PWA-T02)', () => {
  it('„gotowe offline” dopiero po potwierdzeniu kompletu przez workera', async () => {
    vi.useFakeTimers({ toFake: ['setInterval'] });
    const { container, active, reply } = fakeContainer({ controlled: true });
    const pwa = createPwa(container, '/sw.js');
    await flush();
    expect(active.sent).toEqual([{ type: 'status' }]);
    expect(pwa.getStatus().offlineReady).toBe(false);

    reply(false);
    expect(pwa.getStatus().offlineReady).toBe(false);
    reply(true);
    expect(pwa.getStatus().offlineReady).toBe(true);
    vi.useRealTimers();
  });

  it('oczekująca wersja nie przejmuje gry sama; przejmuje ją tylko applyUpdate', async () => {
    vi.useFakeTimers({ toFake: ['setInterval'] });
    const waiting = new FakeWorker();
    const { container } = fakeContainer({ controlled: true, waiting });
    const pwa = createPwa(container, '/sw.js');
    await flush();
    expect(pwa.getStatus().updateWaiting).toBe(true);
    expect(waiting.sent).toEqual([]);

    expect(pwa.applyUpdate()).toBe(true);
    expect(waiting.sent).toEqual([{ type: 'skipWaiting' }]);
    vi.useRealTimers();
  });

  it('bez obsługi service workera — brak gotowości i brak aktualizacji', () => {
    const pwa = createPwa(undefined, '/sw.js');
    expect(pwa.getStatus()).toEqual({
      supported: false,
      offlineReady: false,
      updateWaiting: false,
    });
    expect(pwa.applyUpdate()).toBe(false);
  });
});
