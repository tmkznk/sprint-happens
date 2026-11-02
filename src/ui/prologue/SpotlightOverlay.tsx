import { useEffect, useState } from 'react';
import { useNavigation } from '../navigation';
import { useGuide } from './hooks';
import { holesPath, intersect, type Box, type Hole } from './spotlightGeometry';

// Po tylu ms bez dotknięcia ekran ciemnieje; wcześniej gracz może spokojnie czytać.
const IDLE_MS = 1500;
const ACTIVITY_EVENTS = ['pointerdown', 'wheel', 'touchmove', 'keydown'] as const;

// Prolog: przyciemnia ekran poza elementem, który gracz ma dotknąć, i kartą z fabułą. Warstwa
// przepuszcza dotyk (blokady zakładek działają jak dotąd), a przy ustawianiu biurka jej nie ma —
// gracz musi widzieć biuro. Klucz montuje ją od nowa przy każdej wskazówce i zmianie zakładki.
export function SpotlightOverlay() {
  const guide = useGuide();
  const { tab } = useNavigation();
  if (!guide || guide.kind === 'placeDesk') return null;
  return <DimLayer key={`${guide.kind}:${tab}`} />;
}

function DimLayer() {
  const [idle, setIdle] = useState(false);
  const [path, setPath] = useState<string | null>(null);

  useEffect(() => {
    let timer = setTimeout(() => setIdle(true), IDLE_MS);
    const onActivity = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), IDLE_MS);
    };
    for (const type of ACTIVITY_EVENTS) {
      window.addEventListener(type, onActivity, { capture: true, passive: true });
    }
    return () => {
      clearTimeout(timer);
      for (const type of ACTIVITY_EVENTS) {
        window.removeEventListener(type, onActivity, { capture: true });
      }
    };
  }, []);

  // Pomiar tylko przy przyciemnieniu i tylko po zmianie układu, najwyżej raz na klatkę.
  useEffect(() => {
    if (!idle) return;
    let frame = 0;
    const schedule = () => {
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        setPath(measurePath());
      });
    };
    revealTarget();
    schedule();
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, { capture: true });
    };
  }, [idle]);

  return (
    <div
      className={idle && path ? 'spotlight-dim on' : 'spotlight-dim'}
      style={path ? { clipPath: `path(evenodd, "${path}")` } : undefined}
      aria-hidden="true"
    />
  );
}

// Ścieżka warstwy; null, gdy nie ma czego pokazać: podświetlenie jest pod panelem albo otwarte
// okno ma własne przyciemnienie.
function measurePath(): string | null {
  if (document.querySelector('.modal-backdrop')) return null;
  const targets = [...document.querySelectorAll('.spotlight')].flatMap((element) => {
    const hole = visibleHole(element);
    return hole ? [hole] : [];
  });
  if (targets.length === 0) return null;
  const card = document.querySelector('.prologue-card');
  const cardHole = card && visibleHole(card);
  const holes = cardHole ? [...targets, cardHole] : targets;
  return holesPath(holes, window.innerWidth, window.innerHeight);
}

// Widoczna część elementu po przycięciu do obszarów przewijania; null, gdy jest czymś zasłonięty.
function visibleHole(element: Element): Hole | null {
  const box = visibleBox(element);
  if (!box) return null;
  const hit = document.elementFromPoint((box.left + box.right) / 2, (box.top + box.bottom) / 2);
  if (!hit || !element.contains(hit)) return null;
  return { ...box, radius: parseFloat(getComputedStyle(element).borderTopLeftRadius) };
}

function visibleBox(element: Element): Box | null {
  let box: Box | null = intersect(element.getBoundingClientRect(), {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
  });
  for (let parent = element.parentElement; parent && box; parent = parent.parentElement) {
    if (getComputedStyle(parent).overflowY !== 'visible') {
      box = intersect(box, parent.getBoundingClientRect());
    }
  }
  return box;
}

// Podświetlony przycisk może być poza ekranem w długim panelu — przewija do pierwszego takiego,
// jeśli żaden nie jest widoczny.
function revealTarget(): void {
  const targets = [...document.querySelectorAll('.sheet-body .spotlight')];
  if (targets.some((element) => visibleBox(element))) return;
  targets[0]?.scrollIntoView({ block: 'nearest' });
}
