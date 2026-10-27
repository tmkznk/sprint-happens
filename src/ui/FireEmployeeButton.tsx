import { UserMinus } from 'lucide-react';
import { useState } from 'react';
import { useDispatch, useGameSelector } from '../application/engineHooks';
import { useClearSelection, useSelection } from '../application/selectionHooks';
import type { EmployeeId } from '../domain/employees';
import { ConfirmDialog } from './ConfirmDialog';
import { money } from './labels';
import { REJECTION_MESSAGES } from './rejectionMessages';

// EMP-08, FIN-03 (Z): zwolnienie z potwierdzeniem przydziału i pełnej należnej dniówki.
// Wariant „text” — panel pracownika w biurze; „icon” — kafelek w zakładce Zespół.
export function FireEmployeeButton({
  employeeId,
  variant = 'text',
}: {
  employeeId: EmployeeId;
  variant?: 'text' | 'icon';
}) {
  const dispatch = useDispatch();
  const selection = useSelection();
  const clearSelection = useClearSelection();
  const isWorking = useGameSelector((state) => state.mission.phase === 'working');
  // Samo imię — obiekt pracownika zmienia się w każdym kroku (energia, zadowolenie).
  const name = useGameSelector((state) => state.staff.employees[employeeId]?.name);
  const projectName = useGameSelector((state) => {
    const projectId = state.staff.employees[employeeId]?.projectId;
    return projectId ? (state.contracts.projects[projectId]?.name ?? null) : null;
  });
  const wageDue = useGameSelector((state) => state.finance.wagesDueToday[employeeId] ?? 0);
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (name === undefined) return null;

  const fire = () => {
    setAsking(false);
    const result = dispatch({ type: 'FireEmployee', employeeId });
    if (!result.ok) {
      setMessage(REJECTION_MESSAGES[result.rejection.code]);
      return;
    }
    // Zwolniona osoba nie może pozostać zaznaczona w biurze.
    if (selection?.kind === 'employee' && selection.id === employeeId) clearSelection();
  };

  return (
    <>
      <button
        type="button"
        className={variant === 'icon' ? 'secondary-button icon-only' : 'secondary-button'}
        disabled={!isWorking}
        aria-label={variant === 'icon' ? `Zwolnij: ${name}` : undefined}
        title={variant === 'icon' ? 'Zwolnij' : undefined}
        onClick={() => setAsking(true)}
      >
        {variant === 'icon' ? <UserMinus size={18} /> : 'Zwolnij'}
      </button>
      {message && <span className="warning">{message}</span>}
      {asking && (
        <ConfirmDialog
          title={`Zwolnić: ${name}?`}
          message={`Przydział: ${projectName ?? 'brak'}. Za dziś należy się pełna dniówka ${money.format(
            wageDue,
          )} zł — zostanie pobrana w rozliczeniu. Bez odpraw; wykonana praca zostaje w projekcie.`}
          confirmLabel="Zwolnij"
          onCancel={() => setAsking(false)}
          onConfirm={fire}
        />
      )}
    </>
  );
}
