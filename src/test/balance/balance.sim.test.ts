import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../../domain/config';
import { runMission, type MissionResult } from './missionBot';
import { STRATEGIES } from './strategies';

// SH-044: pomiar balansu — narzędzie w budowie (prace przerwane, wyniki bota jeszcze niewiarygodne,
// patrz missionBot.ts). Pełne serie tylko na żądanie: `npm run balance`
// (BALANCE_SEEDS — liczba ziaren, BALANCE_ONLY — nazwa strategii). Domyślnie jeden krótki
// przebieg pilnuje, że bot nadal działa z bieżącym silnikiem.
const env = import.meta.env as Record<string, string | undefined>;
const FULL = env.BALANCE === '1';
const SEEDS = Number(env.BALANCE_SEEDS ?? 20);

describe('balans misji (SH-044)', () => {
  it.skipIf(FULL)(
    'bot rozgrywa misję bez błędów (1 ziarno)',
    () => {
      const [strategy] = STRATEGIES;
      if (!strategy) throw new Error('brak strategii');
      const result = runMission(strategy, 1, DEFAULT_BALANCE);
      expect(['won', 'bankrupt', 'timeout']).toContain(result.status);
      expect(result.day).toBeGreaterThan(1);
    },
    120_000,
  );

  // Dziennik dzień po dniu jednego przebiegu: BALANCE_TRACE=<ziarno> (strategia: BALANCE_ONLY).
  it.runIf(FULL && env.BALANCE_TRACE !== undefined)(
    'dziennik jednego przebiegu',
    () => {
      const strategy = STRATEGIES.find((s) => s.name === (env.BALANCE_ONLY ?? 'rozsądny'));
      if (!strategy) throw new Error('brak strategii');
      const lines: string[] = [];
      const result = runMission(strategy, Number(env.BALANCE_TRACE), DEFAULT_BALANCE, (line) =>
        lines.push(line),
      );
      console.log(`wpisów: ${lines.length}`);
      console.log([...lines, JSON.stringify(result)].join('\n'));
    },
    120_000,
  );

  it.runIf(FULL && env.BALANCE_TRACE === undefined)(
    'raport strategii',
    () => {
      const only = env.BALANCE_ONLY;
      const rows: string[] = [];
      for (const strategy of STRATEGIES.filter((s) => !only || s.name === only)) {
        const results: MissionResult[] = [];
        for (let seed = 1; seed <= SEEDS; seed++) {
          results.push(runMission(strategy, seed, DEFAULT_BALANCE));
        }
        rows.push(summary(strategy.name, results));
      }
      console.log(['', HEADER, ...rows].join('\n'));
    },
    3_600_000,
  );
});

const HEADER =
  'strategia        | wygr | bankr | limit | dzień wygr. (med/min/max) | min saldo med | rep. med | spóźn. | błędy/proj | palacze';

function summary(name: string, results: MissionResult[]): string {
  const won = results.filter((r) => r.status === 'won');
  const days = won.map((r) => r.day).sort((a, b) => a - b);
  const median = (xs: number[]) => (xs.length ? xs[Math.floor(xs.length / 2)] : NaN);
  const delivered = results.reduce((s, r) => s + r.delivered, 0) || 1;
  return [
    name.padEnd(16),
    `${won.length}/${results.length}`.padStart(4),
    String(results.filter((r) => r.status === 'bankrupt').length).padStart(5),
    String(results.filter((r) => r.status === 'timeout').length).padStart(5),
    `${median(days)} / ${days[0] ?? '-'} / ${days.at(-1) ?? '-'}`.padStart(25),
    String(median(results.map((r) => r.minCash).sort((a, b) => a - b))).padStart(13),
    String(median(results.map((r) => r.reputation).sort((a, b) => a - b))).padStart(8),
    String(results.reduce((s, r) => s + r.lateDeliveries, 0)).padStart(6),
    (results.reduce((s, r) => s + r.remainingBugs, 0) / delivered).toFixed(1).padStart(10),
    String(results.reduce((s, r) => s + r.smokers, 0)).padStart(7),
  ].join(' | ');
}
