import type { BalanceConfig } from '../domain/config';
import {
  MILLI_POINTS,
  TECH_SPECIALIZATIONS,
  type Project,
  type TechSpecialization,
} from '../domain/contracts';
import type { Employee } from '../domain/employees';
import type { GameState } from '../domain/state';
import { interactionCells } from '../world/geometry';
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
  return scope * MILLI_POINTS - (project.progress[specialization] ?? 0);
}

// EMP-02, SH-032 B1: wydajność na jeden krok symulacji w tysięcznych pp. Energia (SH-017)
// i premia PM-a (SH-025) dołączą jako mnożniki.
export function workPerStep(employee: Employee, config: BalanceConfig): number {
  const stepsPerDay = DAY_LENGTH_MS / config.simulation.stepMs;
  return Math.floor(
    (config.staff.workPointsPerDay[employee.seniority] * MILLI_POINTS) / stepsPerDay,
  );
}

// PROJ-02, EMP-06 (Z): specjalizacje pracują równolegle i bez zależności ticketów; wydajność
// kilku osób tej samej roli sumuje się, ale nie przekracza zakresu.
export function doWork(state: GameState, config: BalanceConfig): GameState {
  const contributions = new Map<string, number>();
  for (const employee of Object.values(state.staff.employees)) {
    const { specialization, projectId } = employee;
    if (!projectId || !isTechSpecialization(specialization)) continue;
    const project = state.contracts.projects[projectId];
    if (project?.status !== 'active' || remainingPoints(project, specialization) <= 0) continue;
    if (!isAtOwnDesk(state, employee)) continue;
    const key = `${projectId}|${specialization}`;
    contributions.set(key, (contributions.get(key) ?? 0) + workPerStep(employee, config));
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
  return { ...state, contracts: { ...state.contracts, projects } };
}

// PROJ-09: procent ukończenia zakresu roli (zaokrąglony w dół — 100% tylko po faktycznym końcu).
export function progressPercent(project: Project, specialization: TechSpecialization): number {
  const scope = project.scopes[specialization];
  if (!scope) return 0;
  return Math.floor(((project.progress[specialization] ?? 0) * 100) / (scope * MILLI_POINTS));
}
