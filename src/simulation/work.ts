import type { BalanceConfig } from '../domain/config';
import {
  POINT_SCALE,
  TECH_SPECIALIZATIONS,
  type ProjectId,
  type ReadonlyProject,
  type TechSpecialization,
} from '../domain/contracts';
import type { Employee, EmployeeId } from '../domain/employees';
import type { GameState } from '../domain/state';
import { interactionCells } from '../world/geometry';
import { addWork, openBugs, repairSize, riskPermille } from './bugs';
import { isInMeeting } from './events';
import { drainEnergy, energyFactor, isOnBreak } from './needs';
import { compareIds } from './staff';
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

export function remainingPoints(
  project: ReadonlyProject,
  specialization: TechSpecialization,
): number {
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

// NEED-01, SH-032 B2: wydajność rzeczywista z uwzględnieniem energii (przy zerze — 0)
// i premii PM-a projektu w promilach (PROJ-11).
export function effectiveWorkPerStep(
  employee: Employee,
  config: BalanceConfig,
  bonusPermille = 0,
): number {
  return applyBonus(
    Math.floor(workPerStep(employee, config) * energyFactor(employee)),
    bonusPermille,
  );
}

export function applyBonus(amount: number, bonusPermille: number): number {
  return Math.floor((amount * (1000 + bonusPermille)) / 1000);
}

// PROJ-11 (Z): premia wymaga aktywnego przydziału PM-a i przypisanego biurka, nie obecności
// przy nim — działa na przerwie i przy zerowej energii. Zależy tylko od seniority; drugi PM
// (niedozwolony poleceniem) nie kumuluje premii — liczy się najwyższa.
export function pmBonusPermille(
  state: GameState,
  projectId: ProjectId,
  config: BalanceConfig,
): number {
  if (state.contracts.projects[projectId]?.status !== 'active') return 0;
  let best = 0;
  for (const employee of Object.values(state.staff.employees)) {
    if (employee.specialization !== 'pm' || employee.projectId !== projectId || !employee.deskId) {
      continue;
    }
    best = Math.max(best, Math.round(config.contracts.pmBonus[employee.seniority] * 1000));
  }
  return best;
}

// PROJ-10 (Z): pozostały zakres designu projektu.
export function remainingDesign(project: ReadonlyProject): number {
  return project.designScope * POINT_SCALE - project.designProgress;
}

// Zadanie w bieżącym kroku: nowa funkcja, naprawa konkretnego błędu, design albo koordynacja PM-a.
export type WorkTask =
  | { kind: 'feature' }
  | { kind: 'repair'; fragment: number }
  | { kind: 'design' }
  | { kind: 'coordinate' };
export type WorkPlan = ReadonlyMap<EmployeeId, WorkTask>;

// Developer gotowy do pracy: przy własnym biurku, z przydziałem do aktywnego projektu, który ma
// zakres jego roli, nie na przerwie i z energią > 0 (NEED-01: przy zerze praca stoi).
function isReadyDeveloper(state: GameState, employee: Employee): boolean {
  const { specialization, projectId } = employee;
  if (!projectId || !isTechSpecialization(specialization)) return false;
  const project = state.contracts.projects[projectId];
  return project?.scopes[specialization] !== undefined && isPresentAtWork(state, employee);
}

// Przy własnym biurku, z przydziałem do aktywnego projektu, nie na przerwie, z energią > 0.
function isPresentAtWork(state: GameState, employee: Employee): boolean {
  if (!employee.projectId || employee.energy <= 0 || isInMeeting(state)) return false;
  if (state.contracts.projects[employee.projectId]?.status !== 'active') return false;
  return isAtOwnDesk(state, employee) && !isOnBreak(state, employee);
}

// Decyzje SH-004 B3/B4 i właściciela z 2026-10-22 (zastępuje przełącznik priorytetu PROJ-05):
// plan liczony raz na początku fazy pracy kroku. Developer najpierw realizuje zakres swojej
// roli, a po jego ukończeniu sam naprawia wykryte błędy własnej specjalizacji — kolejni
// developerzy (według ID) dostają kolejne błędy, jeden błąd ma najwyżej jednego naprawiającego.
export function planWork(state: GameState, config: BalanceConfig): WorkPlan {
  const groups = new Map<string, Employee[]>();
  for (const employee of Object.values(state.staff.employees)) {
    if (!isReadyDeveloper(state, employee)) continue;
    const key = `${employee.projectId}|${employee.specialization}`;
    groups.set(key, [...(groups.get(key) ?? []), employee]);
  }
  const plan = new Map<EmployeeId, WorkTask>();
  for (const employee of Object.values(state.staff.employees)) {
    const project = employee.projectId ? state.contracts.projects[employee.projectId] : undefined;
    if (!project || !isPresentAtWork(state, employee)) continue;
    // PROJ-10: Designer pracuje równolegle, także po ukończeniu techniki — do oddania.
    if (employee.specialization === 'designer' && remainingDesign(project) > 0) {
      plan.set(employee.id, { kind: 'design' });
    }
    // PROJ-11: PM nie ma własnego zakresu; przy biurku koordynuje (zużywa energię jak praca).
    if (employee.specialization === 'pm') plan.set(employee.id, { kind: 'coordinate' });
  }
  for (const [key, members] of groups) {
    const [projectId, specialization] = key.split('|') as [ProjectId, TechSpecialization];
    const project = state.contracts.projects[projectId];
    if (!project) continue;
    const bugs = openBugs(project, specialization, config);
    const featuresLeft = remainingPoints(project, specialization) > 0;
    const repairers = featuresLeft ? 0 : Math.min(members.length, bugs.length);
    [...members]
      .sort((a, b) => compareIds(a.id, b.id))
      .forEach((employee, k) => {
        const fragment = bugs[k];
        if (k < repairers && fragment !== undefined) {
          plan.set(employee.id, { kind: 'repair', fragment });
        } else if (featuresLeft) {
          plan.set(employee.id, { kind: 'feature' });
        }
      });
  }
  return plan;
}

// PROJ-02, EMP-06 (Z): specjalizacje pracują równolegle i bez zależności ticketów; wydajność
// kilku osób tej samej roli sumuje się, ale nie przekracza zakresu.
export function doWork(state: GameState, config: BalanceConfig, plan: WorkPlan): GameState {
  // Suma wydajności i ryzyka ważonego wydajnością dla każdej pary projekt × specjalizacja.
  const contributions = new Map<string, { amount: number; weightedRisk: number }>();
  const employees = { ...state.staff.employees };
  for (const employee of Object.values(state.staff.employees)) {
    if (plan.get(employee.id)?.kind !== 'feature') continue;
    const { specialization, projectId } = employee;
    if (!projectId || !isTechSpecialization(specialization)) continue;
    const key = `${projectId}|${specialization}`;
    const amount = effectiveWorkPerStep(
      employee,
      config,
      pmBonusPermille(state, projectId, config),
    );
    const current = contributions.get(key) ?? { amount: 0, weightedRisk: 0 };
    contributions.set(key, {
      amount: current.amount + amount,
      weightedRisk: current.weightedRisk + amount * riskPermille(employee, config),
    });
    // NEED-01: energia maleje wyłącznie podczas faktycznej pracy.
    employees[employee.id] = drainEnergy(employee, config);
  }
  if (contributions.size === 0) return state;

  // Stała kolejność (projekt, specjalizacja) — losowania błędów są deterministyczne.
  const order = [...contributions.keys()].sort(compareContributionKeys);
  const projects = { ...state.contracts.projects };
  let rng = state.rng;
  for (const key of order) {
    const { amount, weightedRisk } = contributions.get(key) ?? { amount: 0, weightedRisk: 0 };
    const [projectId, specialization] = key.split('|') as [ProjectId, TechSpecialization];
    const project = projects[projectId];
    if (!project || amount <= 0) continue;
    const added = Math.min(amount, remainingPoints(project, specialization));
    const result = addWork(
      project,
      specialization,
      added,
      Math.round(weightedRisk / amount),
      rng,
      config,
    );
    projects[projectId] = result.project;
    rng = result.rng;
  }
  return {
    ...state,
    rng,
    staff: { ...state.staff, employees },
    contracts: { ...state.contracts, projects },
  };
}

// BUG-05, BUG-06 (Z), SH-004 B3/B4: naprawy po testach. Naprawa ma stały koszt, nie generuje
// błędów, nie wymaga retestu i nie cofa funkcji. Nadwyżka z ukończonej naprawy przechodzi na
// następny wolny błąd tej specjalizacji (także wykryty w tym kroku), nigdy na zarezerwowany.
export function doRepairs(state: GameState, config: BalanceConfig, plan: WorkPlan): GameState {
  const cost = repairSize(config);
  let projects = state.contracts.projects;
  let employees = state.staff.employees;
  const repairers = Object.values(state.staff.employees)
    .filter((e) => plan.get(e.id)?.kind === 'repair')
    .sort((a, b) => compareIds(a.id, b.id));
  const reserved = new Set<string>();
  for (const employee of repairers) {
    const task = plan.get(employee.id);
    if (task?.kind === 'repair') reserved.add(`${employee.projectId}|${task.fragment}`);
  }

  for (const employee of repairers) {
    const task = plan.get(employee.id);
    const projectId = employee.projectId;
    const project = projectId ? projects[projectId] : undefined;
    if (task?.kind !== 'repair' || !projectId || !project) continue;
    const specialization = employee.specialization as TechSpecialization;
    const progress = project.fragments.map((f) => f.repairProgress);
    let amount = effectiveWorkPerStep(employee, config, pmBonusPermille(state, projectId, config));
    let index: number | undefined = task.fragment;
    while (amount > 0 && index !== undefined) {
      const taken = Math.min(amount, cost - (progress[index] ?? 0));
      progress[index] = (progress[index] ?? 0) + taken;
      amount -= taken;
      if ((progress[index] ?? 0) < cost) break;
      index = openBugs(project, specialization, config).find(
        (i) => (progress[i] ?? 0) < cost && !reserved.has(`${projectId}|${i}`),
      );
      if (index !== undefined) reserved.add(`${projectId}|${index}`);
    }
    const fragments = project.fragments.map((fragment, i) => {
      const repairProgress = progress[i] ?? fragment.repairProgress;
      return repairProgress === fragment.repairProgress
        ? fragment
        : { ...fragment, repairProgress };
    });
    projects = { ...projects, [projectId]: { ...project, fragments } };
    // NEED-01: naprawa to praca — zużywa energię.
    employees = { ...employees, [employee.id]: drainEnergy(employee, config) };
  }

  if (repairers.length === 0) return state;
  return {
    ...state,
    staff: { ...state.staff, employees },
    contracts: { ...state.contracts, projects },
  };
}

// PROJ-10, PROJ-11, SH-004 B4: design po naprawach; koordynacja PM-a zużywa jego energię.
// Kilku Designerów sumuje wydajność do pułapu zakresu — seniority zmienia tempo, nie pułap.
export function doDesign(state: GameState, config: BalanceConfig, plan: WorkPlan): GameState {
  let projects = state.contracts.projects;
  let employees = state.staff.employees;
  let changed = false;
  for (const employee of Object.values(state.staff.employees).sort((a, b) =>
    compareIds(a.id, b.id),
  )) {
    const kind = plan.get(employee.id)?.kind;
    if (kind !== 'design' && kind !== 'coordinate') continue;
    const projectId = employee.projectId;
    const project = projectId ? projects[projectId] : undefined;
    if (!projectId || !project) continue;
    if (kind === 'design') {
      const amount = effectiveWorkPerStep(
        employee,
        config,
        pmBonusPermille(state, projectId, config),
      );
      const designProgress = project.designProgress + Math.min(amount, remainingDesign(project));
      projects = { ...projects, [projectId]: { ...project, designProgress } };
    }
    employees = { ...employees, [employee.id]: drainEnergy(employee, config) };
    changed = true;
  }
  if (!changed) return state;
  return {
    ...state,
    staff: { ...state.staff, employees },
    contracts: { ...state.contracts, projects },
  };
}

function compareContributionKeys(a: string, b: string): number {
  const [projectA = '', specA = ''] = a.split('|');
  const [projectB = '', specB = ''] = b.split('|');
  if (projectA !== projectB) return compareIds(projectA, projectB);
  return (
    TECH_SPECIALIZATIONS.indexOf(specA as TechSpecialization) -
    TECH_SPECIALIZATIONS.indexOf(specB as TechSpecialization)
  );
}

// Praca aktywna (funkcja, naprawa, design, koordynacja) w bieżącym stanie.
export function isWorking(state: GameState, employee: Employee, config: BalanceConfig): boolean {
  return planWork(state, config).has(employee.id);
}

// PROJ-09: procent ukończenia zakresu roli (zaokrąglony w dół — 100% tylko po faktycznym końcu).
export function progressPercent(
  project: ReadonlyProject,
  specialization: TechSpecialization,
): number {
  const scope = project.scopes[specialization];
  if (!scope) return 0;
  return Math.floor(((project.progress[specialization] ?? 0) * 100) / (scope * POINT_SCALE));
}

// PROJ-10: procent ukończenia designu (w dół).
export function designPercent(project: ReadonlyProject): number {
  if (project.designScope === 0) return 0;
  return Math.floor((project.designProgress * 100) / (project.designScope * POINT_SCALE));
}
