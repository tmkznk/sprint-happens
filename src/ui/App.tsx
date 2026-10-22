import { useEffect, useRef, useState } from 'react';
import { EngineContext } from '../application/engineHooks';
import { browserEnvironment, startGameLoop, type FrameClock } from '../application/gameLoop';
import { attachAutosave, type SaveManager } from '../application/saveManager';
import { createFurnitureEditStore } from '../application/furnitureEdit';
import { FurnitureEditContext } from '../application/furnitureEditHooks';
import { createSelectionStore } from '../application/selection';
import { SelectionContext } from '../application/selectionHooks';
import { createOfficeGame } from '../rendering/createOfficeGame';
import type { Engine } from '../simulation/engine';
import { ContractsButton } from './ContractsButton';
import { DayClock } from './DayClock';
import { DayControls } from './DayControls';
import { DayReportDialog } from './DayReportDialog';
import { FinanceSummary } from './FinanceSummary';
import { EventDialog } from './EventDialog';
import { MissionGoals } from './MissionGoals';
import { UpdateBanner } from './UpdateBanner';
import { OfflineBadge } from './OfflineBadge';
import { OfficeSceneBubble } from './OfficeSceneBubble';
import { StaffAlerts } from './StaffAlerts';
import { NewGameButton } from './NewGameButton';
import { RecruitmentButton } from './RecruitmentButton';
import { SaveIndicator } from './SaveIndicator';
import { SelectionPanel } from './SelectionPanel';
import { ShopButton } from './ShopButton';
import { SpeedControls } from './SpeedControls';

// Scena testowa okluzji dla SH-002: ?scene=occlusion
const occlusionTest = new URLSearchParams(window.location.search).get('scene') === 'occlusion';

// Aktywna gra. Pętla, scena Phaser i autozapis żyją tyle, co komponent — nowa misja montuje
// go od nowa, więc po restarcie nie zostaje poprzednia pętla ani handlery (T:VIEW-05).
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

  return (
    <EngineContext value={engine}>
      <SelectionContext value={selection}>
        <FurnitureEditContext value={edit}>
          <div className="app">
            <div className="scene-area">
              <div ref={sceneRef} className="scene" />
              <SelectionPanel />
              <OfficeSceneBubble />
              <DayReportDialog onNewGame={onNewGame} />
              <EventDialog />
            </div>
            <div className="panel">
              <div className="panel-header">
                <DayClock />
                <SaveIndicator manager={saveManager} />
                <OfflineBadge />
              </div>
              <UpdateBanner engine={engine} manager={saveManager} />
              <FinanceSummary />
              <MissionGoals />
              <StaffAlerts />
              <SpeedControls />
              <DayControls />
              <div className="panel-actions">
                <ContractsButton />
                <RecruitmentButton />
                <ShopButton />
                <NewGameButton onConfirm={onNewGame} />
              </div>
            </div>
          </div>
        </FurnitureEditContext>
      </SelectionContext>
    </EngineContext>
  );
}
