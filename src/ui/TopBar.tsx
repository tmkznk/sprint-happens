import { Settings } from 'lucide-react';
import { useState } from 'react';
import { useGameSelector } from '../application/engineHooks';
import type { SaveManager } from '../application/saveManager';
import { money } from './labels';
import { NewGameButton } from './NewGameButton';
import { OfflineBadge } from './OfflineBadge';
import { SaveIndicator } from './SaveIndicator';

// SH-033 (wzór SH2): logo, budżet i reputacja (REP-01) zawsze widoczne; ustawienia z nową grą,
// stanem zapisu i gotowością offline.
export function TopBar({ manager, onNewGame }: { manager: SaveManager; onNewGame(): void }) {
  const cash = useGameSelector((state) => state.finance.cash);
  const reputation = useGameSelector((state) => state.mission.reputation);
  const [menu, setMenu] = useState(false);

  return (
    <header className="top-bar">
      <div className="logo" aria-label="Sprint Happens!">
        <span className="logo-badge" aria-hidden="true">
          S!
        </span>
        <span className="logo-text">
          SPRINT
          <small>HAPPENS!</small>
        </span>
      </div>
      <div className="tagline">
        <p className="kicker">Twój software house</p>
        <span>Małe biuro. Wielkie ambicje.</span>
      </div>
      <div className="top-stats">
        <SaveIndicator manager={manager} errorsOnly />
        <div className="stat">
          <span>Budżet firmy</span>
          <strong className={cash < 0 ? 'negative' : undefined}>{money.format(cash)} zł</strong>
        </div>
        <div className="stat">
          <span>Reputacja</span>
          <strong>
            {reputation}
            <small>/100</small>
          </strong>
        </div>
        <div className="settings">
          <button
            type="button"
            className="icon-button"
            aria-label="Ustawienia"
            aria-expanded={menu}
            onClick={() => setMenu((value) => !value)}
          >
            <Settings size={22} />
          </button>
          {menu && (
            <div className="settings-menu">
              <SaveIndicator manager={manager} />
              <OfflineBadge />
              <NewGameButton
                onConfirm={() => {
                  setMenu(false);
                  onNewGame();
                }}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
