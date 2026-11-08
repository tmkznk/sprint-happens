import type { BalanceConfig } from '../domain/config';
import { FURNITURE_CATALOG, type Furniture, type Rotation } from '../domain/furniture';
import type { GridPoint } from '../domain/grid';
import type { ReadonlyAgent } from '../domain/movement';
import type { GameState } from '../domain/state';
import { isTesting } from '../simulation/qa';
import { isWorking } from '../simulation/work';
import { interactionCells } from '../world/geometry';
import { isSmokingSpotId } from '../world/movement/officeEnv';
import { cellKindAt, officeLayoutOf, type OfficeLayout } from '../world/officeLayout';
import { displayPosition } from './agentPosition';
import { depthOfFootprint, depthOfPoint, gridToScreen, ROOM_FRONT_DEPTH } from './projection';

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
  // Widoczność sprite'a: 0, gdy cała postać jest za wysoką ścianą (`wallVisibility`).
  alpha: number;
  // Za wysoką ścianą: prostokąt widoczności (otwór drzwi albo obszar zza końca ściany).
  clip: ScreenClip | null;
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

// SH-052: stół konferencyjny — krzesło na każdym polu miejsca siedzącego, przodem do stołu.
// Obrazek krzesła przy obrocie 0° jest przodem do −y siatki (kompozycja w
// tools/furniture-render/furniture.mjs: Chair_2 obrócone o 180°, model −y = siatka +y); obrót
// mebla o 90° (render: rotation.y = −90°) obraca kierunek −y → +x.
const CHAIR_ROTATION: Record<Facing, Rotation> = { ny: 0, px: 90, py: 180, nx: 270 };

function tableCenter(table: Furniture): GridPoint {
  const { width, height } = FURNITURE_CATALOG[table.type].footprint;
  const turned = table.rotation === 90 || table.rotation === 270;
  return {
    x: table.origin.x + (turned ? height : width) / 2,
    y: table.origin.y + (turned ? width : height) / 2,
  };
}

const cellCenter = (cell: GridPoint): GridPoint => ({ x: cell.x + 0.5, y: cell.y + 0.5 });

export type ConferenceChair = { cell: GridPoint; rotation: Rotation; depth: number };

export function conferenceChairs(table: Furniture): ConferenceChair[] {
  const center = tableCenter(table);
  return interactionCells(table).map((cell) => ({
    cell,
    rotation: CHAIR_ROTATION[facingOf(cellCenter(cell), center)],
    depth: depthOfPoint(cellCenter(cell)),
  }));
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

// Wysoka ściana x = 0 z drzwiami wejściowymi leży w warstwie pod sprite'ami, więc sama nie zasłoni
// postaci za nią. Geometria z renderu pomieszczenia (tools/furniture-render/rooms.mjs): tafla
// x 0,39…0,61, ściana sięga do y = (ostatni rząd siatki) + 0,61; prześwit drzwi wyznacza
// ościeżnica `Door_Frame` powiększona w pionie ×1,14 (światło 1,0 m × 2,30 m, głębokość ±0,112 m
// od środka ściany x = 0,5) — postać (do ~1,96 m) mieści się pod nadprożem.
// Postać za licem ościeżnicy widać tylko przez prześwit (przycięcie do niego) albo zza końca
// ściany (przycięcie na jej krawędzi) — bez przezroczystości.
const WALL_BACK_X = 0.39;
const WALL_END_OVERHANG = 0.61;
const FRAME_FRONT_X = 0.5 + 0.112 / 0.75;
const FRAME_BACK_X = 0.5 - 0.112 / 0.75;
const OPENING_HALF = 0.5 / 0.75;
// Wysokość prześwitu w pikselach świata: 2,30 m; pionowe pole w rzucie (elewacja 30°) to
// 32·√2·cos 30° px.
const LINTEL_PX = ((2.02 * 1.14) / 0.75) * 32 * Math.SQRT2 * Math.cos(Math.PI / 6);
// Połowa szerokości głowy w pikselach świata (cięcie pod nadprożem).
const HEAD_HALF_WIDTH = 6;
// Połowa szerokości sylwetki w pikselach świata — mniej znaczy, że za ścianą nic nie widać.
const BODY_HALF_WIDTH = 14;
const COLUMN_PX = gridToScreen({ x: 1, y: 0 }).x;

// Prostokąt widoczności w pikselach świata (poza nim sprite jest przycięty).
export type ScreenClip = { left: number; right: number; top: number };
export type WallVisibility = { alpha: number; clip: ScreenClip | null };
// Ściana z drzwiami wejściowymi: pole drzwi (y) i koniec ściany (y).
export type EntranceWall = { doorY: number; endY: number };

export function entranceWall(layout: OfficeLayout): EntranceWall | null {
  const door = layout.doors.find((d) => d.isEntrance)?.position;
  if (door?.x !== 0) return null;
  return { doorY: door.y, endY: layout.size.height - 1 + WALL_END_OVERHANG };
}

const FULL: WallVisibility = { alpha: 1, clip: null };

export function wallVisibility(point: GridPoint, wall: EntranceWall | null): WallVisibility {
  if (!wall || point.y >= wall.endY || point.x >= FRAME_FRONT_X) return FULL;
  const x = gridToScreen(point).x;
  // Prześwit widoczny przez oba lica ościeżnicy — lewa krawędź z przedniego, prawa z tylnego.
  const middle = wall.doorY + 0.5;
  const left = (FRAME_FRONT_X - (middle + OPENING_HALF)) * COLUMN_PX;
  const right = (FRAME_BACK_X - (middle - OPENING_HALF)) * COLUMN_PX;
  if (x + BODY_HALF_WIDTH > left && x - BODY_HALF_WIDTH < right) {
    // Nadproże zasłania jego przednia krawędź (na ekranie niżej niż tylna). W rzucie opada w lewo,
    // a cięcie jest poziome — wysokość z lewej połowy głowy: głowa nie wchodzi na nadproże
    // i nie zostaje nad nią widoczna szczelina.
    const column = Math.min(Math.max(x - HEAD_HALF_WIDTH, left), right) / COLUMN_PX;
    const top = gridToScreen({ x: FRAME_FRONT_X, y: FRAME_FRONT_X - column }).y - LINTEL_PX;
    return { alpha: 1, clip: { left, right, top } };
  }
  const end = gridToScreen({ x: WALL_BACK_X, y: wall.endY }).x;
  const hidden = x - BODY_HALF_WIDTH >= end;
  return { alpha: hidden ? 0 : 1, clip: { left: -Infinity, right: end, top: -Infinity } };
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
    ...wallVisibility(pose.position, entranceWall(officeLayoutOf(state))),
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
): Omit<AgentPose, 'alpha' | 'clip'> {
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
    if (furniture?.type === 'conferenceTable') {
      const center = tableCenter(furniture);
      // Miejsce stojące: postać stoi przy stole, zwrócona do niego.
      if (index?.startsWith('stand-')) {
        return {
          kind: 'idle',
          facing: facingOf(position, center),
          position,
          depth: depthOfPoint(position),
        };
      }
      const cell = interactionCells(furniture)[Number(index)];
      if (cell) {
        const seat = cellCenter(cell);
        const chairDepth = depthOfPoint(seat);
        const towardTable =
          footprintDepth(furniture) > chairDepth ? SEAT_DEPTH_BIAS : -SEAT_DEPTH_BIAS;
        return {
          kind: 'sitChair',
          facing: facingOf(seat, center),
          position: seat,
          depth: chairDepth + towardTable,
        };
      }
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
