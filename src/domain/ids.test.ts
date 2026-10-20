import { describe, expect, it } from 'vitest';
import { deepFreeze } from '../test/deepFreeze';
import { allocateId } from './ids';

describe('allocateId', () => {
  it('nadaje kolejne, deterministyczne ID w obrębie rodzaju', () => {
    const first = allocateId({}, 'employee');
    const second = allocateId(first.sequence, 'employee');

    expect(first.id).toBe('employee-1');
    expect(second.id).toBe('employee-2');
  });

  it('prowadzi osobne liczniki dla różnych rodzajów', () => {
    const employee = allocateId({}, 'employee');
    const project = allocateId(employee.sequence, 'project');

    expect(project.id).toBe('project-1');
    expect(project.sequence).toEqual({ employee: 1, project: 1 });
  });

  it('nie mutuje wejściowej sekwencji', () => {
    const sequence = deepFreeze({ employee: 3 });

    expect(allocateId(sequence, 'employee').id).toBe('employee-4');
    expect(sequence).toEqual({ employee: 3 });
  });
});
