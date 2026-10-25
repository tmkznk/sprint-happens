import type { PersonId } from '../domain/content/people';
import type { Specialization } from '../domain/employees';

// Portrety postaci: plik `src/assets/avatars/<id postaci>.png` (lub .webp/.jpg) jest podpinany
// automatycznie — trafia do paczki z haszem w nazwie i do cache'u offline. Bez pliku awatar
// jest zastępczy.
const PORTRAITS: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../assets/avatars/*.{png,webp,jpg}', {
      eager: true,
      query: '?url',
      import: 'default',
    }),
  ).map(([path, url]) => [path.replace(/^.*\/(.+)\.\w+$/, '$1'), url]),
);

// Kolor tła zastępczego awatara według stanowiska (paleta zgodna z motywem).
const ROLE_COLORS: Record<Specialization, { background: string; color: string }> = {
  frontend: { background: '#f6e7c4', color: '#7a5410' },
  backend: { background: '#dbe7f0', color: '#2c4f6b' },
  mobile: { background: '#e6dff0', color: '#4f3d6b' },
  devops: { background: '#dfece2', color: '#2f5a3c' },
  qa: { background: '#f3dfd9', color: '#7a3a2c' },
  designer: { background: '#f2e0ea', color: '#6b2c4f' },
  pm: { background: '#e8e6dc', color: '#4a4636' },
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

// Awatar postaci: portret albo zastępczy (inicjały na tle w kolorze stanowiska).
// Dekoracyjny: imię jest obok w tekście.
export function Avatar({
  person: { personId, name, specialization },
  size = 44,
}: {
  person: { personId: PersonId; name: string; specialization: Specialization };
  size?: number;
}) {
  const src = PORTRAITS[personId];
  const style = { width: size, height: size, ...ROLE_COLORS[specialization] };
  if (src) {
    return <img className="avatar" src={src} alt="" width={size} height={size} style={style} />;
  }
  return (
    <span className="avatar" style={style} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
