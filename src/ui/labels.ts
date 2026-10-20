import type { Seniority, Specialization } from '../domain/employees';
import type { FurnitureType } from '../domain/furniture';
import type { AgentStatus } from '../domain/movement';
import type { WorkStatus } from '../simulation/assignments';

export const SPECIALIZATION_LABELS: Record<Specialization, string> = {
  frontend: 'Frontend Developer',
  backend: 'Backend Developer',
  mobile: 'Mobile Developer',
  devops: 'DevOps Engineer',
  qa: 'Tester / QA',
  designer: 'Designer',
  pm: 'Project Manager',
};

export const SENIORITY_LABELS: Record<Seniority, string> = {
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
};

// MOVE-08: brak drogi i blokada są wyjaśniane graczowi.
export const AGENT_STATUS_LABELS: Record<AgentStatus, string> = {
  idle: 'Bez zajęcia',
  walking: 'W drodze',
  waiting: 'Czeka na przejście',
  yielding: 'Ustępuje innym',
  queued: 'Czeka w kolejce',
  using: 'Korzysta z wyposażenia',
  arrived: 'Na miejscu',
  noRoute: 'Nie może dojść — brak drogi do celu',
  deadlocked: 'Zablokowany — nie ma jak przejść obok innych',
};

export const FURNITURE_NAMES: Record<FurnitureType, string> = {
  desk: 'Stanowisko pracy',
  sofa: 'Kanapa',
  coffeeMachine: 'Ekspres do kawy',
};

// EMP-07 (Z): interfejs sygnalizuje brak pracy.
export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  noAssignment: 'Brak przydziału do projektu',
  noDesk: 'Brak biurka — nie może pracować',
  noWorkForRole: 'Projekt nie ma pracy dla tej roli',
  scopeDone: 'Swoja część ukończona — brak pracy',
  ready: 'Gotowy do pracy nad projektem',
};

export const money = new Intl.NumberFormat('pl-PL');
