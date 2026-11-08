import { expect } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import {
  POINT_SCALE,
  TECH_SPECIALIZATIONS,
  type Fragment,
  type ProjectId,
} from '../domain/contracts';
import type { GameState } from '../domain/state';
import { beginChapterTwo } from '../simulation/chapters';
import { createEngine, type Engine } from '../simulation/engine';
import { recordOperation } from '../simulation/finance';
import { wonChapterOne } from './chapterFixture';

// Rozdział 2 gotowy do Scruma (SH-054): biurka z magazynu i jedno dokupione, Scrum Master
// (senior) z biurkiem, stół konferencyjny w salce. Dzień trwa (9:00, pauza).
export function readyChapterTwo(options: { scrumMaster?: boolean; table?: boolean } = {}): Engine {
  const start = beginChapterTwo(wonChapterOne(), DEFAULT_BALANCE);
  if (!start.ok) throw new Error(start.code);
  // Zapas gotówki — scenariusze Scruma nie zależą od finansów (bez ryzyka bankructwa).
  const funded = recordOperation(start.state, {
    key: 'event:test-cash',
    kind: 'event',
    amount: 100_000,
  });
  if (!funded.ok) throw new Error(funded.code);
  const engine = createEngine({ config: DEFAULT_BALANCE, initialState: funded.state });
  const must = (command: Parameters<Engine['dispatch']>[0]) =>
    expect(engine.dispatch(command), JSON.stringify(command)).toEqual({ ok: true });
  for (const x of [1, 5, 9]) {
    must({ type: 'PlaceFromStorage', furnitureType: 'desk', origin: { x, y: 8 }, rotation: 0 });
  }
  if (options.scrumMaster !== false) {
    must({ type: 'BuyFurniture', furnitureType: 'desk', origin: { x: 13, y: 8 }, rotation: 0 });
    const sm = engine
      .getState()
      .staff.candidates.find((c) => c.specialization === 'scrumMaster' && c.seniority === 'senior');
    if (!sm) throw new Error('brak kandydata SM');
    must({ type: 'HireCandidate', candidateId: sm.id });
  }
  if (options.table !== false) {
    must({
      type: 'BuyFurniture',
      furnitureType: 'conferenceTable',
      origin: { x: 9, y: 1 },
      rotation: 90,
    });
  }
  return engine;
}

export function activeProjectId(state: GameState): ProjectId {
  const project = Object.values(state.contracts.projects).find((p) => p.status === 'active');
  if (!project) throw new Error('brak aktywnego projektu');
  return project.id;
}

// Projekt z ukończoną techniką (bez błędów) — gotowy do oddania.
export function withCompletedProject(state: GameState, projectId: ProjectId): GameState {
  const project = state.contracts.projects[projectId];
  if (!project) throw new Error('brak projektu');
  const fragmentPoints = DEFAULT_BALANCE.bugs.fragmentPoints;
  const progress: Partial<Record<(typeof TECH_SPECIALIZATIONS)[number], number>> = {};
  const fragments: Fragment[] = [];
  for (const specialization of TECH_SPECIALIZATIONS) {
    const scope = project.scopes[specialization];
    if (scope === undefined) continue;
    progress[specialization] = scope * POINT_SCALE;
    for (let i = 0; i < scope / fragmentPoints; i++) {
      fragments.push({ specialization, hasBug: false, testProgress: 0, repairProgress: 0 });
    }
  }
  return {
    ...state,
    contracts: {
      ...state.contracts,
      projects: { ...state.contracts.projects, [projectId]: { ...project, progress, fragments } },
    },
  };
}
