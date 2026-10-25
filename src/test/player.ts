import { DEFAULT_BALANCE, type BalanceConfig } from '../domain/config';
import { EVENT_TEMPLATES } from '../domain/content/events';
import type { ProjectId } from '../domain/contracts';
import type { EmployeeId, Seniority, Specialization } from '../domain/employees';
import { ROTATIONS } from '../domain/furniture';
import { createInitialState, type GameState } from '../domain/state';
import type { Command } from '../simulation/commands';
import { createEngine, type Engine } from '../simulation/engine';
import { withTestOffer } from './engineFixture';
import { OFFICE_LAYOUT } from '../world/officeLayout';

// Prosty „gracz” do scenariuszy integracyjnych (SH-042, SH-043): wyłącznie publiczne polecenia
// silnika i kroki symulacji — tak jak interfejs. Każde polecenie musi się udać, chyba że test
// sprawdza odmowę wprost (wtedy używa `engine.dispatch`).
export type Player = {
  engine: Engine;
  config: BalanceConfig;
  state(): GameState;
  must(command: Command): void;
  acceptStarter(): ProjectId;
  hire(specialization: Specialization, seniority: Seniority): EmployeeId;
  assign(employeeId: EmployeeId, projectId: ProjectId | null): void;
  buyDesk(): void;
  // Kroki do spełnienia warunku (zdarzenia rozstrzyga pierwszą odpowiedzią); false — limit.
  runUntil(done: (state: GameState) => boolean, maxSteps?: number): boolean;
  // Do końca dnia pracy, rozliczenie i (jeśli misja trwa) następny dzień.
  finishDay(): void;
  // Jedna deterministyczna akcja gracza albo krok symulacji (do odtwarzania — SH-043):
  // decyzja → wznowienie → krok → rozliczenie → następny dzień. false — misja zakończona.
  tick(): boolean;
};

export function createPlayer(
  config: BalanceConfig = DEFAULT_BALANCE,
  seed = 20261022,
  initialState?: GameState,
): Player {
  const engine = createEngine({
    config,
    initialState: initialState ?? withTestOffer(createInitialState(config, seed)),
  });
  const state = () => engine.getState();
  const must = (command: Command) => {
    const result = engine.dispatch(command);
    if (!result.ok) {
      throw new Error(`${command.type} odrzucone: ${result.rejection.code}`);
    }
  };

  // EVT-02: decyzja trzyma pauzę — scenariusze wybierają pierwszą odpowiedź.
  const resolvePending = () => {
    const pending = state().events.pending;
    if (!pending) return;
    const option = EVENT_TEMPLATES.find((t) => t.id === pending.templateId)?.options[0];
    if (!option) throw new Error(`Brak odpowiedzi na ${pending.templateId}`);
    must({ type: 'ResolveEvent', optionId: option.id });
  };

  const runUntil = (done: (s: GameState) => boolean, maxSteps = 60_000) => {
    for (let i = 0; i < maxSteps; i++) {
      if (done(state())) return true;
      resolvePending();
      const { mission } = state();
      if (mission.status !== 'active' || mission.phase !== 'working') return done(state());
      if (mission.speed === 0) must({ type: 'SetSpeed', speed: 4 });
      engine.step();
    }
    return done(state());
  };

  return {
    engine,
    config,
    state,
    must,
    acceptStarter() {
      const offer = state().contracts.offers[0];
      if (!offer) throw new Error('Brak oferty');
      must({ type: 'AcceptOffer', offerId: offer.id });
      return Object.values(state().contracts.projects).at(-1)?.id as ProjectId;
    },
    hire(specialization, seniority) {
      const candidate = state().staff.candidates.find(
        (c) => c.specialization === specialization && c.seniority === seniority,
      );
      if (!candidate) throw new Error(`Brak kandydata ${specialization}/${seniority}`);
      must({ type: 'HireCandidate', candidateId: candidate.id });
      return Object.values(state().staff.employees).at(-1)?.id as EmployeeId;
    },
    assign(employeeId, projectId) {
      must({ type: 'AssignProject', employeeId, projectId });
    },
    buyDesk() {
      if (state().mission.speed !== 0) must({ type: 'SetSpeed', speed: 0 });
      const { width, height } = OFFICE_LAYOUT.size;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          for (const rotation of ROTATIONS) {
            const result = engine.dispatch({
              type: 'BuyFurniture',
              furnitureType: 'desk',
              origin: { x, y },
              rotation,
            });
            if (result.ok) return;
          }
        }
      }
      throw new Error('Brak miejsca na biurko');
    },
    runUntil,
    tick() {
      const { mission, events } = state();
      if (mission.status !== 'active') return false;
      if (events.pending) resolvePending();
      else if (mission.phase === 'workEnded') must({ type: 'SettleDay' });
      else if (mission.phase === 'settled') must({ type: 'StartNextDay' });
      else if (mission.speed === 0) must({ type: 'SetSpeed', speed: 4 });
      else engine.step();
      return true;
    },
    finishDay() {
      runUntil((s) => s.mission.phase !== 'working' || s.mission.status !== 'active');
      if (state().mission.status !== 'active') return;
      if (state().mission.phase === 'workEnded') must({ type: 'SettleDay' });
      if (state().mission.status === 'active') must({ type: 'StartNextDay' });
    },
  };
}
