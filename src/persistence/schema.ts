import { z } from 'zod';
import { EVENT_TEMPLATES } from '../domain/content/events';
import { PEOPLE, personById } from '../domain/content/people';
import type { BalanceConfig } from '../domain/config';
import {
  SENIORITIES,
  MAX_ENERGY,
  MAX_SATISFACTION,
  SPECIALIZATIONS,
  type Candidate,
  type CandidateId,
  type EmployeeId,
} from '../domain/employees';
import {
  POINT_SCALE,
  TECH_SPECIALIZATIONS,
  type OfferId,
  type ProjectId,
} from '../domain/contracts';
import { OPERATION_KINDS } from '../domain/finance';
import { PROLOGUE_STEPS } from '../domain/prologue';
import { FURNITURE_TYPES, ROTATIONS, type FurnitureId } from '../domain/furniture';
import type { GridPoint } from '../domain/grid';
import { SPEEDS, type GameState } from '../domain/state';
import { DAY_LENGTH_MS } from '../simulation/time';
import { occupiedCells } from '../world/geometry';
import { movementEnvFor } from '../world/movement/officeEnv';
import { cellKindAt, type OfficeLayout } from '../world/officeLayout';

// T:SAVE-T02, SAVE-T06 — schemat migawki stanu gry. Każdy system domenowy dodaje tu swój
// fragment; test typów w schema.test.ts nie przejdzie, jeśli GameState i schemat się rozjadą.

export type ValidationContext = { config: BalanceConfig; layout: OfficeLayout };

const furnitureId = z.custom<FurnitureId>(
  (value) => typeof value === 'string' && /^furniture-[1-9]\d*$/.test(value),
  'Niepoprawne ID mebla',
);

const point = z.strictObject({ x: z.int(), y: z.int() });

const employeeId = z.custom<EmployeeId>(
  (value) => typeof value === 'string' && /^employee-[1-9]\d*$/.test(value),
  'Niepoprawne ID pracownika',
);
const candidateId = z.custom<CandidateId>(
  (value) => typeof value === 'string' && /^candidate-[1-9]\d*$/.test(value),
  'Niepoprawne ID kandydata',
);
const person = {
  personId: z.string().min(1),
  name: z.string().min(1),
  specialization: z.enum(SPECIALIZATIONS),
  seniority: z.enum(SENIORITIES),
  dailyWage: z.int().min(0),
};
const offerId = z.custom<OfferId>(
  (value) => typeof value === 'string' && /^offer-[1-9]\d*$/.test(value),
  'Niepoprawne ID oferty',
);
const projectId = z.custom<ProjectId>(
  (value) => typeof value === 'string' && /^project-[1-9]\d*$/.test(value),
  'Niepoprawne ID projektu',
);
// PROJ-09, decyzja SH-032 B1: zakresy w punktach pracy, wielokrotności fragmentu 10 pp.
const scopePoints = z.int().min(10).multipleOf(10);
const terms = {
  templateId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  scopes: z.partialRecord(z.enum(TECH_SPECIALIZATIONS), scopePoints),
  designImportance: z.int().min(0).max(5),
  designScope: z.int().min(0),
  deadlineDays: z.int().min(1),
  reward: z.int().min(1),
  advance: z.int().min(0),
  latePenaltyPerDay: z.int().min(0),
};
const contractsSchema = z.strictObject({
  offers: z.array(z.strictObject({ id: offerId, ...terms })),
  projects: z.record(
    projectId,
    z.strictObject({
      id: projectId,
      ...terms,
      acceptedOnDay: z.int().min(1),
      deadlineDay: z.int().min(2),
      status: z.enum(['active', 'delivered']),
      progress: z.partialRecord(z.enum(TECH_SPECIALIZATIONS), z.int().min(0)),
      fragments: z.array(
        z.strictObject({
          specialization: z.enum(TECH_SPECIALIZATIONS),
          hasBug: z.boolean(),
          testProgress: z.int().min(0),
          repairProgress: z.int().min(0),
        }),
      ),
      fragmentRisk: z.partialRecord(z.enum(TECH_SPECIALIZATIONS), z.int().min(0)),
      designProgress: z.int().min(0),
      delivery: z
        .strictObject({
          day: z.int().min(1),
          daysLate: z.int().min(0),
          penalty: z.int().min(0),
          payment: z.int().min(0),
          remainingBugs: z.int().min(0),
          qualityPermille: z.int().min(0).max(1000),
          designPermille: z.int().min(0).max(1000),
          reputation: z.strictObject({
            punctuality: z.int(),
            quality: z.int(),
            design: z.int(),
            total: z.int(),
          }),
          reputationAfter: z.int().min(0).max(100),
        })
        .nullable(),
    }),
  ),
  deliveredCount: z.int().min(0),
});

const staffSchema = z.strictObject({
  employees: z.record(
    employeeId,
    z.strictObject({
      id: employeeId,
      ...person,
      hiredOnDay: z.int().min(1),
      deskId: furnitureId.nullable(),
      projectId: projectId.nullable(),
      energy: z.int().min(0).max(MAX_ENERGY),
      satisfaction: z.int().min(0).max(MAX_SATISFACTION),
      badConditionsMs: z.int().min(0),
      lowSatisfactionMs: z.int().min(0),
    }),
  ),
  candidates: z.array(z.strictObject({ id: candidateId, ...person })),
  departures: z.array(
    z.strictObject({
      employeeId,
      personId: z.string().min(1),
      name: z.string().min(1),
      day: z.int().min(1),
      reason: z.enum(['fired', 'quit']),
    }),
  ),
});

const missionSchema = z.strictObject({
  status: z.enum(['active', 'won', 'bankrupt']),
  day: z.int().min(1),
  phase: z.enum(['working', 'workEnded', 'settled']),
  speed: z.literal(SPEEDS),
  timeInDayMs: z.int().min(0).max(DAY_LENGTH_MS),
  report: z
    .strictObject({
      day: z.int().min(1),
      income: z.int().min(0),
      spending: z.int().min(0),
      wages: z.int().min(0),
      upkeep: z.int().min(0),
      cashAfterSettlement: z.int(),
      rescueDeadlineDay: z.int().min(1).nullable(),
    })
    .nullable(),
  reputation: z.int().min(0).max(100),
});

const financeSchema = z.strictObject({
  openingCash: z.int(),
  cash: z.int(),
  ledger: z.array(
    z.strictObject({
      key: z.string().min(1),
      day: z.int().min(1),
      kind: z.enum(OPERATION_KINDS),
      amount: z.int(),
      ref: z.string().nullable(),
    }),
  ),
  wagesDueToday: z.record(z.string().min(1), z.int().min(0)),
  rescueDeadlineDay: z.int().min(1).nullable(),
});

const furnitureSchema = z.strictObject({
  id: furnitureId,
  type: z.enum(FURNITURE_TYPES),
  origin: point,
  rotation: z.literal(ROTATIONS),
});

const taskSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('goTo'), cell: point }),
  z.strictObject({
    kind: z.literal('use'),
    destinationIds: z.array(z.string().min(1)).min(1),
    steps: z.int().min(1),
  }),
]);

const agentSchema = z.strictObject({
  id: z.string().min(1),
  cell: point,
  move: z.strictObject({ to: point, elapsed: z.int().min(0) }).nullable(),
  tasks: z.array(taskSchema),
  reservedDestination: z.string().nullable(),
  queuedSince: z.int().min(0).nullable(),
  usedSteps: z.int().min(0),
  path: z.array(point),
  status: z.enum([
    'idle',
    'walking',
    'waiting',
    'yielding',
    'queued',
    'using',
    'arrived',
    'noRoute',
    'deadlocked',
  ]),
  waitedSteps: z.int().min(0),
  yieldingTo: z.string().nullable(),
  yieldHeldSteps: z.int().min(0),
});

const movementSchema = z.strictObject({
  step: z.int().min(0),
  agents: z.array(agentSchema),
  reservations: z.record(z.string(), z.string()),
});

const worldSchema = z.strictObject({
  furniture: z.record(furnitureId, furnitureSchema),
  movement: movementSchema,
});

const idsSchema = z.record(z.string().regex(/^[a-z][a-zA-Z]*$/), z.int().min(0));

// EVT-01–03: stan zdarzeń, w tym oczekująca decyzja (przetrwa zapis).
const eventsSchema = z.strictObject({
  scheduledAtMs: z.int().min(0).max(DAY_LENGTH_MS).nullable(),
  pending: z
    .strictObject({
      instanceId: z.string().regex(/^event-\d+$/),
      templateId: z.enum(EVENT_TEMPLATES.map((t) => t.id) as [string, ...string[]]),
      projectId: projectId.nullable(),
      resumeSpeed: z.literal(SPEEDS),
    })
    .nullable(),
  lastSeenDay: z.record(z.string().min(1), z.int().min(1)),
  meetingUntilMs: z.int().min(0).nullable(),
  coffeeBrokenDay: z.int().min(1).nullable(),
});

// Prolog (samouczek): bieżący krok; null — właściwa misja.
const prologueSchema = z.strictObject({ step: z.enum(PROLOGUE_STEPS) }).nullable();

export const gameStateShape = z.strictObject({
  mission: missionSchema,
  finance: financeSchema,
  contracts: contractsSchema,
  staff: staffSchema,
  world: worldSchema,
  events: eventsSchema,
  prologue: prologueSchema,
  ids: idsSchema,
  // TIME-T04: stan generatora losowego jest zapisywany, aby wczytanie nie przelosowało wyników.
  rng: z.uint32(),
});

type Issue = { path: (string | number)[]; message: string };

// Spójność, której nie wyrazi sam kształt danych: ID, referencje, zajętość pól, fazy dnia.
export function consistencyIssues(state: GameState, context: ValidationContext): Issue[] {
  const furniture = furnitureIssues(state, context);
  return [
    ...missionIssues(state, context),
    ...financeIssues(state),
    ...furniture,
    ...staffIssues(state),
    ...contractIssues(state, context),
    ...eventIssues(state),
    // Ruch sprawdzamy tylko na poprawnym układzie mebli — inaczej mapa przejść jest niewiarygodna.
    ...(furniture.length === 0 ? movementIssues(state, context) : []),
  ];
}

function missionIssues(state: GameState, { config }: ValidationContext): Issue[] {
  const issues: Issue[] = [];
  const { mission } = state;
  if (mission.timeInDayMs % config.simulation.stepMs !== 0) {
    issues.push({ path: ['mission', 'timeInDayMs'], message: 'Czas dnia poza siatką kroków' });
  }
  const dayFinished = mission.timeInDayMs === DAY_LENGTH_MS;
  if (mission.phase === 'working' && dayFinished) {
    issues.push({ path: ['mission', 'phase'], message: 'Dzień pracy po upływie 600 s' });
  }
  if (mission.phase !== 'working' && (!dayFinished || mission.speed !== 0)) {
    issues.push({ path: ['mission', 'phase'], message: 'Po końcu pracy symulacja musi stać' });
  }
  if (mission.status !== 'active' && mission.speed !== 0) {
    issues.push({ path: ['mission', 'speed'], message: 'Zakończona misja nie może biec' });
  }
  const settled = mission.phase === 'settled';
  if (
    settled !== (mission.report !== null) ||
    (mission.report && mission.report.day !== mission.day)
  ) {
    issues.push({ path: ['mission', 'report'], message: 'Raport niezgodny z fazą lub dniem' });
  }
  return issues;
}

// SH-027: saldo wynika z księgi, a każda operacja występuje raz.
function financeIssues(state: GameState): Issue[] {
  const issues: Issue[] = [];
  const { finance, mission } = state;
  const total = finance.ledger.reduce((sum, entry) => sum + entry.amount, finance.openingCash);
  if (total !== finance.cash) {
    issues.push({ path: ['finance', 'cash'], message: 'Saldo niezgodne z księgą operacji' });
  }
  const keys = new Set<string>();
  finance.ledger.forEach((entry, index) => {
    const path = ['finance', 'ledger', index];
    if (keys.has(entry.key)) issues.push({ path, message: `Powtórzona operacja ${entry.key}` });
    keys.add(entry.key);
    if (entry.day > mission.day) issues.push({ path, message: 'Operacja z przyszłego dnia' });
  });
  // FIN-05: okres ratunkowy trwa najwyżej trzy dni od dnia, po którym powstał dług.
  const deadline = finance.rescueDeadlineDay;
  if (deadline !== null && (deadline < mission.day || deadline > mission.day + 3)) {
    issues.push({
      path: ['finance', 'rescueDeadlineDay'],
      message: 'Okres ratunkowy poza zakresem',
    });
  }
  return issues;
}

function furnitureIssues(state: GameState, { layout }: ValidationContext): Issue[] {
  const issues: Issue[] = [];
  const taken = new Map<string, string>();
  const allocated = state.ids.furniture ?? 0;
  for (const [key, item] of Object.entries(state.world.furniture)) {
    const path = ['world', 'furniture', key];
    if (item.id !== key) issues.push({ path, message: 'Klucz różny od ID mebla' });
    if (sequenceNumber(item.id) > allocated) {
      issues.push({ path, message: 'ID mebla spoza przydzielonej sekwencji' });
    }
    for (const cell of occupiedCells(item)) {
      if (cellKindAt(layout, cell) !== 'floor') {
        issues.push({ path, message: `Mebel poza podłogą na polu ${label(cell)}` });
      }
      const other = taken.get(label(cell));
      if (other) issues.push({ path, message: `Mebel koliduje z ${other} na polu ${label(cell)}` });
      taken.set(label(cell), item.id);
    }
  }
  return issues;
}

// EVT-02: oczekująca decyzja wskazuje istniejący projekt; zaplanowane zdarzenie nie współistnieje
// z oczekującym (najwyżej jedno decyzyjne dziennie).
function eventIssues(state: GameState): Issue[] {
  const issues: Issue[] = [];
  const { pending, scheduledAtMs } = state.events;
  if (pending?.projectId && !state.contracts.projects[pending.projectId]) {
    issues.push({
      path: ['events', 'pending', 'projectId'],
      message: 'Zdarzenie dla nieznanego projektu',
    });
  }
  if (pending && scheduledAtMs !== null) {
    issues.push({ path: ['events'], message: 'Zaplanowane i oczekujące zdarzenie naraz' });
  }
  return issues;
}

// CON-01–03, FIN-01, TIME-08: tablica ofert i przyjęte kontrakty.
function contractIssues(state: GameState, { config }: ValidationContext): Issue[] {
  const issues: Issue[] = [];
  const { offers, projects, deliveredCount } = state.contracts;
  if (offers.length > config.contracts.boardSize) {
    issues.push({ path: ['contracts', 'offers'], message: 'Więcej ofert niż miejsc na tablicy' });
  }
  const templates = new Set<string>();
  offers.forEach((offer, index) => {
    const path = ['contracts', 'offers', index];
    if (templates.has(offer.templateId))
      issues.push({ path, message: 'Powtórzony szablon na tablicy' });
    templates.add(offer.templateId);
    if (sequenceNumber(offer.id) > (state.ids.offer ?? 0)) {
      issues.push({ path, message: 'ID oferty spoza przydzielonej sekwencji' });
    }
    if (Object.keys(offer.scopes).length === 0)
      issues.push({ path, message: 'Oferta bez zakresu technicznego' });
  });
  const advances = new Map(
    state.finance.ledger.filter((e) => e.kind === 'advance').map((e) => [e.ref, e.amount]),
  );
  for (const [key, project] of Object.entries(projects)) {
    const path = ['contracts', 'projects', key];
    if (project.id !== key) issues.push({ path, message: 'Klucz różny od ID projektu' });
    if (sequenceNumber(project.id) > (state.ids.project ?? 0)) {
      issues.push({ path, message: 'ID projektu spoza przydzielonej sekwencji' });
    }
    if (project.acceptedOnDay > state.mission.day) {
      issues.push({ path, message: 'Przyjęcie w przyszłym dniu' });
    }
    if (project.deadlineDay !== project.acceptedOnDay + project.deadlineDays) {
      issues.push({ path, message: 'Termin niezgodny z dniem przyjęcia (TIME-08)' });
    }
    // BUG-01, SH-004 B1: każdy ukończony fragment ma rozstrzygnięty błąd — liczba fragmentów
    // każdej specjalizacji odpowiada pełnym fragmentom wykonanej pracy.
    const fragmentPoints = config.bugs.fragmentPoints * POINT_SCALE;
    for (const specialization of TECH_SPECIALIZATIONS) {
      const expected = Math.floor((project.progress[specialization] ?? 0) / fragmentPoints);
      const actual = project.fragments.filter((f) => f.specialization === specialization).length;
      if (expected !== actual) {
        issues.push({ path, message: `Fragmenty ${specialization} niezgodne z postępem` });
      }
    }
    // BUG-05: test fragmentu nie przekracza jego rozmiaru.
    if (project.fragments.some((f) => f.testProgress > fragmentPoints)) {
      issues.push({ path, message: 'Postęp testów ponad rozmiar fragmentu' });
    }
    // PROJ-07: raport oddania istnieje dokładnie dla oddanych projektów; reszta wypłaty
    // nie przekracza wynagrodzenia pomniejszonego o zaliczkę (FIN-01, FIN-04).
    if ((project.status === 'delivered') !== (project.delivery !== null)) {
      issues.push({ path, message: 'Raport oddania niezgodny ze statusem' });
    }
    if (
      project.delivery &&
      project.delivery.payment + project.delivery.penalty > project.reward - project.advance
    ) {
      issues.push({ path, message: 'Wypłata przy oddaniu ponad resztę wynagrodzenia' });
    }
    // PROJ-10: design nie przekracza zakresu designu.
    if (project.designProgress > project.designScope * POINT_SCALE) {
      issues.push({ path, message: 'Postęp designu ponad zakres' });
    }
    // BUG-06: naprawiać można tylko wykryty błąd i nie ponad stały koszt naprawy.
    const repairPoints = config.bugs.repairPoints * POINT_SCALE;
    for (const f of project.fragments) {
      const detected = f.hasBug && f.testProgress >= fragmentPoints;
      if (f.repairProgress > (detected ? repairPoints : 0)) {
        issues.push({ path, message: 'Naprawa niewykrytego błędu lub ponad koszt' });
      }
    }
    // PROJ-09: postęp tylko w zakresach projektu i nie ponad zakres.
    for (const [specialization, done] of Object.entries(project.progress)) {
      const scope = project.scopes[specialization as keyof typeof project.scopes];
      if (scope === undefined || done > scope * POINT_SCALE) {
        issues.push({ path, message: `Postęp ${specialization} poza zakresem projektu` });
      }
    }
    if (advances.get(project.id) !== project.advance) {
      issues.push({ path, message: 'Brak zaliczki projektu w księdze (FIN-01)' });
    }
  }
  const delivered = Object.values(projects).filter((p) => p.status === 'delivered').length;
  if (delivered !== deliveredCount) {
    issues.push({ path: ['contracts', 'deliveredCount'], message: 'Liczba oddanych niezgodna' });
  }
  return issues;
}

// EMP-01–04, OFF-04: pracownicy, biurka i rynek kandydatów.
function staffIssues(state: GameState): Issue[] {
  const issues: Issue[] = [];
  const { employees, candidates } = state.staff;
  const desks = new Map<string, string>();
  const pms = new Map<string, string>();
  const agentIds = new Set(state.world.movement.agents.map((agent) => agent.id));
  for (const [key, employee] of Object.entries(employees)) {
    const path = ['staff', 'employees', key];
    if (employee.id !== key) issues.push({ path, message: 'Klucz różny od ID pracownika' });
    if (sequenceNumber(employee.id) > (state.ids.employee ?? 0)) {
      issues.push({ path, message: 'ID pracownika spoza przydzielonej sekwencji' });
    }
    if (employee.hiredOnDay > state.mission.day) {
      issues.push({ path, message: 'Zatrudnienie w przyszłym dniu' });
    }
    if (employee.deskId !== null) {
      if (state.world.furniture[employee.deskId]?.type !== 'desk') {
        issues.push({ path, message: 'Przypisane biurko nie istnieje' });
      }
      const other = desks.get(employee.deskId);
      if (other) issues.push({ path, message: `Biurko przypisane także do ${other}` });
      desks.set(employee.deskId, employee.id);
    }
    if (!agentIds.has(employee.id))
      issues.push({ path, message: 'Pracownik bez postaci w biurze' });
    if (employee.projectId !== null) {
      const project = state.contracts.projects[employee.projectId];
      if (project?.status !== 'active') {
        issues.push({ path, message: 'Przydział do nieistniejącego lub oddanego projektu' });
      }
      // PROJ-11 (Z): najwyżej jeden PM na projekt.
      if (employee.specialization === 'pm') {
        const otherPm = pms.get(employee.projectId);
        if (otherPm) issues.push({ path, message: `Drugi PM w projekcie (jest ${otherPm})` });
        pms.set(employee.projectId, employee.id);
      }
    }
  }
  for (const agentId of agentIds) {
    if (!(agentId in employees)) {
      issues.push({
        path: ['world', 'movement', 'agents'],
        message: `Postać ${agentId} bez pracownika`,
      });
    }
  }
  const candidateIds = new Set<string>();
  candidates.forEach((candidate, index) => {
    const path = ['staff', 'candidates', index];
    if (candidateIds.has(candidate.id)) issues.push({ path, message: 'Powtórzony kandydat' });
    candidateIds.add(candidate.id);
    if (sequenceNumber(candidate.id) > (state.ids.candidate ?? 0)) {
      issues.push({ path, message: 'ID kandydata spoza przydzielonej sekwencji' });
    }
  });
  // Postacie z listy: istnieją, zgadzają się z kopią imienia i cech, nie występują dwa razy
  // (także po odejściu z firmy).
  const people = new Set<string>();
  const checkPerson = (
    path: (string | number)[],
    entry: Pick<Candidate, 'personId' | 'name' | 'specialization' | 'seniority'>,
  ) => {
    const person = personById(entry.personId);
    if (
      !person ||
      person.name !== entry.name ||
      person.specialization !== entry.specialization ||
      person.seniority !== entry.seniority
    ) {
      issues.push({ path, message: `Postać ${entry.personId} niezgodna z listą` });
    }
    if (people.has(entry.personId)) {
      issues.push({ path, message: `Postać ${entry.personId} występuje dwa razy` });
    }
    people.add(entry.personId);
  };
  // Odejścia rezerwują postać na stałe — nie może wrócić jako kandydat ani pracownik.
  state.staff.departures.forEach((departure, index) => {
    const path = ['staff', 'departures', index];
    if (personById(departure.personId)?.name !== departure.name) {
      issues.push({ path, message: `Postać ${departure.personId} niezgodna z listą` });
    }
    if (people.has(departure.personId)) {
      issues.push({ path, message: `Postać ${departure.personId} występuje dwa razy` });
    }
    people.add(departure.personId);
  });
  for (const [key, employee] of Object.entries(employees)) {
    checkPerson(['staff', 'employees', key], employee);
  }
  candidates.forEach((candidate, index) => checkPerson(['staff', 'candidates', index], candidate));
  // EMP-03: po jednym kandydacie na parę; puste miejsce tylko przy wyczerpanej puli postaci.
  // Prolog ma własny, stały rynek (jeden kandydat).
  for (const specialization of state.prologue ? [] : SPECIALIZATIONS) {
    for (const seniority of SENIORITIES) {
      const slot = `${specialization}/${seniority}`;
      const count = candidates.filter(
        (c) => c.specialization === specialization && c.seniority === seniority,
      ).length;
      const free = PEOPLE.some(
        (p) =>
          p.specialization === specialization && p.seniority === seniority && !people.has(p.id),
      );
      if (count > 1) {
        issues.push({ path: ['staff', 'candidates'], message: `Kilku kandydatów ${slot}` });
      } else if (count === 0 && free) {
        issues.push({
          path: ['staff', 'candidates'],
          message: `Brak kandydata ${slot} (EMP-03)`,
        });
      }
    }
  }
  return issues;
}

const sequenceNumber = (id: string) => Number(id.split('-')[1]);

// T:SAVE-T06 — spójność rezerwacji i pozycji postaci (MOVE-03, MOVE-04, MOVE-09).
function movementIssues(state: GameState, { config, layout }: ValidationContext): Issue[] {
  const issues: Issue[] = [];
  const { agents, reservations, step } = state.world.movement;
  const { grid, destinations } = movementEnvFor(state, config, layout);
  const destinationIds = new Set(destinations.map((destination) => destination.id));
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const taken = new Map<string, string>();

  if (byId.size !== agents.length) {
    issues.push({ path: ['world', 'movement', 'agents'], message: 'Powtórzone ID postaci' });
  }
  agents.forEach((agent, index) => {
    const path = ['world', 'movement', 'agents', index];
    const cells = agent.move ? [agent.cell, agent.move.to] : [agent.cell];
    for (const cell of cells) {
      if (!grid.passable(cell))
        issues.push({ path, message: `Postać na przeszkodzie ${label(cell)}` });
      const other = taken.get(label(cell));
      if (other) issues.push({ path, message: `Pole ${label(cell)} zajęte także przez ${other}` });
      taken.set(label(cell), agent.id);
    }
    if (agent.move) {
      const distance =
        Math.abs(agent.move.to.x - agent.cell.x) + Math.abs(agent.move.to.y - agent.cell.y);
      if (distance !== 1)
        issues.push({ path, message: 'Przejście nie prowadzi na sąsiednie pole' });
      if (agent.move.elapsed >= config.movement.stepsPerCell) {
        issues.push({ path, message: 'Przejście przekracza czas jednego pola' });
      }
    }
    if (
      agent.reservedDestination !== null &&
      reservations[agent.reservedDestination] !== agent.id
    ) {
      issues.push({ path, message: 'Rezerwacja postaci nie jest zapisana w miejscu' });
    }
    if (agent.yieldingTo !== null && !byId.has(agent.yieldingTo)) {
      issues.push({ path, message: 'Ustąpienie na rzecz nieistniejącej postaci' });
    }
    if (agent.queuedSince !== null && agent.queuedSince > step) {
      issues.push({ path, message: 'Kolejka z przyszłości' });
    }
  });
  for (const [destination, holder] of Object.entries(reservations)) {
    const path = ['world', 'movement', 'reservations', destination];
    if (!destinationIds.has(destination))
      issues.push({ path, message: 'Rezerwacja nieistniejącego miejsca' });
    if (byId.get(holder)?.reservedDestination !== destination) {
      issues.push({ path, message: 'Rezerwacja wskazuje postać, która jej nie ma' });
    }
  }
  return issues;
}

const label = (cell: GridPoint) => `${cell.x},${cell.y}`;

export function gameStateSchema(context: ValidationContext) {
  return gameStateShape.superRefine((state, ctx) => {
    for (const issue of consistencyIssues(state as GameState, context)) {
      ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
    }
  });
}
