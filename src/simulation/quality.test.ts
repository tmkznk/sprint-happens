import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { POINT_SCALE, type Fragment, type Project, type ProjectId } from '../domain/contracts';
import { testState } from '../test/engineFixture';
import { fragmentSize, repairSize } from './bugs';
import {
  applyReputation,
  daysLate,
  designPermille,
  qualityPermille,
  rateProject,
  technicalScopePoints,
} from './quality';

const SIZE = fragmentSize(DEFAULT_BALANCE);

// Projekt z ukończonym zakresem `scope` pp frontendu i `bugs` nienaprawionymi błędami.
function project(scope: number, bugs: number, patch: Partial<Project> = {}): Project {
  const count = scope / DEFAULT_BALANCE.bugs.fragmentPoints;
  const fragments: Fragment[] = Array.from({ length: count }, (_, i) => ({
    specialization: 'frontend',
    hasBug: i < bugs,
    testProgress: 0,
    repairProgress: 0,
  }));
  return {
    id: 'project-1' as ProjectId,
    templateId: 't',
    name: 'Test',
    description: '',
    scopes: { frontend: scope },
    designImportance: 0,
    designScope: 0,
    deadlineDays: 3,
    reward: 7000,
    advance: 2100,
    latePenaltyPerDay: 700,
    acceptedOnDay: 1,
    deadlineDay: 4,
    status: 'active',
    progress: { frontend: scope * POINT_SCALE },
    fragments,
    fragmentRisk: {},
    priority: 'features',
    designProgress: 0,
    delivery: null,
    ...patch,
  };
}

describe('jakość techniczna (BUG-04, SH-032 B7)', () => {
  it('0 błędów → 1,0; 5 błędów na 100 pp → 0; poniżej zera nie schodzi', () => {
    expect(qualityPermille(project(100, 0), DEFAULT_BALANCE)).toBe(1000);
    expect(qualityPermille(project(100, 3), DEFAULT_BALANCE)).toBe(400);
    expect(qualityPermille(project(100, 5), DEFAULT_BALANCE)).toBe(0);
    expect(qualityPermille(project(100, 8), DEFAULT_BALANCE)).toBe(0);
  });

  it('ta sama liczba błędów mniej szkodzi większemu projektowi', () => {
    const small = qualityPermille(project(40, 2), DEFAULT_BALANCE);
    const large = qualityPermille(project(200, 2), DEFAULT_BALANCE);
    expect(small).toBe(0);
    expect(large).toBe(800);
  });

  it('ukryte i wykryte błędy liczą się jednakowo; naprawione nie liczą się wcale', () => {
    const base = project(100, 2);
    const detected = {
      ...base,
      fragments: base.fragments.map((f) => ({ ...f, testProgress: SIZE })),
    };
    const fixed = {
      ...detected,
      fragments: detected.fragments.map((f) => ({
        ...f,
        repairProgress: repairSize(DEFAULT_BALANCE),
      })),
    };
    expect(qualityPermille(detected, DEFAULT_BALANCE)).toBe(qualityPermille(base, DEFAULT_BALANCE));
    expect(qualityPermille(fixed, DEFAULT_BALANCE)).toBe(1000);
  });

  it('zakres techniczny to suma wszystkich specjalizacji', () => {
    expect(technicalScopePoints(project(60, 0, { scopes: { frontend: 60, backend: 40 } }))).toBe(
      100,
    );
  });
});

describe('składniki reputacji (REP-02–04)', () => {
  it('terminowo: +4; oddanie w dniu terminu jest terminowe; spóźnienie −3 za każdy dzień', () => {
    const p = project(100, 0);
    expect(daysLate(p, 4)).toBe(0);
    expect(rateProject(p, 4, DEFAULT_BALANCE).reputation.punctuality).toBe(4);
    expect(daysLate(p, 5)).toBe(1);
    expect(rateProject(p, 6, DEFAULT_BALANCE).reputation.punctuality).toBe(-6);
  });

  it('jakość: round(20 × (jakość − 0,8)) — od −16 do +4', () => {
    expect(rateProject(project(100, 0), 4, DEFAULT_BALANCE).reputation.quality).toBe(4);
    expect(rateProject(project(100, 3), 4, DEFAULT_BALANCE).reputation.quality).toBe(-8);
    expect(rateProject(project(100, 5), 4, DEFAULT_BALANCE).reputation.quality).toBe(-16);
  });

  it('design: proporcjonalnie do ukończenia; brak designu to brak premii, nie kara', () => {
    const half = project(100, 0, {
      designImportance: 4,
      designScope: 80,
      designProgress: 40 * POINT_SCALE,
    });
    expect(designPermille(half)).toBe(500);
    expect(rateProject(half, 4, DEFAULT_BALANCE).reputation.design).toBe(2);

    const unfinished = project(100, 0, { designImportance: 4, designScope: 80 });
    expect(rateProject(unfinished, 4, DEFAULT_BALANCE).reputation.design).toBe(0);
    const none = project(100, 0);
    expect(designPermille(none)).toBe(0);
    expect(rateProject(none, 4, DEFAULT_BALANCE).reputation.design).toBe(0);
  });

  it('suma składników i ograniczenie reputacji do 0–100', () => {
    const rating = rateProject(project(100, 0), 4, DEFAULT_BALANCE);
    expect(rating.reputation.total).toBe(8);
    expect(applyReputation(98, 8)).toBe(100);
    expect(applyReputation(5, -22)).toBe(0);
    expect(applyReputation(50, -3)).toBe(47);
  });

  it('formuły są konfigurowalne', () => {
    const config = {
      ...DEFAULT_BALANCE,
      reputation: { ...DEFAULT_BALANCE.reputation, onTimeBonus: 10, bugsPer100ForZero: 10 },
    };
    expect(rateProject(project(100, 0), 4, config).reputation.punctuality).toBe(10);
    expect(qualityPermille(project(100, 5), config)).toBe(500);
  });

  it('reputacja startowa misji to 50', () => {
    expect(testState().mission.reputation).toBe(50);
  });
});
