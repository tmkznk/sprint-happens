import { INTERLUDES, type InterludeId } from '../domain/content/interludes';
import { ModalLayer } from './ModalLayer';

// Przerywnik fabularny między rozdziałami (SH-048) — w stylu finału prologu. To stan interfejsu,
// nie silnika: zamknięcie gry w trakcie zostawia zapis sprzed decyzji gracza.
export function InterludeCard({ id, onDone }: { id: InterludeId; onDone(): void }) {
  const interlude = INTERLUDES[id];
  return (
    <ModalLayer>
      <div className="modal-backdrop">
        <section
          className="modal prologue-finale"
          role="dialog"
          aria-modal="true"
          aria-labelledby="interlude-title"
        >
          <p className="kicker">{interlude.kicker}</p>
          <h2 id="interlude-title">{interlude.title}</h2>
          <p className="interlude-subtitle">{interlude.subtitle}</p>
          {interlude.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <div className="modal-actions">
            <button type="button" onClick={onDone}>
              {interlude.button}
            </button>
          </div>
        </section>
      </div>
    </ModalLayer>
  );
}
