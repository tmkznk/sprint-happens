import type { BalanceConfig } from '../domain/config';
import type { Employee, EmployeeId } from '../domain/employees';
import type { Furniture } from '../domain/furniture';
import type { ReadonlyAgent as Agent } from '../domain/movement';
import type { Ceremony, Meeting } from '../domain/scrum';
import type { GameState } from '../domain/state';
import { interactionCells, standingCells } from '../world/geometry';
import { destinationId, standingDestinationId } from '../world/movement/officeEnv';
import { dropFurnitureDestinations, interruptFurnitureUse } from './furniture';
import { OPEN_ENDED_USE } from './needs';
import { activeEffect, openRetro } from './retro';
import { scrumMasterOf, scrumReady } from './scrum';
import { compareIds } from './staff';
import { DAY_LENGTH_MS } from './time';

// SH-055: spotkania Scruma przy stole konferencyjnym — planowanie (pierwszy dzień sprintu) albo
// daily o 10:00, retro pod koniec ostatniego dnia. Uczestnicy: Scrum Master i osoby
// z przydziałem do projektu obecne w biurze. Najpierw miejsca siedzące, potem stojące; kto się
// nie zmieści, nie idzie. W trakcie nikt z uczestników nie pracuje (nie siedzi przy biurku)
// ani nie traci energii; nowe przerwy nie zaczynają się, bo pierwszym zadaniem jest spotkanie.

// Długość ceremonii (ms czasu gry) według seniority Scrum Mastera, w pełnych krokach.
export function ceremonyMs(
  ceremony: Ceremony,
  sm: Pick<Employee, 'seniority'>,
  config: BalanceConfig,
  state?: GameState,
): number {
  const { scrum, simulation } = config;
  const factor =
    ceremony === 'planning' ? scrum.planningFactor : ceremony === 'retro' ? scrum.retroFactor : 1;
  // SH-056: karty retro zmieniają długość ceremonii.
  const cards = state ? (1000 + activeEffect(state).ceremonyPermille) / 1000 : 1;
  const ms = scrum.dailySeconds[sm.seniority] * 1000 * factor * cards;
  return Math.round(ms / simulation.stepMs) * simulation.stepMs;
}

// Podział uczestników na miejsca: najpierw siedzące, potem stojące, reszta zostaje.
export function meetingSeating(
  count: number,
  seats: number,
  standing: number,
): { seated: number; standing: number; left: number } {
  const seated = Math.min(count, seats);
  const standingTaken = Math.min(count - seated, standing);
  return { seated, standing: standingTaken, left: count - seated - standingTaken };
}

function conferenceTable(state: GameState): Furniture | null {
  return (
    Object.values(state.world.furniture)
      .filter((item) => item.type === 'conferenceTable')
      .sort((a, b) => compareIds(a.id, b.id))[0] ?? null
  );
}

const seatIds = (table: Furniture) =>
  interactionCells(table).map((_, i) => destinationId(table.id, i));
const standIds = (table: Furniture) =>
  standingCells(table).map((_, i) => standingDestinationId(table.id, i));

function isMeetingTask(agent: Agent, table: Furniture): boolean {
  const task = agent.tasks[0];
  return task?.kind === 'use' && task.destinationIds.some((id) => id.startsWith(`${table.id}#`));
}

// Osoba może teraz pójść na spotkanie: stoi u celu (biurko, wolne miejsce), nie jest na przerwie.
function isFree(agent: Agent): boolean {
  return agent.tasks[0]?.kind === 'goTo' && agent.status === 'arrived';
}

function withMeetingTask(state: GameState, agentId: string, destinationIds: string[]): GameState {
  const { movement } = state.world;
  return {
    ...state,
    world: {
      ...state.world,
      movement: {
        ...movement,
        agents: movement.agents.map((agent) =>
          agent.id === agentId
            ? {
                ...agent,
                tasks: [{ kind: 'use', destinationIds, steps: OPEN_ENDED_USE }, ...agent.tasks],
                path: [],
              }
            : agent,
        ),
      },
    },
  };
}

// Kolejne wezwanie na spotkanie: wolne miejsce siedzące, jeśli zostało, inaczej stojące.
function sendToTable(state: GameState, table: Furniture, agentId: string): GameState {
  const { movement } = state.world;
  const heading = movement.agents.filter((a) => a.id !== agentId && isMeetingTask(a, table));
  const seatsTaken = heading.filter((a) => {
    const task = a.tasks[0];
    return task?.kind === 'use' && task.destinationIds.includes(destinationId(table.id, 0));
  }).length;
  const seats = seatIds(table);
  return withMeetingTask(state, agentId, seatsTaken < seats.length ? seats : standIds(table));
}

function startMeeting(state: GameState, ceremony: Ceremony, config: BalanceConfig): GameState {
  const table = conferenceTable(state);
  const sm = scrumMasterOf(state);
  if (!table || !sm || !state.scrum) return state;
  const present = new Set(state.world.movement.agents.map((agent) => agent.id));
  const candidates = Object.values(state.staff.employees)
    .filter((e) => (e.id === sm.id || e.projectId !== null) && present.has(e.id))
    .sort((a, b) => compareIds(a.id, b.id));
  const seating = meetingSeating(candidates.length, seatIds(table).length, standIds(table).length);
  const participants: EmployeeId[] = candidates
    .slice(0, seating.seated + seating.standing)
    .map((e) => e.id);
  const now = state.mission.timeInDayMs;
  const meeting: Meeting = {
    ceremony,
    untilMs: null,
    deadlineMs:
      now + ceremonyMs(ceremony, sm, config, state) + config.simulation.maxTransitSeconds * 1000,
    participants,
  };
  let next: GameState = { ...state, scrum: { ...state.scrum, meeting } };
  for (const id of participants) {
    const agent = next.world.movement.agents.find((a) => a.id === id);
    if (agent && isFree(agent)) next = sendToTable(next, table, id);
  }
  return next;
}

// Koniec spotkania: uczestnicy wracają do biurek; daily i planowanie dają premię dnia tym, którzy
// doszli do stołu (siedzą albo stoją przy nim w chwili zakończenia).
function endMeeting(state: GameState, config: BalanceConfig, bonus: boolean): GameState {
  const scrum = state.scrum;
  const meeting = scrum?.meeting;
  if (!scrum || !meeting) return state;
  const table = conferenceTable(state);
  const attendees = table
    ? state.world.movement.agents
        .filter(
          (a) =>
            meeting.participants.includes(a.id as EmployeeId) &&
            a.status === 'using' &&
            a.reservedDestination?.startsWith(`${table.id}#`),
        )
        .map((a) => a.id as EmployeeId)
        .sort(compareIds)
    : [];
  const released = table
    ? dropFurnitureDestinations(interruptFurnitureUse(state, table.id), table.id)
    : state;
  const day = state.mission.day;
  const morning = meeting.ceremony !== 'retro';
  const ended: GameState = {
    ...released,
    scrum: {
      ...scrum,
      meeting: null,
      lastCeremony: { day, ceremony: meeting.ceremony },
      dailyBonus: bonus && morning ? { day, employees: attendees } : scrum.dailyBonus,
    },
  };
  // SH-056: po retro oferta kart i pauza.
  return bonus && !morning ? openRetro(ended, config) : ended;
}

// Która ceremonia powinna się teraz zacząć (albo null).
function ceremonyDue(state: GameState, config: BalanceConfig): Ceremony | null {
  const scrum = state.scrum;
  const sprint = scrum?.sprint;
  if (!scrum || !sprint || scrum.pendingGoal) return null;
  const { day, timeInDayMs } = state.mission;
  const last = scrum.lastCeremony;
  const heldToday = last?.day === day;
  if (!heldToday && timeInDayMs >= config.scrum.ceremonyAtMs) {
    return day === sprint.startDay ? 'planning' : 'daily';
  }
  const retroAt = config.scrum.retroWindowStart * DAY_LENGTH_MS;
  if (day === sprint.endDay && heldToday && last.ceremony !== 'retro' && timeInDayMs >= retroAt) {
    return 'retro';
  }
  return null;
}

// Krok Scruma (po ruchu i potrzebach, przed pracą).
export function advanceScrum(state: GameState, config: BalanceConfig): GameState {
  const scrum = state.scrum;
  if (state.mission.chapter !== 2 || !scrum?.sprint) return state;

  // Utrata Scrum Mastera albo stołu: koniec spotkania (bez premii) i sprintu, bez rozliczenia celu.
  if (!scrumReady(state)) {
    const ended = endMeeting(state, config, false);
    return {
      ...ended,
      scrum: ended.scrum && { ...ended.scrum, sprint: null, pendingRetro: null, meeting: null },
    };
  }

  const meeting = scrum.meeting;
  if (!meeting) {
    const due = ceremonyDue(state, config);
    return due ? startMeeting(state, due, config) : state;
  }

  const table = conferenceTable(state);
  const sm = scrumMasterOf(state);
  if (!table || !sm) return state;
  const now = state.mission.timeInDayMs;
  let next = state;
  // Spóźnieni (np. po papierosie) dołączają, jeśli spotkanie trwa.
  for (const id of meeting.participants) {
    const agent = next.world.movement.agents.find((a) => a.id === id);
    if (agent && isFree(agent) && !isMeetingTask(agent, table)) next = sendToTable(next, table, id);
  }
  // Spotkanie liczy się od chwili, gdy pierwszy uczestnik dojdzie do stołu.
  let untilMs = meeting.untilMs;
  if (untilMs === null) {
    const arrived = next.world.movement.agents.some(
      (a) =>
        meeting.participants.includes(a.id as EmployeeId) &&
        a.status === 'using' &&
        a.reservedDestination?.startsWith(`${table.id}#`),
    );
    // Od końca tego kroku (zegar dnia rośnie po systemach kroku).
    if (arrived)
      untilMs = now + config.simulation.stepMs + ceremonyMs(meeting.ceremony, sm, config, next);
  }
  if ((untilMs !== null && now >= untilMs) || now >= meeting.deadlineMs)
    return endMeeting(next, config, true);
  if (untilMs === meeting.untilMs) return next;
  return { ...next, scrum: next.scrum && { ...next.scrum, meeting: { ...meeting, untilMs } } };
}

// Uczestnik trwającego spotkania (w drodze do stołu albo przy nim).
export function isInScrumMeeting(state: GameState, employeeId: EmployeeId): boolean {
  const meeting = state.scrum?.meeting;
  if (!meeting?.participants.includes(employeeId)) return false;
  const table = conferenceTable(state);
  const agent = state.world.movement.agents.find((a) => a.id === employeeId);
  return !!table && !!agent && isMeetingTask(agent, table);
}
