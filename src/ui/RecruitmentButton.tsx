import { useState } from 'react';
import { RecruitmentDialog } from './RecruitmentDialog';

export function RecruitmentButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="secondary-button" onClick={() => setOpen(true)}>
        Rekrutacja
      </button>
      {open && <RecruitmentDialog onClose={() => setOpen(false)} />}
    </>
  );
}
