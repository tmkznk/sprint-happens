import type { BalanceConfig } from '../domain/config';
import type { EventEffect, EventOption } from '../domain/content/events';
import type { ReadonlyProject } from '../domain/contracts';
import { rewardIncrease, scopeIncrease } from '../simulation/events';
import { money, SCOPE_LABELS } from './labels';

const signed = (value: number) => (value > 0 ? `+${value}` : `−${-value}`);

// EVT-02 (Z): skutki liczbowo, przed wyborem — w tym wpływ na termin.
function describeEffect(
  effect: EventEffect,
  project: ReadonlyProject | undefined,
  config: BalanceConfig,
): string {
  switch (effect.kind) {
    case 'scopePercent': {
      const scope = project?.scopes[effect.specialization] ?? 0;
      return `Zakres ${SCOPE_LABELS[effect.specialization]} +${scopeIncrease(scope, effect.percent, config)} pp`;
    }
    case 'addScope':
      return `Nowy zakres ${SCOPE_LABELS[effect.specialization]}: ${effect.points} pp`;
    case 'rewardPercent':
      return `Wynagrodzenie +${money.format(rewardIncrease(project?.reward ?? 0, effect.percent))}`;
    case 'deadlineDays':
      return `Termin +${effect.days} ${effect.days === 1 ? 'dzień' : 'dni'}`;
    case 'reputation':
      return `Reputacja ${signed(effect.delta)}`;
    case 'cash':
      return `Saldo ${effect.amount > 0 ? '+' : '−'}${money.format(Math.abs(effect.amount))}`;
    case 'satisfactionAll':
      return `Zadowolenie wszystkich ${signed(effect.delta)}`;
    case 'meeting':
      return `Nikt nie pracuje przez ${effect.seconds} s`;
    case 'coffeeBroken':
      return 'Ekspres niedostępny do końca dnia';
    case 'revealBugs':
      return `Do ${effect.count} ukrytych błędów ${SCOPE_LABELS[effect.specialization]} zostanie wykrytych`;
  }
}

export function describeOption(
  option: EventOption,
  project: ReadonlyProject | undefined,
  config: BalanceConfig,
): string[] {
  if (option.effects.length === 0) return ['Bez skutków'];
  const lines = option.effects.map((effect) => describeEffect(effect, project, config));
  const changesWork = option.effects.some(
    (e) => e.kind === 'scopePercent' || e.kind === 'addScope',
  );
  if (changesWork && !option.effects.some((e) => e.kind === 'deadlineDays')) {
    lines.push('Termin bez zmian');
  }
  return lines;
}
