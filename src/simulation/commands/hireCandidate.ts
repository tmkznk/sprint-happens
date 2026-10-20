import { generateCandidate, type Employee } from '../../domain/employees';
import { allocateId } from '../../domain/ids';
import { canHire, registerWageDue } from '../finance';
import { addEmployeeAgent, firstFreeDesk } from '../staff';
import { reject, type CommandHandler, type HireCandidateCommand } from './types';

// EMP-03, EMP-04, FIN-03, FIN-08 (Z): natychmiastowe zatrudnienie wybranego kandydata.
// Wymaga salda co najmniej zero; dniówka staje się należna już za dziś. Wolne biurko jest
// przydzielane automatycznie (OFF-04); bez biurka zatrudnienie jest dozwolone (EMP-04).
export const hireCandidate: CommandHandler<HireCandidateCommand> = {
  category: 'workDay',
  execute(state, command, config) {
    const financial = canHire(state);
    if (financial) return reject(financial);
    const candidate = state.staff.candidates.find((c) => c.id === command.candidateId);
    if (!candidate) return reject('unknownCandidate');

    const allocated = allocateId(state.ids, 'employee');
    const employee: Employee = {
      id: allocated.id,
      name: candidate.name,
      specialization: candidate.specialization,
      seniority: candidate.seniority,
      dailyWage: candidate.dailyWage,
      hiredOnDay: state.mission.day,
      deskId: firstFreeDesk(state),
      projectId: null,
    };

    // EMP-03: rynek nie traci specjalisty — na miejsce zatrudnionego wchodzi nowy kandydat.
    const replacement = generateCandidate(
      allocated.sequence,
      state.rng,
      candidate.specialization,
      candidate.seniority,
      config.staff.dailyWage,
    );
    const hired = registerWageDue(
      {
        ...state,
        staff: {
          employees: { ...state.staff.employees, [employee.id]: employee },
          candidates: state.staff.candidates.map((c) =>
            c.id === candidate.id ? replacement.candidate : c,
          ),
        },
        ids: replacement.ids,
        rng: replacement.rng,
      },
      employee.id,
      employee.dailyWage,
    );

    const withAgent = addEmployeeAgent(hired, employee, config);
    return withAgent ? { ok: true, state: withAgent } : reject('noRoomToEnter');
  },
};
