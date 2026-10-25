import { Download, Share } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { installer } from '../pwa/install';

// F:PWA-01: instalacja gry na ekranie głównym — przycisk (Android/Chrome) albo instrukcja (iOS).
export function InstallButton() {
  const instance = installer();
  const mode = useSyncExternalStore(instance.subscribe, instance.getMode);
  const [declined, setDeclined] = useState(false);

  if (mode === 'prompt') {
    return (
      <>
        <button
          type="button"
          className="secondary-button install-button"
          onClick={() => void instance.prompt().then((accepted) => setDeclined(!accepted))}
        >
          <Download size={16} aria-hidden="true" />
          Zainstaluj aplikację
        </button>
        {declined && <p className="install-hint">Możesz to zrobić później z tego menu.</p>}
      </>
    );
  }
  if (mode === 'ios') {
    return (
      <p className="install-hint">
        Zainstaluj na iPhonie: w Safari stuknij <Share size={14} aria-label="Udostępnij" />{' '}
        <b>Udostępnij</b>, potem <b>Do ekranu początkowego</b>.
      </p>
    );
  }
  return null;
}
