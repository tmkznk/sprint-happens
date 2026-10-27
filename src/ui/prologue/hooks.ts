import { useMemo } from 'react';
import { useGameSelector } from '../../application/engineHooks';
import { useFurnitureEdit } from '../../application/furnitureEditHooks';
import type { PrologueStep } from '../../domain/prologue';
import { guideAction, type GuideAction } from './guide';

export function usePrologueStep(): PrologueStep | null {
  return useGameSelector((state) => state.prologue?.step ?? null);
}

// Bieżąca wskazówka prologu (null poza prologiem). Selektor zwraca tekst — komponenty
// renderują się tylko przy zmianie wskazówki, nie w każdym kroku (T:VIEW-02).
export function useGuide(): GuideAction | null {
  const editing = useFurnitureEdit() !== null;
  const key = useGameSelector((state) => JSON.stringify(guideAction(state, editing)));
  return useMemo(() => JSON.parse(key) as GuideAction | null, [key]);
}

// Klasa podświetlenia elementu, który gracz ma teraz dotknąć.
export function spotlight(className: string | undefined, on: boolean): string | undefined {
  if (!on) return className;
  return className ? `${className} spotlight` : 'spotlight';
}
