import type { Specialization } from '../domain/employees';

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

// Awatar osoby. Bez `src` — zastępczy (inicjały na tle w kolorze stanowiska); po dodaniu
// obrazków wystarczy przekazać ich adres. Dekoracyjny: imię jest obok w tekście.
export function Avatar({
  name,
  specialization,
  src,
  size = 44,
}: {
  name: string;
  specialization: Specialization;
  src?: string;
  size?: number;
}) {
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
