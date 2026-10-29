import type { BalanceConfig } from '../domain/config';
import { termsFromTemplate } from '../domain/contractBoard';
import type { ContractTemplate } from '../domain/content/contracts';
import { personById } from '../domain/content/people';
import {
  PROLOGUE_FIRST_CONTRACT,
  PROLOGUE_FURNITURE,
  PROLOGUE_HELPER_ID,
  PROLOGUE_OWNER,
  PROLOGUE_SECOND_CONTRACT,
  PROLOGUE_STARTING_CASH,
} from '../domain/content/prologue';
import type { Offer, ReadonlyProject } from '../domain/contracts';
import { MAX_ENERGY, SATISFACTION_SCALE, type Candidate, type Employee } from '../domain/employees';
import type { Furniture, FurnitureId } from '../domain/furniture';
import { allocateId, type IdSequence } from '../domain/ids';
import { reached, type PrologueStep } from '../domain/prologue';
import { createInitialState, type GameState } from '../domain/state';
import type { Command } from './commands';
import { registerWageDue } from './finance';
import { addEmployeeAgent, freeDeskCount } from './staff';

// Prolog: osobna scena startowa na obecnych regułach gry. Silnik pilnuje trzech rzeczy:
// kolejnych kroków (wynikają z wykonanych działań), stopniowego udostępniania poleceń
// i stałej oferty prologu — tablica zleceń i rynek kandydatów nie są tu losowane.

// Start prologu: Janusz przy jedynym stanowisku, jedno zlecenie i jeden kandydat (na razie
// niedostępny). Pozostałe elementy stanu jak na starcie właściwej misji.
export function createPrologueState(config: BalanceConfig, seed: number): GameState {
  const base = createInitialState(config, seed);
  let ids: IdSequence = { ...base.ids, furniture: 0 };
  const furniture: Record<FurnitureId, Furniture> = {};
  for (const placement of PROLOGUE_FURNITURE) {
    const allocated = allocateId(ids, 'furniture');
    ids = allocated.sequence;
    furniture[allocated.id] = { ...placement, id: allocated.id };
  }
  const desk = Object.values(furniture).find((item) => item.type === 'desk');

  const allocated = allocateId(ids, 'employee');
  ids = allocated.sequence;
  const owner: Employee = {
    id: allocated.id,
    personId: PROLOGUE_OWNER.id,
    name: PROLOGUE_OWNER.name,
    specialization: PROLOGUE_OWNER.specialization,
    seniority: PROLOGUE_OWNER.seniority,
    dailyWage: config.staff.dailyWage[PROLOGUE_OWNER.seniority],
    hiredOnDay: base.mission.day,
    deskId: desk?.id ?? null,
    projectId: null,
    energy: MAX_ENERGY,
    satisfaction: config.satisfaction.neutral * SATISFACTION_SCALE,
    badConditionsMs: 0,
    lowSatisfactionMs: 0,
    breakHold: false,
    orderedRest: false,
  };

  const start: GameState = {
    ...base,
    finance: { ...base.finance, openingCash: PROLOGUE_STARTING_CASH, cash: PROLOGUE_STARTING_CASH },
    contracts: { ...base.contracts, offers: [] },
    staff: { ...base.staff, employees: { [owner.id]: owner }, candidates: [] },
    world: { ...base.world, furniture },
    prologue: { step: 'acceptFirst' },
    ids,
  };
  const withOwner = addEmployeeAgent(
    registerWageDue(start, owner.id, owner.dailyWage),
    owner,
    config,
  );
  if (!withOwner) throw new Error('Brak miejsca przy wejściu dla właściciela');
  return advancePrologue(withOwner, config);
}

// Polecenia niedostępne na bieżącym etapie prologu (widoczne w interfejsie jako zablokowane).
export function isLockedInPrologue(state: GameState, command: Command): boolean {
  const { prologue } = state;
  if (!prologue) return false;
  if (prologue.step === 'finished') return !(command.type === 'SetSpeed' && command.speed === 0);
  switch (command.type) {
    // Tempo gry dopiero wtedy, gdy Janusz ma co robić; pauza zawsze.
    case 'SetSpeed':
      return command.speed !== 0 && !reached(prologue, 'deliverFirst');
    case 'AssignProject':
      return !reached(prologue, 'assignOwner');
    case 'HireCandidate':
      return !reached(prologue, 'hireHelper');
    // Ze sklepu tylko stanowisko pracy; przestawianie od etapu urządzania.
    case 'BuyFurniture':
      return !reached(prologue, 'buyDesk') || command.furnitureType !== 'desk';
    case 'MoveFurniture':
      return !reached(prologue, 'buyDesk');
    case 'SellFurniture':
    case 'FireEmployee':
      return true;
    default:
      return false;
  }
}

export function prologueProject(
  state: GameState,
  template: ContractTemplate,
): ReadonlyProject | undefined {
  return Object.values(state.contracts.projects).find((p) => p.templateId === template.id);
}

export function prologueOwner(state: GameState): Employee | undefined {
  return Object.values(state.staff.employees).find((e) => e.personId === PROLOGUE_OWNER.id);
}

export function prologueHelper(state: GameState): Employee | undefined {
  return Object.values(state.staff.employees).find((e) => e.personId === PROLOGUE_HELPER_ID);
}

// Czy bieżący krok jest wykonany. Każdy warunek opiera się wyłącznie na stanie gry.
function isStepDone(state: GameState, step: PrologueStep): boolean {
  const first = prologueProject(state, PROLOGUE_FIRST_CONTRACT);
  const second = prologueProject(state, PROLOGUE_SECOND_CONTRACT);
  const owner = prologueOwner(state);
  const helper = prologueHelper(state);
  switch (step) {
    case 'acceptFirst':
      return first !== undefined;
    case 'assignOwner':
      return first !== undefined && owner?.projectId === first.id;
    // Projekt oddany — zapłata zgodnie z obecnym rozliczaniem oddania.
    case 'deliverFirst':
      return first?.status === 'delivered';
    // Dodatkowe stanowisko ustawione (zakup przeszedł walidację ustawienia) i wolne.
    case 'buyDesk': {
      const desks = Object.values(state.world.furniture).filter((f) => f.type === 'desk').length;
      return desks >= 2 && freeDeskCount(state) > 0;
    }
    case 'hireHelper':
      return helper !== undefined;
    case 'acceptSecond':
      return second !== undefined;
    case 'assignTeam':
      return (
        second !== undefined && owner?.projectId === second.id && helper?.projectId === second.id
      );
    // Oddanie wymaga ukończenia backendu, a backend robi tylko Paweł — więc rzeczywiście
    // pracował przy projekcie.
    case 'deliverSecond':
      return second?.status === 'delivered';
    case 'finished':
      return false;
  }
}

const NEXT_STEP: Record<PrologueStep, PrologueStep> = {
  acceptFirst: 'assignOwner',
  assignOwner: 'deliverFirst',
  deliverFirst: 'buyDesk',
  buyDesk: 'hireHelper',
  hireHelper: 'acceptSecond',
  acceptSecond: 'assignTeam',
  assignTeam: 'deliverSecond',
  deliverSecond: 'finished',
  finished: 'finished',
};

// Po każdym poleceniu i kroku symulacji: przejścia między krokami prologu oraz jego stała oferta.
// Bez zmian zwraca ten sam obiekt stanu (silnik nie powiadamia wtedy subskrybentów).
export function advancePrologue(state: GameState, config: BalanceConfig): GameState {
  if (!state.prologue) return state;
  let step = state.prologue.step;
  while (step !== 'finished' && isStepDone(state, step)) step = NEXT_STEP[step];

  let next = state;
  if (step !== state.prologue.step) {
    next = { ...next, prologue: { step } };
    // Komunikat końcowy zatrzymuje grę.
    if (step === 'finished' && next.mission.speed !== 0) {
      next = { ...next, mission: { ...next.mission, speed: 0 } };
    }
  }
  next = keepOffers(next, step, config);
  next = keepCandidates(next, config);
  // Prolog nie ma zdarzeń losowych — komentarze „Z życia biura” nie zatrzymują pracy.
  if (next.events.scheduledAtMs !== null) {
    next = { ...next, events: { ...next.events, scheduledAtMs: null } };
  }
  return next;
}

// Tablica zleceń prologu: dokładnie oferta bieżącego kroku (uzupełnianie tablicy następnego
// dnia nie dokłada losowych zleceń).
function keepOffers(state: GameState, step: PrologueStep, config: BalanceConfig): GameState {
  const wanted: ContractTemplate[] = [];
  if (step === 'acceptFirst') wanted.push(PROLOGUE_FIRST_CONTRACT);
  if (step === 'acceptSecond') wanted.push(PROLOGUE_SECOND_CONTRACT);
  const { offers } = state.contracts;
  const kept = offers.filter((offer) => wanted.some((t) => t.id === offer.templateId));
  const missing = wanted.filter((t) => !kept.some((offer) => offer.templateId === t.id));
  if (kept.length === offers.length && missing.length === 0) return state;

  let { ids } = state;
  const added: Offer[] = missing.map((template) => {
    const allocated = allocateId(ids, 'offer');
    ids = allocated.sequence;
    return { id: allocated.id, ...termsFromTemplate(template, config) };
  });
  return { ...state, ids, contracts: { ...state.contracts, offers: [...kept, ...added] } };
}

// Rynek kandydatów prologu: tylko Paweł, dopóki nie dołączy (ani nie odejdzie z firmy).
function keepCandidates(state: GameState, config: BalanceConfig): GameState {
  const { candidates, employees, departures } = state.staff;
  const person = personById(PROLOGUE_HELPER_ID);
  const unavailable =
    !person ||
    Object.values(employees).some((e) => e.personId === PROLOGUE_HELPER_ID) ||
    departures.some((d) => d.personId === PROLOGUE_HELPER_ID);
  const kept = unavailable ? [] : candidates.filter((c) => c.personId === PROLOGUE_HELPER_ID);
  const missing = !unavailable && kept.length === 0;
  if (kept.length === candidates.length && !missing) return state;

  let { ids } = state;
  const added: Candidate[] = [];
  if (missing && person) {
    const allocated = allocateId(ids, 'candidate');
    ids = allocated.sequence;
    added.push({
      id: allocated.id,
      personId: person.id,
      name: person.name,
      specialization: person.specialization,
      seniority: person.seniority,
      dailyWage: config.staff.dailyWage[person.seniority],
    });
  }
  return { ...state, ids, staff: { ...state.staff, candidates: [...kept, ...added] } };
}
