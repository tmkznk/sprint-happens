import { CHAPTER_TWO_ENABLED } from '../../application/features';
import { RULES_INTRO, rulesSections } from '../rulesCopy';

// Zakładka „Zasady gry”: FAQ w grupach; odpowiedzi rozwijane natywnym <details> (bez stanu i JS).
// Treść statyczna — widok nie subskrybuje silnika.
export function RulesView() {
  return (
    <div className="rules">
      <p className="hint">{RULES_INTRO}</p>
      {rulesSections(CHAPTER_TWO_ENABLED).map((section) => (
        <section key={section.title} className="rules-section">
          <h3>{section.title}</h3>
          {section.questions.map((item) => (
            <details key={item.question} className="rules-item">
              <summary>{item.question}</summary>
              {item.answer.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </details>
          ))}
        </section>
      ))}
    </div>
  );
}
