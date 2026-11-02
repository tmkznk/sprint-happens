import { describe, expect, it } from 'vitest';
import { holesPath, intersect } from './spotlightGeometry';

describe('geometria przyciemnienia prologu', () => {
  const box = { left: 0, top: 0, right: 100, bottom: 100 };

  it('przycina prostokąt do obszaru przewijania', () => {
    expect(intersect({ left: 50, top: 80, right: 150, bottom: 120 }, box)).toEqual({
      left: 50,
      top: 80,
      right: 100,
      bottom: 100,
    });
  });

  it('prostokąt poza obszarem nie ma części wspólnej', () => {
    expect(intersect({ left: 0, top: 100, right: 100, bottom: 150 }, box)).toBeNull();
  });

  it('bez dziurek ścieżka to cały ekran', () => {
    expect(holesPath([], 420, 860)).toBe('M0 0H420V860H0Z');
  });

  it('każda dziurka to osobny podkształt', () => {
    const hole = { left: 10, top: 10, right: 50, bottom: 30, radius: 4 };
    const path = holesPath([hole, { ...hole, top: 40, bottom: 60 }], 420, 860);
    expect(path.match(/M/g)).toHaveLength(3);
    expect(path.match(/Z/g)).toHaveLength(3);
  });

  it('zaokrąglenie nie przekracza połowy krótszego boku', () => {
    const path = holesPath([{ left: 0, top: 0, right: 100, bottom: 10, radius: 20 }], 420, 860);
    expect(path).toContain('A5 5 ');
  });
});
