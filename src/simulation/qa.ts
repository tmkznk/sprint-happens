import type { BalanceConfig } from '../domain/config';
import { POINT_SCALE, TECH_SPECIALIZATIONS, type ReadonlyProject } from '../domain/contracts';
import type { Employee } from '../domain/employees';
import type { GameState } from '../domain/state';
import { fragmentSize, isDetected, isFixed } from './bugs';
import { drainEnergy, energyFactor, isOnBreak } from './needs';
import { compareIds } from './staff';
import { DAY_LENGTH_MS } from './time';
import { isAtOwnDesk } from './work';

// BUG-03, BUG-05, PROJ-04 (Z), decyzje SH-004 B2 i SH-032 B6: QA testuje wykonaną pracę.
// Kolejka projektu to fragmenty w kolejności ukończenia (bez względu na specjalizację).
// Testerzy (według ID) rezerwują kolejne nieprzetestowane fragmenty — nie dublują pracy;
// nadwyżka wydajności z ukończonego testu przechodzi na następny wolny fragment.
// Postęp testu zostaje przy fragmencie, więc zmiana testera niczego nie traci.

// Tester gotowy do testów: przypisany do aktywnego projektu, przy własnym biurku,
// nie na przerwie i z energią > 0 (NEED-01).
function isReadyTester(state: GameState, employee: Employee): boolean {
  if (employee.specialization !== 'qa' || !employee.projectId || employee.energy <= 0) return false;
  const project = state.contracts.projects[employee.projectId];
  if (project?.status !== 'active') return false;
  return isAtOwnDesk(state, employee) && !isOnBreak(state, employee);
}

// Indeksy fragmentów czekających na test, w kolejności kolejki FIFO.
export function testQueue(project: ReadonlyProject, config: BalanceConfig): number[] {
  const size = fragmentSize(config);
  const queue: number[] = [];
  project.fragments.forEach((fragment, index) => {
    if (fragment.testProgress < size) queue.push(index);
  });
  return queue;
}

function readyTesters(state: GameState, projectId: string): Employee[] {
  return Object.values(state.staff.employees)
    .filter((e) => e.projectId === projectId && isReadyTester(state, e))
    .sort((a, b) => compareIds(a.id, b.id));
}

// Tester faktycznie testuje, gdy dostał fragment z kolejki (nadmiarowi czekają na pracę).
export function isTesting(state: GameState, employee: Employee, config: BalanceConfig): boolean {
  if (!employee.projectId || !isReadyTester(state, employee)) return false;
  const project = state.contracts.projects[employee.projectId];
  if (!project) return false;
  const rank = readyTesters(state, employee.projectId).findIndex((e) => e.id === employee.id);
  return rank < testQueue(project, config).length;
}

// SH-032 B6: tempo testów na krok w milionowych pp (× energia jak praca — SH-032 B2).
export function testPerStep(employee: Employee, config: BalanceConfig): number {
  const stepsPerDay = DAY_LENGTH_MS / config.simulation.stepMs;
  const base = Math.floor(
    (config.bugs.testPointsPerDay[employee.seniority] * POINT_SCALE) / stepsPerDay,
  );
  return Math.floor(base * energyFactor(employee));
}

export function doTesting(state: GameState, config: BalanceConfig): GameState {
  const size = fragmentSize(config);
  let projects = state.contracts.projects;
  let employees = state.staff.employees;
  const projectIds = Object.keys(projects).sort(compareIds) as (keyof typeof projects)[];

  for (const projectId of projectIds) {
    const project = projects[projectId];
    if (!project || project.status !== 'active') continue;
    const queue = testQueue(project, config);
    const testers = readyTesters(state, projectId).slice(0, queue.length);
    if (testers.length === 0) continue;

    const progress = project.fragments.map((f) => f.testProgress);
    // Tester k zaczyna od k-tego fragmentu kolejki; kolejne wolne fragmenty — od `nextFree`.
    let nextFree = testers.length;
    testers.forEach((tester, k) => {
      let amount = testPerStep(tester, config);
      let index: number | undefined = queue[k];
      while (amount > 0 && index !== undefined) {
        const taken = Math.min(amount, size - (progress[index] ?? 0));
        progress[index] = (progress[index] ?? 0) + taken;
        amount -= taken;
        if ((progress[index] ?? 0) >= size) index = queue[nextFree++];
      }
      // NEED-01: energia maleje podczas faktycznej pracy, także testów.
      employees = { ...employees, [tester.id]: drainEnergy(tester, config) };
    });

    const fragments = project.fragments.map((fragment, i) => {
      const testProgress = progress[i] ?? fragment.testProgress;
      return testProgress === fragment.testProgress ? fragment : { ...fragment, testProgress };
    });
    projects = { ...projects, [projectId]: { ...project, fragments } };
  }

  if (projects === state.contracts.projects) return state;
  return {
    ...state,
    staff: { ...state.staff, employees },
    contracts: { ...state.contracts, projects },
  };
}

// BUG-03 (Z): liczba wykrytych, nienaprawionych błędów — jedyna liczba błędów widoczna przed oddaniem.
export function detectedBugCount(project: ReadonlyProject, config: BalanceConfig): number {
  return project.fragments.filter((f) => isDetected(f, config) && !isFixed(f, config)).length;
}

// BUG-05, BUG-06: pokrycie testami w procentach wykonanej pracy technicznej (w dół).
// Bez wykonanej pracy — `null`: interfejs nie może sugerować potwierdzonej jakości.
export function testCoverage(project: ReadonlyProject, config: BalanceConfig): number | null {
  const size = fragmentSize(config);
  const done = TECH_SPECIALIZATIONS.reduce((sum, s) => sum + (project.progress[s] ?? 0), 0);
  if (done === 0) return null;
  const tested = project.fragments.filter((f) => f.testProgress >= size).length * size;
  return Math.floor((tested * 100) / done);
}
