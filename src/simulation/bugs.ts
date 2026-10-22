import type { BalanceConfig } from '../domain/config';
import {
  POINT_SCALE,
  type Fragment,
  type Project,
  type ReadonlyProject,
  type TechSpecialization,
} from '../domain/contracts';
import { MAX_ENERGY, type Employee } from '../domain/employees';
import type { DeepReadonly } from '../domain/readonly';
import { nextRandom, type RngState } from '../domain/random';

// BUG-01 (Z), decyzje SH-004 B1 i SH-032 B1/B2: ukryte błędy powstają wyłącznie z nowej pracy
// technicznej — po ukończeniu każdego fragmentu losowanie wspólnym generatorem z ziarnem.
// Ryzyko zależy od seniority i energii wykonawców, nie od czasu ani tempa gry.

export function fragmentSize(config: BalanceConfig): number {
  return config.bugs.fragmentPoints * POINT_SCALE;
}

// Ryzyko błędu na fragment w promilach: bazowe × (1 + (1 − energia)).
export function riskPermille(employee: Employee, config: BalanceConfig): number {
  const base = config.bugs.riskPerFragment[employee.seniority];
  return Math.round(base * 1000 * (2 - employee.energy / MAX_ENERGY));
}

// Dodaje wykonaną pracę jednej specjalizacji (`added`, milionowe pp) z jej średnim ryzykiem
// i rozstrzyga każdy ukończony fragment. Fragment z pracą kilku osób dostaje ryzyko ważone
// ich udziałem (część kroku sprzed granicy fragmentu trafia do fragmentu ukończonego).
export function addWork(
  project: ReadonlyProject,
  specialization: TechSpecialization,
  added: number,
  averageRiskPermille: number,
  rng: RngState,
  config: BalanceConfig,
): { project: Project; rng: RngState } {
  const size = fragmentSize(config);
  let position = project.progress[specialization] ?? 0;
  let risk = project.fragmentRisk[specialization] ?? 0;
  let remaining = added;
  let random = rng;
  const fragments: Fragment[] = [...project.fragments];

  while (remaining > 0) {
    const boundary = (Math.floor(position / size) + 1) * size;
    const taken = Math.min(remaining, boundary - position);
    risk += taken * averageRiskPermille;
    position += taken;
    remaining -= taken;
    if (position === boundary) {
      const draw = nextRandom(random);
      random = draw.state;
      fragments.push({
        specialization,
        hasBug: draw.value * 1000 < risk / size,
        testProgress: 0,
        repairProgress: 0,
      });
      risk = 0;
    }
  }

  return {
    project: {
      ...project,
      progress: { ...project.progress, [specialization]: position },
      fragmentRisk: { ...project.fragmentRisk, [specialization]: risk },
      fragments,
    },
    rng: random,
  };
}

// BUG-05: pełny test fragmentu ujawnia jego błąd.
export function isDetected(fragment: DeepReadonly<Fragment>, config: BalanceConfig): boolean {
  return fragment.hasBug && fragment.testProgress >= fragmentSize(config);
}

export function repairSize(config: BalanceConfig): number {
  return config.bugs.repairPoints * POINT_SCALE;
}

export function isFixed(fragment: DeepReadonly<Fragment>, config: BalanceConfig): boolean {
  return fragment.hasBug && fragment.repairProgress >= repairSize(config);
}

// BUG-06: wykryte, nienaprawione błędy danej specjalizacji — indeksy fragmentów w kolejności FIFO.
export function openBugs(
  project: ReadonlyProject,
  specialization: TechSpecialization,
  config: BalanceConfig,
): number[] {
  const open: number[] = [];
  project.fragments.forEach((fragment, index) => {
    if (
      fragment.specialization === specialization &&
      isDetected(fragment, config) &&
      !isFixed(fragment, config)
    ) {
      open.push(index);
    }
  });
  return open;
}

// BUG-04: wszystkie nienaprawione błędy (ukryte i wykryte) — do oceny jakości (SH-028).
// Nigdy nie pokazywane graczowi przed oddaniem (BUG-03).
export function remainingBugCount(project: ReadonlyProject, config: BalanceConfig): number {
  return project.fragments.filter((f) => f.hasBug && !isFixed(f, config)).length;
}
