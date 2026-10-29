import type { OrderFeedback } from '../application/orderFeedback';
import type { Employee, EmployeeId } from '../domain/employees';
import type { RejectionCode } from '../simulation/commands/types';
import { SENIORITY_LABELS, SPECIALIZATION_SHORT_LABELS } from './labels';

// Jak długo pasek pokazuje odmowę rozkazu.
export const ORDER_REJECTION_MS = 3000;

// Krótka rola na pasku zaznaczenia — jak na liście Zespołu, np. „DevOps · Senior”.
export function roleLabel(employee: Pick<Employee, 'specialization' | 'seniority'>): string {
  return `${SPECIALIZATION_SHORT_LABELS[employee.specialization]} · ${SENIORITY_LABELS[employee.seniority]}`;
}

// Odmowa do pokazania na pasku: tylko dla zaznaczonej osoby, tylko z rozkazu wydanego po
// zaznaczeniu (`seq` większy niż przy zaznaczeniu) i jeszcze nie wygaszona.
export function visibleRejection(
  feedback: OrderFeedback | null,
  employeeId: EmployeeId,
  selectedAtSeq: number,
  expiredSeq: number,
): RejectionCode | null {
  if (!feedback || feedback.result.ok) return null;
  if (feedback.employeeId !== employeeId) return null;
  if (feedback.seq <= selectedAtSeq || feedback.seq === expiredSeq) return null;
  return feedback.result.rejection.code;
}
