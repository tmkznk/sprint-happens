import { ExternalLink, Info } from 'lucide-react';
import { useState } from 'react';
import { ModalLayer } from './ModalLayer';
import { SupportCoffeeLink } from './SupportCoffee';

// Autor gry (okno „O grze” w ustawieniach).
const AUTHOR = {
  name: 'Tomasz Zienkowicz',
  nick: 'tmkznk',
  links: [{ label: 'tmkznk.dev', href: 'https://tmkznk.dev' }],
};

export function AboutButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="secondary-button" onClick={() => setOpen(true)}>
        <Info size={16} aria-hidden="true" /> O grze
      </button>
      {open && <AboutDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function AboutDialog({ onClose }: { onClose(): void }) {
  return (
    <ModalLayer>
      <div className="modal-backdrop">
        <section
          className="modal about"
          role="dialog"
          aria-modal="true"
          aria-labelledby="about-title"
        >
          <h2 id="about-title">O grze</h2>
          <p>
            <b>Sprint Happens!</b> · wersja {__APP_VERSION__}
          </p>
          <p>
            Autor: {AUTHOR.name} ({AUTHOR.nick})
          </p>
          <ul className="about-links">
            {AUTHOR.links
              .filter((link) => link.href)
              .map((link) => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer">
                    {link.label} <ExternalLink size={13} aria-hidden="true" />
                  </a>
                </li>
              ))}
          </ul>
          <div className="modal-actions about-actions">
            <SupportCoffeeLink />
            <button type="button" className="secondary-button" onClick={onClose}>
              Zamknij
            </button>
          </div>
        </section>
      </div>
    </ModalLayer>
  );
}
