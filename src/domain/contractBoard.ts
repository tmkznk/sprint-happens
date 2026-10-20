import type { BalanceConfig } from './config';
import {
  CONTRACT_TEMPLATES,
  STARTER_CONTRACT_ID,
  type ContractTemplate,
} from './content/contracts';
import type { ContractTerms, Offer } from './contracts';
import { allocateId, type IdSequence } from './ids';
import { nextRandom, type RngState } from './random';

// Warunki oferty z szablonu i konfiguracji (CON-02, FIN-01, FIN-04, PROJ-10; decyzja SH-032 B5, B6).
export function termsFromTemplate(
  template: ContractTemplate,
  config: BalanceConfig,
): ContractTerms {
  const { contracts } = config;
  return {
    templateId: template.id,
    name: template.name,
    description: template.description,
    scopes: template.scopes,
    designImportance: template.designImportance,
    designScope: template.designImportance * contracts.designPointsPerImportance,
    deadlineDays: template.deadlineDays,
    reward: template.reward,
    advance: Math.floor(template.reward * contracts.advanceRatio),
    latePenaltyPerDay: Math.floor(template.reward * contracts.latePenaltyRatio),
  };
}

// Decyzja SH-032 A3b (interpretacja SH-020): poziom ofert rośnie z liczbą oddanych projektów —
// przed pierwszym oddaniem tylko poziom 1, od pierwszego oddania także 2, od trzeciego także 3.
// Reputacja nie wpływa na oferty (CON-04).
export function maxOfferLevel(deliveredCount: number): 1 | 2 | 3 {
  if (deliveredCount >= 3) return 3;
  return deliveredCount >= 1 ? 2 : 1;
}

export type BoardState = { offers: Offer[]; ids: IdSequence; rng: RngState };

// CON-01 (Z): tablica ma stałą liczbę miejsc; wolne miejsca uzupełnia losowanie z ziarnem
// (TIME-T04). Na tablicy nie ma dwóch ofert z tego samego szablonu (SH-032 A3a).
export function fillBoard(
  board: BoardState,
  deliveredCount: number,
  config: BalanceConfig,
  options: { guaranteeStarter?: boolean } = {},
): BoardState {
  let { offers, ids, rng } = board;
  offers = [...offers];
  const add = (template: ContractTemplate) => {
    const allocated = allocateId(ids, 'offer');
    ids = allocated.sequence;
    offers.push({ id: allocated.id, ...termsFromTemplate(template, config) });
  };

  // SH-032 A5: pierwszego dnia jedna z ofert to zawsze prosty kontrakt startowy.
  const starter = CONTRACT_TEMPLATES.find((t) => t.id === STARTER_CONTRACT_ID);
  if (options.guaranteeStarter && starter && !offers.some((o) => o.templateId === starter.id)) {
    add(starter);
  }

  const maxLevel = maxOfferLevel(deliveredCount);
  while (offers.length < config.contracts.boardSize) {
    const onBoard = new Set(offers.map((offer) => offer.templateId));
    const available = CONTRACT_TEMPLATES.filter((t) => t.level <= maxLevel && !onBoard.has(t.id));
    if (available.length === 0) break;
    const draw = nextRandom(rng);
    rng = draw.state;
    const template = available[Math.floor(draw.value * available.length)];
    if (template) add(template);
  }
  return { offers, ids, rng };
}
