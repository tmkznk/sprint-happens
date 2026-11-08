import { useState } from 'react';
import { useBalanceConfig, useDispatch, useGameSelector } from '../application/engineHooks';
import { retroCardById } from '../domain/content/retroCards';
import type { RetroCardId } from '../domain/scrum';
import { ModalLayer } from './ModalLayer';
import { REJECTION_MESSAGES } from './rejectionMessages';
import { cardSummary } from './sprintDisplay';

// SH-056, SH-058: retrospektywa — jedna karta z trzech; przy pełnym limicie wybór karty do
// zastąpienia; „Pomiń” zamyka retro bez zmian. Selektory zwracają klucze tekstowe.
export function RetroDialog() {
  const config = useBalanceConfig();
  const dispatch = useDispatch();
  const offered = useGameSelector((state) => state.scrum?.pendingRetro?.offered.join(',') ?? '');
  const active = useGameSelector((state) => state.scrum?.cards.join(',') ?? '');
  const [chosen, setChosen] = useState<RetroCardId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (!offered) return null;

  const offeredIds = offered.split(',') as RetroCardId[];
  const activeIds = active ? (active.split(',') as RetroCardId[]) : [];
  const full = activeIds.length >= config.scrum.cardLimit;

  const submit = (cardId: RetroCardId | null, replace: RetroCardId | null) => {
    const result = dispatch({ type: 'ChooseRetroCard', cardId, replace });
    if (!result.ok) {
      setMessage(REJECTION_MESSAGES[result.rejection.code]);
      return;
    }
    setChosen(null);
    setMessage(null);
    dispatch({ type: 'SetSpeed', speed: 1 });
  };
  const pick = (cardId: RetroCardId) => (full ? setChosen(cardId) : submit(cardId, null));

  return (
    <ModalLayer>
      <div className="modal-backdrop">
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="retro-title">
          <p className="kicker">Retrospektywa</p>
          <h2 id="retro-title">{chosen ? 'Co zastąpić?' : 'Jedno usprawnienie'}</h2>
          <p>
            {chosen
              ? `Firma ma już ${config.scrum.cardLimit} usprawnienia. Wybierz, z którego rezygnujecie.`
              : 'Zespół zgłosił pomysły. Wybierz jeden — będzie obowiązywał do odwołania.'}
          </p>
          <div className="event-options">
            {(chosen ? activeIds : offeredIds).map((id) => {
              const card = retroCardById(id);
              if (!card) return null;
              return (
                <button
                  key={id}
                  type="button"
                  className="event-option"
                  onClick={() => (chosen ? submit(chosen, id) : pick(id))}
                >
                  <strong>{card.title}</strong>
                  <span>{card.text}</span>
                  <span>{cardSummary(card)}</span>
                </button>
              );
            })}
          </div>
          <div className="modal-actions">
            {chosen ? (
              <button type="button" className="secondary-button" onClick={() => setChosen(null)}>
                Wróć
              </button>
            ) : (
              <button type="button" className="secondary-button" onClick={() => submit(null, null)}>
                Pomiń
              </button>
            )}
          </div>
          {message && <p className="warning">{message}</p>}
        </section>
      </div>
    </ModalLayer>
  );
}
