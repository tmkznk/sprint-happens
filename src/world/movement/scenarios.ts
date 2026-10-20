import { DEFAULT_BALANCE } from '../../domain/config';
import { createInitialState } from '../../domain/state';
import { OFFICE_LAYOUT } from '../officeLayout';
import { gridFromAscii, gridFromOffice, type Cell, type MovementGrid } from './grid';
import {
  createAgent,
  createMovementState,
  DEFAULT_MOVEMENT_CONFIG,
  type Destination,
  type MovementEnv,
  type MovementState,
  type Task,
} from './movement';

// Powtarzalne scenariusze ruchu (SH-003 → SH-012). Służą jako testy oraz pokaz w przeglądarce
// (`?scene=movement&scenario=<nazwa>`). Oczekiwany wynik opisuje `expect`.
export type Scenario = {
  name: string;
  description: string;
  env: MovementEnv;
  initial: MovementState;
  expect: 'allArrive' | 'deadlockRecognized';
  maxSteps: number;
};

type AgentSpec = { id: string; tasks: (points: Record<string, Cell>) => Task[] };

function fromAscii(
  name: string,
  description: string,
  rows: string[],
  agents: AgentSpec[],
  options: { destinations?: string[]; expect?: Scenario['expect']; maxSteps?: number } = {},
): Scenario {
  const { grid, points } = gridFromAscii(rows);
  return build(name, description, grid, points, agents, options);
}

function build(
  name: string,
  description: string,
  grid: MovementGrid,
  points: Record<string, Cell>,
  agents: AgentSpec[],
  options: { destinations?: string[]; expect?: Scenario['expect']; maxSteps?: number },
): Scenario {
  const point = (key: string) => {
    const cell = points[key];
    if (!cell) throw new Error(`Scenariusz ${name}: brak punktu ${key}`);
    return cell;
  };
  const destinations: Destination[] = (options.destinations ?? []).map((id) => ({
    id,
    cell: point(id),
  }));
  return {
    name,
    description,
    env: { grid, destinations, config: DEFAULT_MOVEMENT_CONFIG },
    initial: createMovementState(
      agents.map((spec) => createAgent(spec.id, point(spec.id), spec.tasks(points))),
    ),
    expect: options.expect ?? 'allArrive',
    maxSteps: options.maxSteps ?? 600,
  };
}

const goTo =
  (key: string) =>
  (points: Record<string, Cell>): Task[] => {
    const cell = points[key];
    if (!cell) throw new Error(`Brak punktu ${key}`);
    return [{ kind: 'goTo', cell }];
  };

const useThenGoTo =
  (destinationIds: string[], steps: number, key: string) =>
  (points: Record<string, Cell>): Task[] => [
    { kind: 'use', destinationIds, steps },
    ...goTo(key)(points),
  ];

// Litery wielkie to starty postaci, małe — ich cele; cyfry to miejsca korzystania.
export const SCENARIOS: readonly Scenario[] = [
  fromAscii(
    'door',
    'Dwie osoby w wąskich drzwiach przechodzą kolejno, bez zamiany polami.',
    ['###########', '#b...#....#', '#A.......B#', '#....#...a#', '###########'],
    [
      { id: 'A', tasks: goTo('a') },
      { id: 'B', tasks: goTo('b') },
    ],
  ),
  fromAscii(
    'corridor',
    'Spotkanie w korytarzu szerokości jednego pola: jedna osoba ustępuje do zatoczki.',
    ['###########', '#Ab.....aB#', '####.######', '###########'],
    [
      { id: 'A', tasks: goTo('a') },
      { id: 'B', tasks: goTo('b') },
    ],
  ),
  fromAscii(
    'three',
    'Trzy osoby i wąskie przejście: dwie na wschód, jedna na zachód.',
    ['#############', '#..c#####a..#', '#A.........b#', '#B..#####.C.#', '#############'],
    [
      { id: 'A', tasks: goTo('a') },
      { id: 'B', tasks: goTo('b') },
      { id: 'C', tasks: goTo('c') },
    ],
  ),
  fromAscii(
    'deadEnd',
    'Ślepy zaułek: osoba w środku wychodzi, druga wchodzi na jego koniec.',
    ['########', '#A...b.#', '#......#', '#.######', '#....Ba#', '########'],
    [
      { id: 'A', tasks: goTo('a') },
      { id: 'B', tasks: goTo('b') },
    ],
  ),
  fromAscii(
    'coffee',
    'Ekspres: jedna osoba korzysta, pozostałe czekają w kolejce zgłoszeń; brak odstępu między kawami.',
    ['#########', '#A.....1#', '#B......#', '#C......#', '#a.b.c..#', '#########'],
    [
      { id: 'A', tasks: useThenGoTo(['1'], 10, 'a') },
      { id: 'B', tasks: useThenGoTo(['1'], 10, 'b') },
      { id: 'C', tasks: useThenGoTo(['1'], 10, 'c') },
    ],
    { destinations: ['1'] },
  ),
  fromAscii(
    'sofa',
    'Kanapa: dwa osobne miejsca nie są rezerwowane podwójnie; trzecia osoba czeka.',
    ['#########', '#A..1.2.#', '#B......#', '#C......#', '#a.b.c..#', '#########'],
    [
      { id: 'A', tasks: useThenGoTo(['1', '2'], 20, 'a') },
      { id: 'B', tasks: useThenGoTo(['1', '2'], 20, 'b') },
      { id: 'C', tasks: useThenGoTo(['1', '2'], 20, 'c') },
    ],
    { destinations: ['1', '2'] },
  ),
  fromAscii(
    'rotation',
    'Cykl trzech osób w pokoju 2×2 z jednym wolnym polem.',
    ['####', '#AB#', '#.C#', '####'],
    [
      { id: 'A', tasks: goTo('B') },
      { id: 'B', tasks: goTo('C') },
      { id: 'C', tasks: goTo('A') },
    ],
  ),
  fromAscii(
    'impossible',
    'Dwie osoby w zamkniętym przejściu bez wolnego pola: blokada jest jawnie rozpoznana.',
    ['####', '#AB#', '####'],
    [
      { id: 'A', tasks: goTo('B') },
      { id: 'B', tasks: goTo('A') },
    ],
    { expect: 'deadlockRecognized', maxSteps: 50 },
  ),
  fromAscii(
    'blockedLine',
    'Jedyna droga prowadzi przez cel innej osoby: brak przejścia jest jawnie rozpoznany.',
    ['########', '#A...b.#', '#.######', '#....Ba#', '########'],
    [
      { id: 'A', tasks: goTo('a') },
      { id: 'B', tasks: goTo('b') },
    ],
    { expect: 'deadlockRecognized', maxSteps: 400 },
  ),
  officeScenario(),
];

// Roboczy układ biura: trzy osoby przechodzą przez drzwi między dużym a małym pokojem.
function officeScenario(): Scenario {
  const furniture = Object.values(createInitialState(DEFAULT_BALANCE, 1).world.furniture);
  const points: Record<string, Cell> = {
    A: { x: 9, y: 3 },
    B: { x: 13, y: 3 },
    C: { x: 9, y: 4 },
    a: { x: 15, y: 4 },
    b: { x: 6, y: 6 },
    c: { x: 16, y: 2 },
  };
  return build(
    'office',
    'Biuro: trzy osoby mijają się w drzwiach między dużym a małym pokojem.',
    gridFromOffice(OFFICE_LAYOUT, furniture),
    points,
    [
      { id: 'A', tasks: goTo('a') },
      { id: 'B', tasks: goTo('b') },
      { id: 'C', tasks: goTo('c') },
    ],
    {},
  );
}
