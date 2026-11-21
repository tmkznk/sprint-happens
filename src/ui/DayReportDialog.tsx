import { CHAPTER_TWO_ENABLED } from '../application/features';
import { ModalLayer } from './ModalLayer';
import { useDispatch, useGameSelector } from '../application/engineHooks';
import { money } from './labels';
import { NewGameButton } from './NewGameButton';
import { spotlight, useGuide } from './prologue/hooks';

// TIME-03, TIME-08 (Z): raport po rozliczeniu i przejście do następnego dnia.
// FIN-05 (Z): ujemne saldo uruchamia ostrzeżenie z terminem odzyskania płynności; brak poprawy
// kończy misję bankructwem. Okno modalne przechwytuje dotyk (T:VIEW-03).
// Rozdział 2 (SH-049): przejście po zwycięstwie w rozdziale 1 i ponowienie po bankructwie.
export type ChapterActions = {
  onContinue(): void;
  onRetry(): void;
  // Kopia startu rozdziału 2 istnieje (sprawdzane przez aplikację).
  canRetry: boolean;
  // Epilog po wygranym rozdziale 2 (koniec kampanii).
  onEpilogue(): void;
  // Nieudane przejście lub ponowienie — komunikat zamiast cichej porażki.
  error: string | null;
};

export function DayReportDialog({
  onNewGame,
  chapterActions,
}: {
  onNewGame(): void;
  chapterActions: ChapterActions;
}) {
  const chapter = useGameSelector((state) => state.mission.chapter);
  const report = useGameSelector((state) => state.mission.report);
  const status = useGameSelector((state) => state.mission.status);
  const dispatch = useDispatch();
  const delivered = useGameSelector((state) => state.contracts.chapterDeliveredCount);
  const deliveredTotal = useGameSelector((state) => state.contracts.deliveredCount);
  const reputation = useGameSelector((state) => state.mission.reputation);
  const nextDay = useGuide()?.kind === 'nextDay';

  if (!report) return null;
  const bankrupt = status === 'bankrupt';
  const won = status === 'won';
  // Koniec kampanii: wygrany rozdział 2. Licznik dni biegnie od początku rozdziału 1.
  const campaignEnd = CHAPTER_TWO_ENABLED && won && chapter === 2;
  const daysLeft = report.rescueDeadlineDay === null ? null : report.rescueDeadlineDay - report.day;

  return (
    <ModalLayer>
      <div className="modal-backdrop">
        <section
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="day-report-title"
        >
          <h2 id="day-report-title">
            {won ? 'Zwycięstwo!' : bankrupt ? 'Bankructwo' : `Podsumowanie dnia ${report.day}`}
          </h2>
          <dl>
            <dt>Wpływy</dt>
            <dd>+{money.format(report.income)}</dd>
            <dt>Zakupy i inne wydatki</dt>
            <dd>−{money.format(report.spending)}</dd>
            <dt>Pensje</dt>
            <dd>−{money.format(report.wages)}</dd>
            <dt>Utrzymanie biura</dt>
            <dd>−{money.format(report.upkeep)}</dd>
            <dt>Saldo po rozliczeniu</dt>
            <dd className={report.cashAfterSettlement < 0 ? 'negative' : undefined}>
              {money.format(report.cashAfterSettlement)}
            </dd>
          </dl>
          {bankrupt ? (
            <p className="warning" role="alert">
              Firma nie odzyskała płynności w okresie ratunkowym. Misja zakończona — rozpocznij nową
              grę.
            </p>
          ) : (
            daysLeft !== null && (
              <p className="warning" role="alert">
                Ujemne saldo! Odzyskaj płynność do rozliczenia dnia {report.rescueDeadlineDay}
                {daysLeft === 0 ? '.' : ` (pozostało dni: ${daysLeft}).`} Do tego czasu nie można
                zatrudniać ani kupować wyposażenia.
              </p>
            )
          )}
          {/* MIS-03 (Z): koniec misji — podsumowanie i nowa gra po potwierdzeniu; brak dalszej gry. */}
          {status !== 'active' && (
            <>
              {won &&
                (campaignEnd ? (
                  <p role="status">
                    Kampania ukończona! JanuszSoft przeszedł drogę od garażu do Scruma w{' '}
                    {report.day} dni.
                  </p>
                ) : (
                  <p role="status">
                    Software house przetrwał i zdobył renomę! Misja ukończona w {report.day} dni.
                  </p>
                ))}
              <dl>
                <dt>{campaignEnd ? 'Dni kampanii' : 'Dni misji'}</dt>
                <dd>{report.day}</dd>
                <dt>{campaignEnd ? 'Oddane projekty w rozdziale 2' : 'Oddane projekty'}</dt>
                <dd>{delivered}</dd>
                {campaignEnd && (
                  <>
                    <dt>Oddane projekty w kampanii</dt>
                    <dd>{deliveredTotal}</dd>
                  </>
                )}
                <dt>Reputacja</dt>
                <dd>{reputation}/100</dd>
              </dl>
              <div className="panel-actions">
                <NewGameButton onConfirm={onNewGame} />
                {CHAPTER_TWO_ENABLED && won && chapter === 1 && (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={chapterActions.onContinue}
                  >
                    Dalej: rozdział 2
                  </button>
                )}
                {campaignEnd && (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={chapterActions.onEpilogue}
                  >
                    Epilog
                  </button>
                )}
                {CHAPTER_TWO_ENABLED && bankrupt && chapter === 2 && chapterActions.canRetry && (
                  <button type="button" className="primary-button" onClick={chapterActions.onRetry}>
                    Ponów rozdział 2
                  </button>
                )}
              </div>
              {chapterActions.error !== null && (
                <p className="warning" role="alert">
                  {chapterActions.error}
                </p>
              )}
            </>
          )}
          {status === 'active' && (
            <button
              type="button"
              className={spotlight(undefined, nextDay)}
              onClick={() => dispatch({ type: 'StartNextDay' })}
            >
              Następny dzień
            </button>
          )}
        </section>
      </div>
    </ModalLayer>
  );
}
