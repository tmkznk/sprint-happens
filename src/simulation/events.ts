import type { BalanceConfig } from '../domain/config';
import {
  EVENT_TEMPLATES,
  type EventCondition,
  type EventEffect,
  type GameEventTemplate,
} from '../domain/content/events';
import type { ProjectId } from '../domain/contracts';
import { MAX_SATISFACTION, SATISFACTION_SCALE } from '../domain/employees';
import { allocateId } from '../domain/ids';
import { nextRandom } from '../domain/random';
import type { GameState } from '../domain/state';
import { fragmentSize } from './bugs';
import { recordOperation } from './finance';
import { applyReputation } from './quality';
import { compareIds } from './staff';
import { DAY_LENGTH_MS } from './time';

// EVT-01–03 (Z), decyzja SH-032 A7: najwyżej jedno zdarzenie decyzyjne dziennie, nie codziennie,
// tylko ze spełnionym warunkiem. Losowanie wspólnym generatorem z ziarnem w stałych chwilach
// (początek dnia, moment zdarzenia), więc wczytanie niczego nie przelosowuje.

export function eventTemplate(id: string): GameEventTemplate | undefined {
  return EVENT_TEMPLATES.find((template) => template.id === id);
}

// Początek dnia: czy i kiedy dziś wystąpi zdarzenie (moment wyrównany do kroku symulacji).
export function scheduleDay(state: GameState, config: BalanceConfig): GameState {
  const { events } = config;
  const base = { ...state.events, scheduledAtMs: null, meetingUntilMs: null };
  if (state.mission.day < events.firstDay) return { ...state, events: base };
  const roll = nextRandom(state.rng);
  if (roll.value >= events.dailyChance) return { ...state, events: base, rng: roll.state };
  const moment = nextRandom(roll.state);
  const { stepMs } = config.simulation;
  const start = events.windowStart * DAY_LENGTH_MS;
  const span = (events.windowEnd - events.windowStart) * DAY_LENGTH_MS;
  const scheduledAtMs = Math.floor((start + moment.value * span) / stepMs) * stepMs;
  return { ...state, events: { ...base, scheduledAtMs }, rng: moment.state };
}

// Projekty, których może dotyczyć warunek (według ID); null — warunek nie wskazuje projektu.
function conditionTargets(state: GameState, condition: EventCondition): ProjectId[] | null | false {
  const projects = Object.values(state.contracts.projects).sort((a, b) => compareIds(a.id, b.id));
  const active = projects.filter((p) => p.status === 'active');
  const nonEmpty = (ids: ProjectId[]) => (ids.length > 0 ? ids : false);
  switch (condition.kind) {
    case 'activeProjectWith':
      return nonEmpty(
        active
          .filter((p) => (p.scopes[condition.specialization] ?? 0) >= (condition.minPoints ?? 1))
          .map((p) => p.id),
      );
    case 'activeProjectWithout':
      return nonEmpty(
        active.filter((p) => p.scopes[condition.specialization] === undefined).map((p) => p.id),
      );
    case 'deliveredWithinDays':
      return nonEmpty(
        projects
          .filter((p) => p.delivery && p.delivery.day >= state.mission.day - condition.days)
          .map((p) => p.id),
      );
    case 'hasCoffeeMachine':
      return Object.values(state.world.furniture).some((f) => f.type === 'coffeeMachine') &&
        state.events.coffeeBrokenDay !== state.mission.day
        ? null
        : false;
    case 'minEmployees':
      return Object.keys(state.staff.employees).length >= condition.count ? null : false;
    case 'minCash':
      return state.finance.cash >= condition.amount ? null : false;
  }
}

// Wystąpienie zaplanowanego zdarzenia: wybór spośród spełniających warunek i odstęp powtórzeń,
// automatyczna pauza z zapamiętaniem tempa. Bez kandydatów dzień mija bez zdarzenia.
export function triggerEvent(state: GameState, config: BalanceConfig): GameState {
  const { scheduledAtMs } = state.events;
  if (scheduledAtMs === null || state.events.pending) return state;
  if (state.mission.timeInDayMs < scheduledAtMs) return state;

  const { day } = state.mission;
  const eligible = EVENT_TEMPLATES.flatMap((template) => {
    const last = state.events.lastSeenDay[template.id];
    if (last !== undefined && day - last < config.events.cooldownDays) return [];
    const targets = conditionTargets(state, template.condition);
    return targets === false ? [] : [{ template, targets }];
  });
  const cleared = { ...state, events: { ...state.events, scheduledAtMs: null } };
  if (eligible.length === 0) return cleared;

  const pick = nextRandom(state.rng);
  const chosen = eligible[Math.floor(pick.value * eligible.length)];
  if (!chosen) return cleared;
  let rng = pick.state;
  let projectId: ProjectId | null = null;
  if (chosen.targets) {
    const target = nextRandom(rng);
    rng = target.state;
    projectId = chosen.targets[Math.floor(target.value * chosen.targets.length)] ?? null;
  }
  const allocated = allocateId(state.ids, 'event');
  return {
    ...cleared,
    ids: allocated.sequence,
    rng,
    mission: { ...state.mission, speed: 0 },
    events: {
      ...cleared.events,
      pending: {
        instanceId: allocated.id,
        templateId: chosen.template.id,
        projectId,
        resumeSpeed: state.mission.speed,
      },
      lastSeenDay: { ...state.events.lastSeenDay, [chosen.template.id]: day },
    },
  };
}

// Zakres dodany efektem procentowym: wielokrotność fragmentu, co najmniej jeden fragment.
export function scopeIncrease(scope: number, percent: number, config: BalanceConfig): number {
  const fragment = config.bugs.fragmentPoints;
  return Math.max(fragment, Math.round((scope * percent) / 100 / fragment) * fragment);
}

export function rewardIncrease(reward: number, percent: number): number {
  return Math.round((reward * percent) / 100);
}

// EVT-02: skutki wybranej odpowiedzi — stosowane dokładnie raz (klucz księgi z ID wystąpienia).
export function applyEffects(
  state: GameState,
  effects: readonly EventEffect[],
  projectId: ProjectId | null,
  instanceId: string,
  config: BalanceConfig,
): GameState {
  let next = state;
  for (const effect of effects) next = applyEffect(next, effect, projectId, instanceId, config);
  return next;
}

function applyEffect(
  state: GameState,
  effect: EventEffect,
  projectId: ProjectId | null,
  instanceId: string,
  config: BalanceConfig,
): GameState {
  const project = projectId ? state.contracts.projects[projectId] : undefined;
  const withProject = (patch: Partial<typeof project & object>): GameState =>
    project
      ? {
          ...state,
          contracts: {
            ...state.contracts,
            projects: { ...state.contracts.projects, [project.id]: { ...project, ...patch } },
          },
        }
      : state;

  switch (effect.kind) {
    case 'scopePercent': {
      const scope = project?.scopes[effect.specialization];
      if (!project || scope === undefined) return state;
      const scopes = {
        ...project.scopes,
        [effect.specialization]: scope + scopeIncrease(scope, effect.percent, config),
      };
      return withProject({ scopes });
    }
    case 'addScope': {
      if (!project || project.scopes[effect.specialization] !== undefined) return state;
      return withProject({
        scopes: { ...project.scopes, [effect.specialization]: effect.points },
        progress: { ...project.progress, [effect.specialization]: 0 },
      });
    }
    case 'rewardPercent':
      return project
        ? withProject({ reward: project.reward + rewardIncrease(project.reward, effect.percent) })
        : state;
    case 'deadlineDays':
      return project
        ? withProject({
            deadlineDays: project.deadlineDays + effect.days,
            deadlineDay: project.deadlineDay + effect.days,
          })
        : state;
    case 'reputation':
      return {
        ...state,
        mission: {
          ...state.mission,
          reputation: applyReputation(state.mission.reputation, effect.delta),
        },
      };
    case 'cash': {
      // EVT-02, FIN-08: jawny skutek zdarzenia jest kosztem obowiązkowym (może dać dług).
      const result = recordOperation(state, {
        key: `event:${instanceId}`,
        kind: 'event',
        amount: effect.amount,
        ref: projectId ?? instanceId,
      });
      return result.ok ? result.state : state;
    }
    case 'satisfactionAll': {
      const delta = effect.delta * SATISFACTION_SCALE;
      const employees = Object.fromEntries(
        Object.entries(state.staff.employees).map(([id, e]) => [
          id,
          { ...e, satisfaction: Math.min(MAX_SATISFACTION, Math.max(0, e.satisfaction + delta)) },
        ]),
      ) as typeof state.staff.employees;
      return { ...state, staff: { ...state.staff, employees } };
    }
    case 'meeting':
      return {
        ...state,
        events: {
          ...state.events,
          meetingUntilMs: state.mission.timeInDayMs + effect.seconds * 1000,
        },
      };
    case 'coffeeBroken':
      return { ...state, events: { ...state.events, coffeeBrokenDay: state.mission.day } };
    case 'revealBugs': {
      if (!project) return state;
      const size = fragmentSize(config);
      let left = effect.count;
      const fragments = project.fragments.map((f) => {
        if (
          left > 0 &&
          f.specialization === effect.specialization &&
          f.hasBug &&
          f.testProgress < size
        ) {
          left--;
          return { ...f, testProgress: size };
        }
        return f;
      });
      return withProject({ fragments });
    }
  }
}

// Zebranie (EVT): nikt nie pracuje do podanej chwili dnia.
export function isInMeeting(state: GameState): boolean {
  const until = state.events.meetingUntilMs;
  return until !== null && state.mission.timeInDayMs < until;
}

export function isCoffeeBroken(state: GameState): boolean {
  return state.events.coffeeBrokenDay === state.mission.day;
}
