import type { Seniority, Specialization } from '../domain/employees';
import type { AgentStatus } from '../domain/movement';

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

export const money = new Intl.NumberFormat('pl-PL');
