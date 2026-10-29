import { fillMarket, MAX_ENERGY, SATISFACTION_SCALE, type Employee } from '../../domain/employees';
import { allocateId } from '../../domain/ids';
import type { GameState } from '../../domain/state';
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
      personId: candidate.personId,
      name: candidate.name,
      specialization: candidate.specialization,
      seniority: candidate.seniority,
      dailyWage: candidate.dailyWage,
      hiredOnDay: state.mission.day,
      deskId: firstFreeDesk(state),
      projectId: null,
      energy: MAX_ENERGY,
      // NEED-03: nowa osoba zaczyna z neutralnym zadowoleniem.
      satisfaction: config.satisfaction.neutral * SATISFACTION_SCALE,
      badConditionsMs: 0,
      lowSatisfactionMs: 0,
      breakHold: false,
      orderedRest: false,
    };

    // EMP-03: rynek nie traci specjalisty — na miejsce zatrudnionego wchodzi kolejna osoba
    // z listy postaci tej samej specjalizacji i seniority (bez osób, które odeszły z firmy).
    const employees: GameState['staff']['employees'] = {
      ...state.staff.employees,
      [employee.id]: employee,
    };
    const market = fillMarket(
      {
        candidates: state.staff.candidates.filter((c) => c.id !== candidate.id),
        ids: allocated.sequence,
        rng: state.rng,
      },
      [...Object.values(employees), ...state.staff.departures],
      config.staff.dailyWage,
    );
    const hired = registerWageDue(
      {
        ...state,
        staff: {
          ...state.staff,
          employees,
          candidates: market.candidates,
        },
        ids: market.ids,
        rng: market.rng,
      },
      employee.id,
      employee.dailyWage,
    );

    const withAgent = addEmployeeAgent(hired, employee, config);
    return withAgent ? { ok: true, state: withAgent } : reject('noRoomToEnter');
  },
};
