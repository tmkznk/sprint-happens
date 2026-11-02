// Geometria przyciemnienia prologu: czysta logika, bez DOM.
export type Box = { left: number; top: number; right: number; bottom: number };
export type Hole = Box & { radius: number };

export function intersect(a: Box, b: Box): Box | null {
  const box = {
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  };
  return box.left < box.right && box.top < box.bottom ? box : null;
}

// Ścieżka SVG warstwy z dziurkami (reguła evenodd): cały ekran i zaokrąglony prostokąt na każdy
// podświetlony element. Zaokrąglenie nie przekracza połowy krótszego boku.
export function holesPath(holes: readonly Hole[], width: number, height: number): string {
  const screen = `M0 0H${width}V${height}H0Z`;
  return (
    screen +
    holes
      .map(({ left, top, right, bottom, radius }) => {
        const r = Math.min(radius, (right - left) / 2, (bottom - top) / 2);
        const corner = (x: number, y: number) => `A${r} ${r} 0 0 1 ${x} ${y}`;
        return (
          `M${left + r} ${top}H${right - r}${corner(right, top + r)}` +
          `V${bottom - r}${corner(right - r, bottom)}` +
          `H${left + r}${corner(left, bottom - r)}` +
          `V${top + r}${corner(left + r, top)}Z`
        );
      })
      .join('')
  );
}
