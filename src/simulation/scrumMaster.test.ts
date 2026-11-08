import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../domain/config';
import { SENIORITIES } from '../domain/employees';
import type { GameState } from '../domain/state';
import { createInitialState } from '../domain/state';
import { wonChapterOne } from '../test/chapterFixture';
import { beginChapterTwo } from './chapters';
import { createEngine } from './engine';
import { scrumMasterOf } from './scrum';

// SH-053: Scrum Master — rola tylko w rozdziale 2, jeden na firmę, bez przydziału do projektu.
function chapterTwo(): GameState {
  const result = beginChapterTwo(wonChapterOne(), DEFAULT_BALANCE);
  if (!result.ok) throw new Error(result.code);
  return result.state;
}

const smCandidates = (state: GameState) =>
  state.staff.candidates.filter((c) => c.specialization === 'scrumMaster');

describe('Scrum Master (SH-053)', () => {
  it('rynek rozdziału 1 nie ma Scrum Mastera', () => {
    expect(smCandidates(createInitialState(DEFAULT_BALANCE, 7))).toEqual([]);
  });

  it('rynek rozdziału 2 ma Scrum Mastera w każdym seniority', () => {
    expect(
      smCandidates(chapterTwo())
        .map((c) => c.seniority)
        .sort(),
    ).toEqual([...SENIORITIES].sort());
  });

  it('drugiego Scrum Mastera nie można zatrudnić', () => {
    const engine = createEngine({ config: DEFAULT_BALANCE, initialState: chapterTwo() });
    const [first, second] = smCandidates(engine.getState());
    if (!first || !second) throw new Error('brak kandydatów SM');
    expect(engine.dispatch({ type: 'HireCandidate', candidateId: first.id })).toEqual({ ok: true });
    expect(scrumMasterOf(engine.getState())?.personId).toBe(first.personId);
    const before = engine.getState();
    const again = smCandidates(before).find((c) => c.id === second.id) ?? smCandidates(before)[0];
    if (!again) throw new Error('brak kandydata SM po zatrudnieniu');
    expect(engine.dispatch({ type: 'HireCandidate', candidateId: again.id })).toEqual({
      ok: false,
      rejection: { code: 'scrumMasterExists' },
    });
    expect(engine.getState()).toBe(before);
  });

  it('Scrum Mastera nie można przydzielić do projektu', () => {
    const engine = createEngine({ config: DEFAULT_BALANCE, initialState: chapterTwo() });
    const [candidate] = smCandidates(engine.getState());
    if (!candidate) throw new Error('brak kandydata SM');
    engine.dispatch({ type: 'HireCandidate', candidateId: candidate.id });
    const sm = scrumMasterOf(engine.getState());
    const project = Object.values(engine.getState().contracts.projects)[0];
    if (!sm || !project) throw new Error('setup');
    const before = engine.getState();
    expect(
      engine.dispatch({ type: 'AssignProject', employeeId: sm.id, projectId: project.id }),
    ).toEqual({ ok: false, rejection: { code: 'notAssignable' } });
    expect(engine.getState()).toBe(before);
  });
});
