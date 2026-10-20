import { useState } from 'react';
import { useGameSelector } from '../application/engineHooks';
import { ContractsDialog } from './ContractsDialog';

export function ContractsButton() {
  const [open, setOpen] = useState(false);
  const offers = useGameSelector((state) => state.contracts.offers.length);
  return (
    <>
      <button type="button" className="secondary-button" onClick={() => setOpen(true)}>
        Zlecenia ({offers})
      </button>
      {open && <ContractsDialog onClose={() => setOpen(false)} />}
    </>
  );
}
