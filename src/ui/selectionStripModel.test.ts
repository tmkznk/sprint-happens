import { describe, expect, it } from 'vitest';
import type { OrderFeedback } from '../application/orderFeedback';
import type { EmployeeId } from '../domain/employees';
import { REJECTION_MESSAGES } from './rejectionMessages';
import { orderRejectionMessage, roleLabel, visibleRejection } from './selectionStripModel';

const ana = 'emp-1' as EmployeeId;
const bob = 'emp-2' as EmployeeId;

const rejected = (seq: number, employeeId = ana): OrderFeedback => ({
  seq,
  employeeId,
  result: { ok: false, rejection: { code: 'noAction' } },
});

describe('roleLabel', () => {
  it('łączy krótkie stanowisko i poziom', () => {
    expect(roleLabel({ specialization: 'devops', seniority: 'senior' })).toBe('DevOps · Senior');
    expect(roleLabel({ specialization: 'pm', seniority: 'junior' })).toBe('PM · Junior');
  });
});

describe('visibleRejection', () => {
  it('pokazuje odmowę rozkazu wydanego zaznaczonej osobie po zaznaczeniu', () => {
    expect(visibleRejection(rejected(3), ana, 2, 0)).toBe('noAction');
  });

  it('pomija brak wyniku i rozkaz przyjęty', () => {
    expect(visibleRejection(null, ana, 0, 0)).toBeNull();
    expect(
      visibleRejection({ seq: 3, employeeId: ana, result: { ok: true } }, ana, 0, 0),
    ).toBeNull();
  });

  it('pomija odmowę dla innej osoby', () => {
    expect(visibleRejection(rejected(3, bob), ana, 0, 0)).toBeNull();
  });

  it('pomija odmowę sprzed zaznaczenia', () => {
    expect(visibleRejection(rejected(2), ana, 2, 0)).toBeNull();
  });

  it('pomija odmowę wygaszoną po czasie, ale pokazuje kolejną', () => {
    expect(visibleRejection(rejected(3), ana, 0, 3)).toBeNull();
    expect(visibleRejection(rejected(4), ana, 0, 3)).toBe('noAction');
  });
});

describe('orderRejectionMessage', () => {
  it('przy schodzeniu się i wychodzeniu zespołu: „Teraz wszyscy są w drodze.”', () => {
    expect(orderRejectionMessage('phaseNotAllowed', 'arriving')).toBe('Teraz wszyscy są w drodze.');
    expect(orderRejectionMessage('phaseNotAllowed', 'leaving')).toBe('Teraz wszyscy są w drodze.');
  });

  it('w innych fazach i dla innych kodów — zwykły komunikat odmowy', () => {
    expect(orderRejectionMessage('phaseNotAllowed', 'workEnded')).toBe(
      REJECTION_MESSAGES.phaseNotAllowed,
    );
    expect(orderRejectionMessage('noAction', 'leaving')).toBe(REJECTION_MESSAGES.noAction);
  });
});
