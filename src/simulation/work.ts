import type { BalanceConfig } from '../domain/config';
import {
  POINT_SCALE,
  TECH_SPECIALIZATIONS,
  type Project,
  type TechSpecialization,
} from '../domain/contracts';
import type { Employee } from '../domain/employees';
import type { GameState } from '../domain/state';
import { interactionCells } from '../world/geometry';
import { drainEnergy, energyFactor, isOnBreak } from './needs';
import { DAY_LENGTH_MS } from './time';

// PROJ-09 (Z): praca aktywna — osoba siedzi w punkcie korzystania z własnego biurka (nie w ruchu),
// ma aktywny przydział i niedokończony zakres swojej roli. Ruch, przerwa i brak biurka nie dają
// punktów. Animacja nie kończy czynności — liczy się wyłącznie stan silnika (T:VIEW-01).
export function isAtOwnDesk(state: GameState, employee: Employee): boolean {
  const desk = employee.deskId ? state.world.furniture[employee.deskId] : undefined;
  const point = desk ? interactionCells(desk)[0] : undefined;
  const agent = state.world.movement.agents.find((a) => a.id === employee.id);
  return !!point && !!agent && !agent.move && agent.cell.x === point.x && agent.cell.y === point.y;
}

export function isTechSpecialization(value: string): value is TechSpecialization {
  return (TECH_SPECIALIZATIONS as readonly string[]).includes(value);
}

export function remainingPoints(project: Project, specialization: TechSpecialization): number {
  const scope = project.scopes[specialization];
  if (scope === undefined) return 0;
  return scope * POINT_SCALE - (project.progress[specialization] ?? 0);
}

// EMP-02, SH-032 B1: wydajność bazowa na jeden krok symulacji w milionowych pp (pełna energia).
export function workPerStep(employee: Employee, config: BalanceConfig): number {
  const stepsPerDay = DAY_LENGTH_MS / config.simulation.stepMs;
  return Math.floor(
    (config.staff.workPointsPerDay[employee.seniority] * POINT_SCALE) / stepsPerDay,
  );
}

// NEED-01, SH-032 B2: wydajność rzeczywista z uwzględnieniem energii (przy zerze — 0).
// Premia PM-a (SH-025) dołączy jako kolejny mnożnik.
export function effectiveWorkPerStep(employee: Employee, config: BalanceConfig): number {
  return Math.floor(workPerStep(employee, config) * energyFactor(employee));
}

// PROJ-02, EMP-06 (Z): specjalizacje pracują równolegle i bez zależności ticketów; wydajność
// kilku osób tej samej roli sumuje się, ale nie przekracza zakresu.
export function doWork(state: GameState, config: BalanceConfig): GameState {
  const contributions = new Map<string, number>();
  const employees = { ...state.staff.employees };
  for (const employee of Object.values(state.staff.employees)) {
    if (!isWorking(state, employee)) continue;
    const { specialization, projectId } = employee;
    if (!projectId || !isTechSpecialization(specialization)) continue;
    const key = `${projectId}|${specialization}`;
    contributions.set(key, (contributions.get(key) ?? 0) + effectiveWorkPerStep(employee, config));
    // NEED-01: energia maleje wyłącznie podczas faktycznej pracy.
    employees[employee.id] = drainEnergy(employee, config);
  }
  if (contributions.size === 0) return state;

  const projects = { ...state.contracts.projects };
  for (const [key, amount] of contributions) {
    const [projectId, specialization] = key.split('|') as [
      keyof typeof projects,
      TechSpecialization,
    ];
    const project = projects[projectId];
    if (!project) continue;
    const added = Math.min(amount, remainingPoints(project, specialization));
    projects[projectId] = {
      ...project,
      progress: {
        ...project.progress,
        [specialization]: (project.progress[specialization] ?? 0) + added,
      },
    };
  }
  return {
    ...state,
    staff: { ...state.staff, employees },
    contracts: { ...state.contracts, projects },
  };
}

// Praca aktywna: przy własnym biurku, z przydziałem i niedokończonym zakresem roli, nie na przerwie
// i z energią > 0 (NEED-01: przy zerze praca stoi i nie powstają błędy).
export function isWorking(state: GameState, employee: Employee): boolean {
  const { specialization, projectId } = employee;
  if (!projectId || !isTechSpecialization(specialization) || employee.energy <= 0) return false;
  const project = state.contracts.projects[projectId];
  if (project?.status !== 'active' || remainingPoints(project, specialization) <= 0) return false;
  return isAtOwnDesk(state, employee) && !isOnBreak(state, employee);
}

// PROJ-09: procent ukończenia zakresu roli (zaokrąglony w dół — 100% tylko po faktycznym końcu).
export function progressPercent(project: Project, specialization: TechSpecialization): number {
  const scope = project.scopes[specialization];
  if (!scope) return 0;
  return Math.floor(((project.progress[specialization] ?? 0) * 100) / (scope * POINT_SCALE));
}
