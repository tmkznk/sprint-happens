import { describe, expect, it, vi } from 'vitest';
import { createTabCoordinator, type TabEnvironment, type TabMessage } from './tabCoordinator';

// Wspólna „przeglądarka” dla kilku kart: jedna blokada i kanał rozgłoszeniowy.
function fakeBrowser() {
  let holder: { onLost: () => void } | null = null;
  const tabs = new Set<(message: TabMessage) => void>();

  function tab(): TabEnvironment {
    const own = new Set<(message: TabMessage) => void>();
    return {
      acquire({ steal }, onLost) {
        if (holder && !steal) return Promise.resolve(null);
        if (holder) holder.onLost();
        const entry = { onLost };
        holder = entry;
        return Promise.resolve({
          release: () => {
            if (holder === entry) holder = null;
          },
        });
      },
      post(message) {
        // Kanał nie dostarcza wiadomości nadawcy.
        for (const listener of tabs) if (!own.has(listener)) listener(message);
      },
      subscribe(listener) {
        own.add(listener);
        tabs.add(listener);
        return () => {
          own.delete(listener);
          tabs.delete(listener);
        };
      },
      close: () => undefined,
    };
  }
  return { tab, isLocked: () => holder !== null };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createTabCoordinator', () => {
  it('pierwsza karta zapisuje, druga widzi grę otwartą gdzie indziej', async () => {
    const browser = fakeBrowser();
    const handlers = { onYield: () => Promise.resolve(), onLost: vi.fn() };
    const first = createTabCoordinator(browser.tab(), handlers);
    const second = createTabCoordinator(browser.tab(), handlers);

    expect(await first.start()).toBe('writer');
    expect(await second.start()).toBe('otherTabActive');
  });

  it('przejęcie: pierwsza karta zapisuje i pauzuje przed oddaniem blokady', async () => {
    const browser = fakeBrowser();
    const order: string[] = [];
    const first = createTabCoordinator(browser.tab(), {
      onYield: async () => {
        order.push('pierwsza: zapis i pauza');
        await flush();
      },
      onLost: () => order.push('pierwsza: utrata bez uprzedzenia'),
    });
    const second = createTabCoordinator(browser.tab(), {
      onYield: () => Promise.resolve(),
      onLost: vi.fn(),
    });
    await first.start();
    await second.start();

    await second.takeOver();
    order.push('druga: przejęła');

    expect(order).toEqual(['pierwsza: zapis i pauza', 'druga: przejęła']);
    expect(browser.isLocked()).toBe(true);
  });

  it('gdy pierwsza karta nie odpowiada, druga przejmuje po limicie czasu', async () => {
    const browser = fakeBrowser();
    const onLost = vi.fn();
    const frozen = createTabCoordinator(browser.tab(), {
      onYield: () => new Promise(() => undefined),
      onLost,
    });
    const second = createTabCoordinator(
      browser.tab(),
      { onYield: () => Promise.resolve(), onLost: vi.fn() },
      { wait: () => Promise.resolve() },
    );
    await frozen.start();

    await second.takeOver();

    expect(browser.isLocked()).toBe(true);
    // Pierwsza karta była w trakcie oddawania — nie zgłasza nieoczekiwanej utraty.
    expect(onLost).not.toHaveBeenCalled();
  });

  it('odebranie blokady bez prośby zgłasza utratę prawa zapisu', async () => {
    const browser = fakeBrowser();
    const onLost = vi.fn();
    const first = createTabCoordinator(browser.tab(), { onYield: () => Promise.resolve(), onLost });
    await first.start();

    await browser.tab().acquire({ steal: true }, vi.fn());

    expect(onLost).toHaveBeenCalledOnce();
  });

  it('zamknięcie zwalnia blokadę', async () => {
    const browser = fakeBrowser();
    const first = createTabCoordinator(browser.tab(), {
      onYield: () => Promise.resolve(),
      onLost: vi.fn(),
    });
    await first.start();

    first.dispose();

    expect(browser.isLocked()).toBe(false);
  });
});
