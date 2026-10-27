import { Coffee } from 'lucide-react';

const SUPPORT_URL = 'https://buycoffee.to/tmkznk';

// Przycisk wsparcia autora (link zewnętrzny, nowa karta, bez dostępu do gry) — przy ekspresie
// do kawy i w oknie „O grze”.
export function SupportCoffeeLink() {
  return (
    <a
      className="primary-button support-button"
      href={SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Postaw mi kawę (otwiera się w nowej karcie)"
    >
      <Coffee size={16} aria-hidden="true" />
      Postaw mi kawę
    </a>
  );
}

// Wsparcie autora przy ekspresie do kawy.
export function SupportCoffee() {
  return (
    <aside className="support-card">
      <p className="support-title">Podoba ci się gra?</p>
      <p>Ten ekspres działa na wirtualnej kawie. Autor — na prawdziwej.</p>
      <SupportCoffeeLink />
    </aside>
  );
}
