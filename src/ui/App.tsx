import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type * as Phaser from 'phaser';
import { EngineContext } from '../application/engineHooks';
import { browserEnvironment, startGameLoop, type FrameClock } from '../application/gameLoop';
import { attachAutosave, type SaveManager } from '../application/saveManager';
import { createFurnitureEditStore } from '../application/furnitureEdit';
import { FurnitureEditContext } from '../application/furnitureEditHooks';
import { createOrderFeedbackStore } from '../application/orderFeedback';
import { OrderFeedbackContext } from '../application/orderFeedbackHooks';
import { createSelectionStore } from '../application/selection';
import { SelectionContext } from '../application/selectionHooks';
import { createOfficeGame } from '../rendering/createOfficeGame';
import type { Engine } from '../simulation/engine';
import { DayReportDialog } from './DayReportDialog';
import { EventDialog } from './EventDialog';
import { MainNav } from './MainNav';
import { PHONE_LAYOUT, useMediaQuery, WIDE_LAYOUT } from './mediaQuery';
import { NavigationContext, type MissionKind, type Navigation, type Tab } from './navigation';
import { OfficeView } from './OfficeView';
import { PlanAside } from './PlanAside';
import { tabLock } from './prologue/guide';
import { PrologueFinale } from './prologue/PrologueViews';
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

type SheetProps = { onNewGame(kind: MissionKind): void };

const SHEETS: Record<
  Exclude<Tab, 'office'>,
  { title: string; view: (props: SheetProps) => ReactNode }
> = {
  projects: { title: 'Projekty i zlecenia', view: () => <ProjectsView /> },
  team: { title: 'Twój zespół', view: () => <TeamView /> },
  recruit: { title: 'Rekrutacja', view: () => <RecruitmentView /> },
  furnish: { title: 'Urządź biuro', view: () => <FurnishView /> },
  finance: { title: 'Finanse firmy', view: () => <FinanceView /> },
  goals: {
    title: 'Cel misji',
    view: ({ onNewGame }) => <GoalsView onSkipPrologue={() => onNewGame('mission')} />,
  },
};

// Komunikat blokady prologu znika sam po kilku sekundach.
const NOTICE_MS = 4000;

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
  onNewGame(kind?: MissionKind): void;
}) {
  const [selection] = useState(createSelectionStore);
  const [edit] = useState(createFurnitureEditStore);
  const [orderFeedback] = useState(createOrderFeedbackStore);
  const [frameClock] = useState<FrameClock>(() => ({ alpha: 0 }));
  const [tab, setTab] = useState<Tab>('office');
  const [notice, setNotice] = useState<string | null>(null);
  // Zablokowana w prologu zakładka nie otwiera się — gracz widzi warunek dostępu.
  const navigation = useMemo<Navigation>(
    () => ({
      tab,
      open(next) {
        const lock = tabLock(engine.getState(), next);
        setNotice(lock);
        if (!lock) setTab(next);
      },
      notify: setNotice,
    }),
    [tab, engine],
  );
  const sceneRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  // Na telefonie panel zarządzania jest pełnoekranowy i zasłania biuro.
  const sceneCovered = useMediaQuery(PHONE_LAYOUT) && tab !== 'office';
  // „Plan na dzisiaj” jest widoczny tylko na szerokim ekranie — gdzie indziej się nie renderuje.
  const wide = useMediaQuery(WIDE_LAYOUT);

  useEffect(() => startGameLoop(engine, browserEnvironment, frameClock), [engine, frameClock]);

  useEffect(
    () => attachAutosave(saveManager, engine, { onBackground: browserEnvironment.onBackground }),
    [saveManager, engine],
  );

  useEffect(() => {
    if (!sceneRef.current) return;
    const presentation = { selection, edit, orderFeedback, frameClock };
    const game = createOfficeGame(sceneRef.current, engine, presentation, { occlusionTest });
    gameRef.current = game;
    return () => {
      gameRef.current = null;
      game.destroy(true);
    };
  }, [engine, selection, edit, orderFeedback, frameClock]);

  // Zasłonięta scena nie rysuje klatek (oszczędność baterii); symulacja biegnie dalej we własnej
  // pętli, a po odsłonięciu scena od razu pokazuje bieżący stan.
  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    if (sceneCovered) game.loop.sleep();
    else game.loop.wake();
  }, [sceneCovered]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const sheet = tab === 'office' ? null : SHEETS[tab];

  return (
    <EngineContext value={engine}>
      <SelectionContext value={selection}>
        <FurnitureEditContext value={edit}>
          <OrderFeedbackContext value={orderFeedback}>
            <NavigationContext value={navigation}>
              <div className="shell">
                <TopBar manager={saveManager} onNewGame={onNewGame} />
                <MainNav />
                <OfficeView sceneRef={sceneRef} engine={engine} manager={saveManager} />
                {wide && <PlanAside />}
                {sheet && (
                  <Sheet title={sheet.title} onClose={() => setTab('office')}>
                    {sheet.view({ onNewGame })}
                  </Sheet>
                )}
                {notice && (
                  <p className="lock-notice" role="status" onClick={() => setNotice(null)}>
                    {notice}
                  </p>
                )}
              </div>
              <DayReportDialog onNewGame={() => onNewGame()} />
              <EventDialog />
              <PrologueFinale onFinish={() => onNewGame('mission')} />
            </NavigationContext>
          </OrderFeedbackContext>
        </FurnitureEditContext>
      </SelectionContext>
    </EngineContext>
  );
}
