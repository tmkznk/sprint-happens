import type { BalanceConfig } from '../domain/config';
import { FURNITURE_CATALOG, type Furniture, type Rotation } from '../domain/furniture';
import type { GridPoint } from '../domain/grid';
import type { ReadonlyAgent } from '../domain/movement';
import type { GameState } from '../domain/state';
import { isTesting } from '../simulation/qa';
import { isWorking } from '../simulation/work';
import { interactionCells } from '../world/geometry';
import { isSmokingSpotId } from '../world/movement/officeEnv';
import { cellKindAt, officeLayoutOf } from '../world/officeLayout';
import { displayPosition } from './agentPosition';
import { depthOfFootprint, depthOfPoint, ROOM_FRONT_DEPTH } from './projection';

// Poza postaci w biurze — wyłącznie prezentacja (T:TIME-T02): co postać robi i gdzie ją narysować.
// Pozycja logiczna w silniku się nie zmienia; siedząca postać jest tylko rysowana na siedzisku.

export type Facing = 'px' | 'py' | 'nx' | 'ny';
export type PoseKind = 'idle' | 'walk' | 'sitChair' | 'typing' | 'sitSofa' | 'coffee' | 'smoke';

export type AgentPose = {
  kind: PoseKind;
  // null — bez zmiany (postać stoi zwrócona tak, jak szła).
  facing: Facing | null;
  position: GridPoint;
  depth: number;
  // Widoczność sprite'a: 0 za wysoką ścianą na dojściu, 1 poza nim (`outdoorAlpha`).
  alpha: number;
};

// Strona punktów korzystania mebla (przód) dla obrotu: przy 0° to +y siatki (T:ART-03).
const FRONT: Record<Rotation, Facing> = { 0: 'py', 90: 'nx', 180: 'ny', 270: 'px' };
const OPPOSITE: Record<Facing, Facing> = { px: 'nx', nx: 'px', py: 'ny', ny: 'py' };

// Miejsca siedzące w footprincie przy obrocie 0° (kafle, ciągłe współrzędne) — zgodne
// z kompozycją renderu (tools/furniture-render/furniture.mjs, skala 0,75 m/kafel).
export const DESK_SEAT: GridPoint = { x: 1.5 - 0.05 / 0.75, y: 1 + 0.33 / 0.75 };
const DEFAULT_SOFA_SEAT: GridPoint = { x: 0.85, y: 0.85 };
export const SOFA_SEATS: readonly GridPoint[] = [DEFAULT_SOFA_SEAT, { x: 2.15, y: 0.85 }];

// Odstęp głębokości: siedząca postać trafia tuż przed albo tuż za mebel/krzesło.
const SEAT_DEPTH_BIAS = 0.002;

export function frontOf(furniture: Pick<Furniture, 'rotation'>): Facing {
  return FRONT[furniture.rotation];
}

// Obrót punktu w footprincie — ciągła wersja rotateOffset (world/geometry).
export function rotateSeat(point: GridPoint, furniture: Furniture): GridPoint {
  const { width, height } = FURNITURE_CATALOG[furniture.type].footprint;
  const { x, y } = point;
  const local =
    furniture.rotation === 90
      ? { x: height - y, y: x }
      : furniture.rotation === 180
        ? { x: width - x, y: height - y }
        : furniture.rotation === 270
          ? { x: y, y: width - x }
          : { x, y };
  return { x: furniture.origin.x + local.x, y: furniture.origin.y + local.y };
}

export function deskSeat(desk: Furniture): GridPoint {
  return rotateSeat(DESK_SEAT, desk);
}

// Głębokość krzesła biurka — osobny obrazek, żeby siedząca postać była między krzesłem a blatem.
export function deskChairDepth(desk: Furniture): number {
  return depthOfPoint(deskSeat(desk));
}

function footprintDepth(furniture: Furniture): number {
  const { width, height } = FURNITURE_CATALOG[furniture.type].footprint;
  const size =
    furniture.rotation === 90 || furniture.rotation === 270
      ? { width: height, height: width }
      : { width, height };
  return depthOfFootprint(furniture.origin, size);
}

// Przód zwrócony do kamery (+x albo +y) — postać siedzi przed oparciem i rysuje się nad meblem.
function facesCamera(facing: Facing): boolean {
  return facing === 'px' || facing === 'py';
}

function facingOf(from: GridPoint, to: GridPoint): Facing {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'px' : 'nx';
  return dy >= 0 ? 'py' : 'ny';
}

// Odsłonięcie postaci przy wyjściu zza końca wysokiej ściany x = 0 (ściana leży w warstwie pod
// sprite'ami, więc nie zasłoni ich sama): liczy się kolumna ekranu y − x względem końca ściany.
const WALL_END_SCREEN = 15;
const WALL_END_FADE = 0.5;

export function outdoorAlpha(point: GridPoint): number {
  if (point.y >= WALL_END_SCREEN || point.x >= 0.5) return 1;
  const reveal = (point.y - point.x - WALL_END_SCREEN) / WALL_END_FADE;
  return Math.min(Math.max(reveal, 0), 1);
}

// Sprite'y i warstwa przednia to jedna kolejka głębokości: kto stoi na zewnątrz, jest przed
// niskimi ścianami, a nie za nimi.
export function agentPose(
  state: GameState,
  agent: ReadonlyAgent,
  frameAlpha: number,
  config: BalanceConfig,
): AgentPose {
  const pose = basePose(state, agent, frameAlpha, config);
  const cell = { x: Math.floor(pose.position.x), y: Math.floor(pose.position.y) };
  return {
    ...pose,
    alpha: outdoorAlpha(pose.position),
    depth:
      cellKindAt(officeLayoutOf(state), cell) === 'outdoor'
        ? ROOM_FRONT_DEPTH + pose.depth
        : pose.depth,
  };
}

function basePose(
  state: GameState,
  agent: ReadonlyAgent,
  alpha: number,
  config: BalanceConfig,
): Omit<AgentPose, 'alpha'> {
  const position = displayPosition(agent, alpha, config.movement.stepsPerCell);
  if (agent.move) {
    return {
      kind: 'walk',
      facing: facingOf(agent.cell, agent.move.to),
      position,
      depth: depthOfPoint(position),
    };
  }

  // Kanapa i ekspres: postać korzysta z zarezerwowanego miejsca (`meblel#indeks`).
  if (agent.status === 'using' && agent.reservedDestination) {
    if (isSmokingSpotId(agent.reservedDestination)) {
      return { kind: 'smoke', facing: 'py', position, depth: depthOfPoint(position) };
    }
    const [furnitureId, index] = agent.reservedDestination.split('#');
    const furniture = state.world.furniture[furnitureId as Furniture['id']];
    if (furniture?.type === 'sofa') {
      const seat = rotateSeat(SOFA_SEATS[Number(index)] ?? DEFAULT_SOFA_SEAT, furniture);
      const facing = frontOf(furniture);
      const bias = facesCamera(facing) ? SEAT_DEPTH_BIAS : -SEAT_DEPTH_BIAS;
      return { kind: 'sitSofa', facing, position: seat, depth: footprintDepth(furniture) + bias };
    }
    if (furniture?.type === 'coffeeMachine') {
      return {
        kind: 'coffee',
        facing: OPPOSITE[frontOf(furniture)],
        position,
        depth: depthOfPoint(position),
      };
    }
  }

  // Własne biurko: stojąc w punkcie korzystania, postać siedzi na krześle przodem do blatu.
  const employee = state.staff.employees[agent.id as keyof typeof state.staff.employees];
  const desk = employee?.deskId ? state.world.furniture[employee.deskId] : undefined;
  const deskPoint = desk ? interactionCells(desk)[0] : undefined;
  if (
    employee &&
    desk &&
    deskPoint &&
    agent.cell.x === deskPoint.x &&
    agent.cell.y === deskPoint.y
  ) {
    const seat = deskSeat(desk);
    const chairDepth = depthOfPoint(seat);
    const towardDesk = footprintDepth(desk) > chairDepth ? SEAT_DEPTH_BIAS : -SEAT_DEPTH_BIAS;
    const working = isWorking(state, employee, config) || isTesting(state, employee, config);
    return {
      kind: working ? 'typing' : 'sitChair',
      facing: OPPOSITE[frontOf(desk)],
      position: seat,
      depth: chairDepth + towardDesk,
    };
  }

  return { kind: 'idle', facing: null, position, depth: depthOfPoint(position) };
}
