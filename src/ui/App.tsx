import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { EngineContext } from '../application/engineHooks';
import { browserEnvironment, startGameLoop, type FrameClock } from '../application/gameLoop';
import { attachAutosave, type SaveManager } from '../application/saveManager';
import { createFurnitureEditStore } from '../application/furnitureEdit';
import { FurnitureEditContext } from '../application/furnitureEditHooks';
import { createSelectionStore } from '../application/selection';
import { SelectionContext } from '../application/selectionHooks';
import { createOfficeGame } from '../rendering/createOfficeGame';
import type { Engine } from '../simulation/engine';
import { DayReportDialog } from './DayReportDialog';
import { EventDialog } from './EventDialog';
import { MainNav } from './MainNav';
import { NavigationContext, type Navigation, type Tab } from './navigation';
import { OfficeView } from './OfficeView';
import { PlanAside } from './PlanAside';
import { Sheet } from './Sheet';
import { TopBar } from './TopBar';
import { FinanceView } from './views/FinanceView';
import { FurnishView } from './views/FurnishView';
import { GoalsView } from './views/GoalsView';
import { ProjectsView } from './views/ProjectsView';
import { RecruitmentView } from './views/RecruitmentView';
import { TeamView } from './views/TeamView';

// Scena testowa okluzji dla SH-002: ?scene=occlusion
const occlusionTest = new URLSearchParams(window.location.search).get('scene') === 'occlusion';

const SHEETS: Record<Exclude<Tab, 'office'>, { title: string; view: () => ReactNode }> = {
  projects: { title: 'Projekty i zlecenia', view: () => <ProjectsView /> },
  team: { title: 'Twój zespół', view: () => <TeamView /> },
  recruit: { title: 'Rekrutacja', view: () => <RecruitmentView /> },
  furnish: { title: 'Urządź biuro', view: () => <FurnishView /> },
  finance: { title: 'Finanse firmy', view: () => <FinanceView /> },
  goals: { title: 'Cel misji', view: () => <GoalsView /> },
};

// Aktywna gra. Pętla, scena Phaser i autozapis żyją tyle, co komponent — nowa misja montuje
// go od nowa, więc po restarcie nie zostaje poprzednia pętla ani handlery (T:VIEW-05).
// Układ (SH-033, wzór SH2): nagłówek, nawigacja, biuro; zakładki zarządzania nad biurem.
export function App({
  engine,
  saveManager,
  onNewGame,
}: {
  engine: Engine;
  saveManager: SaveManager;
  onNewGame(): void;
}) {
  const [selection] = useState(createSelectionStore);
  const [edit] = useState(createFurnitureEditStore);
  const [frameClock] = useState<FrameClock>(() => ({ alpha: 0 }));
  const [tab, setTab] = useState<Tab>('office');
  const navigation = useMemo<Navigation>(() => ({ tab, open: setTab }), [tab]);
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => startGameLoop(engine, browserEnvironment, frameClock), [engine, frameClock]);

  useEffect(
    () => attachAutosave(saveManager, engine, { onBackground: browserEnvironment.onBackground }),
    [saveManager, engine],
  );

  useEffect(() => {
    if (!sceneRef.current) return;
    const presentation = { selection, edit, frameClock };
    const game = createOfficeGame(sceneRef.current, engine, presentation, { occlusionTest });
    return () => game.destroy(true);
  }, [engine, selection, edit, frameClock]);

  const sheet = tab === 'office' ? null : SHEETS[tab];

  return (
    <EngineContext value={engine}>
      <SelectionContext value={selection}>
        <FurnitureEditContext value={edit}>
          <NavigationContext value={navigation}>
            <div className="shell">
              <TopBar manager={saveManager} onNewGame={onNewGame} />
              <MainNav />
              <OfficeView sceneRef={sceneRef} engine={engine} manager={saveManager} />
              <PlanAside />
              {sheet && (
                <Sheet title={sheet.title} onClose={() => setTab('office')}>
                  {sheet.view()}
                </Sheet>
              )}
            </div>
            <DayReportDialog onNewGame={onNewGame} />
            <EventDialog />
          </NavigationContext>
        </FurnitureEditContext>
      </SelectionContext>
    </EngineContext>
  );
}
