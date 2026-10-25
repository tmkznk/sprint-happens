// F:PWA-01: instalacja gry na ekranie głównym telefonu. Chrome/Edge na Androidzie (i desktopie)
// zgłaszają `beforeinstallprompt` — zachowujemy je i pokazujemy systemowe okno na żądanie gracza.
// Safari na iOS nie ma takiego zdarzenia: instalacja tylko przez „Udostępnij → Do ekranu
// początkowego”, więc pokazujemy instrukcję.

export type InstallMode =
  // Gra uruchomiona jako zainstalowana aplikacja albo właśnie zainstalowana.
  | 'installed'
  // Przeglądarka pozwala otworzyć systemowe okno instalacji.
  | 'prompt'
  // iPhone/iPad w przeglądarce — instrukcja ręcznej instalacji.
  | 'ios'
  // Brak wsparcia (np. Firefox na desktopie) albo przeglądarka jeszcze nie zgłosiła gotowości.
  | 'unavailable';

export function installMode(env: {
  standalone: boolean;
  installed: boolean;
  canPrompt: boolean;
  userAgent: string;
  maxTouchPoints: number;
}): InstallMode {
  if (env.standalone || env.installed) return 'installed';
  if (env.canPrompt) return 'prompt';
  // iPadOS przedstawia się jako Mac — rozpoznajemy go po ekranie dotykowym.
  const ios =
    /iPhone|iPad|iPod/.test(env.userAgent) ||
    (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1);
  return ios ? 'ios' : 'unavailable';
}

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export type Installer = {
  getMode(): InstallMode;
  subscribe(listener: () => void): () => void;
  // Otwiera systemowe okno instalacji; false — okno niedostępne albo odrzucone.
  prompt(): Promise<boolean>;
};

export function createInstaller(win: Window): Installer {
  let deferred: BeforeInstallPromptEvent | null = null;
  let installed = false;
  const listeners = new Set<() => void>();
  const standaloneQuery = win.matchMedia?.('(display-mode: standalone)');
  const compute = (): InstallMode =>
    installMode({
      standalone:
        !!standaloneQuery?.matches ||
        (win.navigator as Navigator & { standalone?: boolean }).standalone === true,
      installed,
      canPrompt: deferred !== null,
      userAgent: win.navigator.userAgent,
      maxTouchPoints: win.navigator.maxTouchPoints ?? 0,
    });
  let mode = compute();
  const refresh = () => {
    const next = compute();
    if (next === mode) return;
    mode = next;
    for (const listener of listeners) listener();
  };

  win.addEventListener('beforeinstallprompt', (event) => {
    // Bez domyślnego mini-paska — instalację proponuje menu gry.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    refresh();
  });
  win.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    refresh();
  });
  standaloneQuery?.addEventListener?.('change', refresh);

  return {
    getMode: () => mode,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async prompt() {
      const event = deferred;
      if (!event) return false;
      // Zdarzenie jest jednorazowe — po użyciu przeglądarka może zgłosić nowe.
      deferred = null;
      refresh();
      await event.prompt();
      const choice = await event.userChoice;
      return choice.outcome === 'accepted';
    },
  };
}

// Jedna instancja na stronę, tworzona jak najwcześniej (przed pierwszym renderem), żeby nie
// przegapić `beforeinstallprompt`.
let instance: Installer | null = null;

export function installer(): Installer {
  instance ??= createInstaller(window);
  return instance;
}
