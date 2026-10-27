import { useState } from 'react';
import { useDispatch, useGameSelector } from '../application/engineHooks';
import type { ProjectId } from '../domain/contracts';
import type { EmployeeId } from '../domain/employees';
import { REJECTION_MESSAGES } from './rejectionMessages';

// EMP-05, EMP-07 (Z): przydział zmienia wyłącznie gracz; oddane projekty nie są dostępne.
// Używane w panelu pracownika w biurze i w kafelku zespołu.
export function ProjectSelect({
  employeeId,
  projectId,
}: {
  employeeId: EmployeeId;
  projectId: ProjectId | null;
}) {
  // Klucz zamiast mapy projektów — postęp prac zmienia ją w każdym kroku (T:VIEW-02).
  const activeKey = useGameSelector((state) =>
    Object.values(state.contracts.projects)
      .filter((project) => project.status === 'active')
      .map((project) => `${project.id}\t${project.name}`)
      .join('\n'),
  );
  const isWorking = useGameSelector((state) => state.mission.phase === 'working');
  const dispatch = useDispatch();
  const [message, setMessage] = useState<string | null>(null);
  const active = activeKey
    ? activeKey.split('\n').map((line) => {
        const [id = '', name = ''] = line.split('\t');
        return { id, name };
      })
    : [];

  return (
    <>
      <select
        aria-label="Projekt"
        value={projectId ?? ''}
        disabled={!isWorking}
        onChange={(event) => {
          const value = event.target.value;
          const result = dispatch({
            type: 'AssignProject',
            employeeId,
            projectId: value === '' ? null : (value as ProjectId),
          });
          setMessage(result.ok ? null : REJECTION_MESSAGES[result.rejection.code]);
        }}
      >
        <option value="">Bez przydziału</option>
        {active.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      {message && <span className="warning">{message}</span>}
    </>
  );
}
