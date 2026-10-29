import { PROLOGUE_FIRST_CONTRACT, PROLOGUE_SECOND_CONTRACT } from '../../domain/content/prologue';
import type { ProjectId } from '../../domain/contracts';
import type { EmployeeId } from '../../domain/employees';
import { reached } from '../../domain/prologue';
import type { GameState } from '../../domain/state';
import { isReadyForDelivery } from '../../simulation/delivery';
import { prologueHelper, prologueOwner, prologueProject } from '../../simulation/prologue';
import type { Tab } from '../navigation';
import { LOCKS, NEWS } from './copy';

// Wskazówka prologu: najbliższa czynność gracza. Interfejs podświetla element, który ją wykonuje
// (oraz zakładkę, w której się znajduje). Wynika wyłącznie ze stanu gry i trybu urządzania.
export type GuideAction =
  | { kind: 'acceptOffer' }
  | { kind: 'assign'; employeeIds: EmployeeId[] }
  | { kind: 'resume' }
  | { kind: 'deliver'; projectId: ProjectId }
  | { kind: 'settle' }
  | { kind: 'nextDay' }
  | { kind: 'buyDesk' }
  | { kind: 'placeDesk' }
  | { kind: 'hire' };

export function guideAction(state: GameState, editing: boolean): GuideAction | null {
  const step = state.prologue?.step;
  if (!step || step === 'finished') return null;
  const { phase, speed } = state.mission;
  if (phase === 'settled') return { kind: 'nextDay' };

  const second = reached({ step }, 'acceptSecond');
  const project = prologueProject(
    state,
    second ? PROLOGUE_SECOND_CONTRACT : PROLOGUE_FIRST_CONTRACT,
  );
  const delivering = step === 'deliverFirst' || step === 'deliverSecond';
  if (delivering && project && isReadyForDelivery(project)) {
    return { kind: 'deliver', projectId: project.id };
  }
  if (phase === 'workEnded') return { kind: 'settle' };
  // Przyjście i wyjście (TIME-02): poza wznowieniem zegara nie ma czynności do wykonania —
  // pozostałe wymagają dnia pracy.
  if (phase === 'arriving' || phase === 'leaving') return speed === 0 ? { kind: 'resume' } : null;

  // Osoby, które mają pracować przy projekcie bieżącego etapu, a nie są do niego przypisane.
  const crew = [prologueOwner(state), ...(second ? [prologueHelper(state)] : [])];
  const unassigned = project
    ? crew.flatMap((e) => (e && e.projectId !== project.id ? [e.id] : []))
    : [];

  switch (step) {
    case 'acceptFirst':
    case 'acceptSecond':
      return { kind: 'acceptOffer' };
    case 'assignOwner':
    case 'assignTeam':
    case 'deliverFirst':
    case 'deliverSecond':
      if (unassigned.length > 0) return { kind: 'assign', employeeIds: unassigned };
      return speed === 0 ? { kind: 'resume' } : null;
    case 'buyDesk':
      return editing ? { kind: 'placeDesk' } : { kind: 'buyDesk' };
    case 'hireHelper':
      return { kind: 'hire' };
  }
}

// Zakładka, w której wykonuje się czynność.
export const ACTION_TAB: Record<GuideAction['kind'], Tab> = {
  acceptOffer: 'projects',
  assign: 'team',
  resume: 'office',
  deliver: 'projects',
  settle: 'office',
  nextDay: 'office',
  buyDesk: 'furnish',
  placeDesk: 'office',
  hire: 'recruit',
};

// Zakładka dolnej nawigacji do podświetlenia: ta, w której czeka czynność, jeśli gracz jest gdzie
// indziej (Rekrutacja otwiera się z zakładki Zespół). Okno raportu dnia przykrywa wszystko.
export function navTarget(action: GuideAction | null, tab: Tab): Tab | null {
  if (!action || action.kind === 'nextDay') return null;
  const target = ACTION_TAB[action.kind];
  if (target === tab) return null;
  if (target === 'recruit') return tab === 'team' ? null : 'team';
  return target;
}

// Zakładki zablokowane na bieżącym etapie — z wyjaśnieniem warunku dostępu.
export function tabLock(state: GameState, tab: Tab): string | null {
  const { prologue } = state;
  if (!prologue) return null;
  switch (tab) {
    case 'team':
      return reached(prologue, 'assignOwner') ? null : LOCKS.team;
    case 'recruit':
      return reached(prologue, 'hireHelper') ? null : LOCKS.recruit;
    case 'furnish':
      return reached(prologue, 'buyDesk') ? null : LOCKS.furnish;
    case 'finance':
      return reached(prologue, 'buyDesk') ? null : LOCKS.finance;
    default:
      return null;
  }
}

// „Z życia biura” w prologu: komentarz bieżącego etapu; kilka — na zmianę co minutę gry.
export function prologueNews(state: GameState): string | null {
  const step = state.prologue?.step;
  if (!step) return null;
  const lines = NEWS[step];
  return lines[Math.floor(state.mission.timeInDayMs / 60_000) % lines.length] ?? null;
}
