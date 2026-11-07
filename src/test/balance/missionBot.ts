import type { BalanceConfig } from '../../domain/config';
import { EVENT_TEMPLATES } from '../../domain/content/events';
import { personById } from '../../domain/content/people';
import {
  TECH_SPECIALIZATIONS,
  POINT_SCALE,
  type Offer,
  type ProjectId,
  type ReadonlyProject,
  type TechSpecialization,
} from '../../domain/contracts';
import type { Employee, Seniority, Specialization } from '../../domain/employees';
import { ROTATIONS, type FurnitureType } from '../../domain/furniture';
import { createInitialState, type GameState } from '../../domain/state';
import type { Command } from '../../simulation/commands';
import { isReadyForDelivery } from '../../simulation/delivery';
import { createEngine, type Engine } from '../../simulation/engine';
import { detectedBugCount, testQueue } from '../../simulation/qa';
import { remainingDesign, remainingPoints } from '../../simulation/work';
import { officeLayoutOf } from '../../world/officeLayout';

// PRACA NIEUKOŃCZONA (SH-044 przerwane): bot gra jeszcze słabiej niż rozsądny gracz — m.in.
// zatrudnia najwyżej jedną osobę dziennie (uproszczenie, nie reguła gry), nie dobiera zleceń do
// przepustowości QA. Jego wyniki nie są miarą balansu, dopóki nie zostanie dopracowany.
//
// SH-044: bot do pomiarów balansu. Gra wyłącznie publicznymi poleceniami silnika (jak interfejs),
// bez renderera. Strategia opisuje skład zespołu i decyzje; bot nie zna ukrytych błędów ani
// cech postaci niewidocznych dla gracza (palenie widać dopiero po zatrudnieniu — bot je ignoruje).

export type Hire = { specialization: Specialization; seniority: Seniority };

export type Strategy = {
  name: string;
  // Zespół zatrudniany pierwszego dnia (kolejność ma znaczenie przy braku biurek/gotówki).
  team: Hire[];
  // Rozbudowa: kolejne osoby zatrudniane, gdy saldo przekracza `growthCash` (po jednej dziennie).
  growth: Hire[];
  growthCash: number;
  // Najwięcej aktywnych projektów jednocześnie.
  maxParallel: number;
  // Oddanie: false — od razu po ukończeniu techniki; true — po testach i naprawach (i designie),
  // najpóźniej w dniu terminu.
  waitForQuality: boolean;
  // Zapas na przyjęcie zlecenia: szacowany czas ≤ termin × slack.
  slack: number;
};

export type MissionResult = {
  strategy: string;
  seed: number;
  status: 'won' | 'bankrupt' | 'timeout';
  day: number;
  delivered: number;
  cash: number;
  minCash: number;
  reputation: number;
  lateDeliveries: number;
  remainingBugs: number;
  teamSize: number;
  smokers: number;
};

const SPEED = 4;
// Decyzje gracza co tyle kroków symulacji (dzień = 6000 kroków) — „co godzinę gry”.
const DECISION_STEPS = 750;
const MAX_DAYS = 80;
// Szacunkowa sprawność (przerwy, chodzenie, zmęczenie) przy planowaniu terminów.
const EFFICIENCY = 0.7;
// Zapas gotówki (w dniach kosztów) przy zatrudnianiu i próg „brakuje pieniędzy” przy oddawaniu.
const RESERVE_DAYS = 6;
const CASH_SHORT_DAYS = 3;

export function runMission(
  strategy: Strategy,
  seed: number,
  config: BalanceConfig,
  trace?: (line: string) => void,
): MissionResult {
  const engine = createEngine({ config, initialState: createInitialState(config, seed) });
  const bot = new MissionBot(engine, strategy, config, trace);
  return bot.run(seed);
}

class MissionBot {
  private minCash: number;
  private grown = 0;
  private lastHireDay = 0;
  private lateDeliveries = 0;
  private remainingBugs = 0;

  private readonly engine: Engine;
  private readonly strategy: Strategy;
  private readonly config: BalanceConfig;

  private readonly trace: ((line: string) => void) | undefined;

  constructor(
    engine: Engine,
    strategy: Strategy,
    config: BalanceConfig,
    trace?: (line: string) => void,
  ) {
    this.trace = trace;
    this.engine = engine;
    this.strategy = strategy;
    this.config = config;
    this.minCash = engine.getState().finance.cash;
  }

  private get state(): GameState {
    return this.engine.getState();
  }

  private send(command: Command): boolean {
    return this.engine.dispatch(command).ok;
  }

  run(seed: number): MissionResult {
    // Start (MIS-01): dzień pracy na pauzie — zespół, biurka, pierwsze zlecenie.
    for (const hire of this.strategy.team) this.hire(hire);
    this.manage();
    let steps = 0;
    let idle = 0;
    while (this.state.mission.status === 'active' && this.state.mission.day <= MAX_DAYS) {
      const { mission, events } = this.state;
      // Bezpiecznik: decyzje bez kroku symulacji nie mogą kręcić się w kółko.
      if (++idle > 200) {
        throw new Error(
          `Bot utknął: dzień ${mission.day}, faza ${mission.phase}, tempo ${mission.speed}, zdarzenie ${events.pending?.templateId ?? '-'}`,
        );
      }
      if (events.pending) {
        this.resolveEvent();
        continue;
      }
      if (mission.phase === 'workEnded') {
        this.deliverDue(true);
        this.send({ type: 'SettleDay' });
        this.minCash = Math.min(this.minCash, this.state.finance.cash);
        this.traceDay();
        continue;
      }
      if (mission.phase === 'settled') {
        this.send({ type: 'StartNextDay' });
        continue;
      }
      if (mission.phase === 'working' && steps % DECISION_STEPS === 0) {
        if (mission.speed !== 0) this.send({ type: 'SetSpeed', speed: 0 });
        this.manage();
      }
      if (this.state.mission.speed === 0) this.send({ type: 'SetSpeed', speed: SPEED });
      this.engine.step();
      steps++;
      idle = 0;
    }
    const { mission, finance, staff } = this.state;
    const employees = Object.values(staff.employees);
    return {
      strategy: this.strategy.name,
      seed,
      status: mission.status === 'active' ? 'timeout' : mission.status,
      day: mission.day,
      delivered: this.state.contracts.deliveredCount,
      cash: finance.cash,
      minCash: this.minCash,
      reputation: mission.reputation,
      lateDeliveries: this.lateDeliveries,
      remainingBugs: this.remainingBugs,
      teamSize: employees.length,
      smokers: employees.filter((e) => (personById(e.personId)?.cigarettesPerDay ?? 0) > 0).length,
    };
  }

  private traceDay(): void {
    if (!this.trace) return;
    const s = this.state;
    const projects = this.activeProjects()
      .map((p) => {
        const left = TECH_SPECIALIZATIONS.map((t) => remainingPoints(p, t) / POINT_SCALE)
          .filter((x) => x > 0)
          .map((x) => Math.round(x))
          .join('+');
        return `${p.templateId}(T${p.deadlineDay} ${left || 'gotowy'} q${testQueue(p, this.config).length} b${detectedBugCount(p, this.config)})`;
      })
      .join(' ');
    const team = this.employees()
      .map((e) => `${e.specialization[0]}${e.seniority[0]}`)
      .join(',');
    this.trace(
      `d${s.mission.day} cash ${s.finance.cash} rep ${s.mission.reputation} odd ${s.contracts.deliveredCount} [${team}] ${projects}`,
    );
  }

  // --- Zarządzanie (na pauzie, w dzień pracy) ---

  private manage(): void {
    if (this.state.mission.phase !== 'working') return;
    this.deliverDue(false);
    this.grow();
    this.ensureDesks();
    this.acceptOffers();
    this.assign();
  }

  private employees(): Employee[] {
    return Object.values(this.state.staff.employees);
  }

  private activeProjects(): ReadonlyProject[] {
    return Object.values(this.state.contracts.projects).filter((p) => p.status === 'active');
  }

  private hire(hire: Hire): boolean {
    const candidate = this.state.staff.candidates.find(
      (c) => c.specialization === hire.specialization && c.seniority === hire.seniority,
    );
    if (!candidate) return false;
    if (!this.send({ type: 'HireCandidate', candidateId: candidate.id })) return false;
    this.ensureDesks();
    return true;
  }

  // Dzienne koszty stałe: pensje i utrzymanie biura.
  private dailyCosts(): number {
    return (
      this.employees().reduce((sum, e) => sum + e.dailyWage, 0) +
      this.config.finance.officeUpkeepPerDay
    );
  }

  // Rozbudowa: najwyżej jedna osoba dziennie i tylko z zapasem na kilka dni kosztów.
  private grow(): void {
    const next = this.strategy.growth[this.grown];
    const { day } = this.state.mission;
    if (!next || day <= this.lastHireDay) return;
    const wage = this.config.staff.dailyWage[next.seniority];
    const reserve = (this.dailyCosts() + wage) * RESERVE_DAYS;
    if (this.state.finance.cash < Math.max(this.strategy.growthCash, reserve)) return;
    if (this.hire(next)) {
      this.grown++;
      this.lastHireDay = day;
    }
    // Więcej osób — więcej miejsc odpoczynku (kolejki to czas bez pracy).
    const count = this.employees().length;
    const furniture = Object.values(this.state.world.furniture);
    const coffee = furniture.filter((f) => f.type === 'coffeeMachine').length;
    const sofas = furniture.filter((f) => f.type === 'sofa').length;
    if (count >= 5 * coffee) this.buy('coffeeMachine');
    if (count >= 6 * sofas) this.buy('sofa');
  }

  private ensureDesks(): void {
    for (const employee of this.employees()) {
      if (employee.deskId) continue;
      const taken = new Set(this.employees().map((e) => e.deskId));
      let desk = Object.values(this.state.world.furniture).find(
        (f) => f.type === 'desk' && !taken.has(f.id),
      );
      if (!desk && this.buy('desk')) {
        desk = Object.values(this.state.world.furniture).find(
          (f) => f.type === 'desk' && !taken.has(f.id),
        );
      }
      if (desk) this.send({ type: 'AssignDesk', employeeId: employee.id, deskId: desk.id });
    }
  }

  private buy(type: FurnitureType): boolean {
    if (this.state.finance.cash < this.config.furniture.prices[type] + 3_000) return false;
    const { width, height } = officeLayoutOf(this.state).size;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        for (const rotation of ROTATIONS) {
          if (
            this.send({ type: 'BuyFurniture', furnitureType: type, origin: { x, y }, rotation })
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Dzienna wydajność zespołu w specjalizacji (pp/dzień, z zapasem na przerwy).
  private rate(specialization: TechSpecialization): number {
    return this.employees()
      .filter((e) => e.specialization === specialization)
      .reduce((sum, e) => sum + this.config.staff.workPointsPerDay[e.seniority] * EFFICIENCY, 0);
  }

  private backlog(specialization: TechSpecialization): number {
    return this.activeProjects().reduce(
      (sum, p) => sum + remainingPoints(p, specialization) / POINT_SCALE,
      0,
    );
  }

  private feasible(offer: Offer): boolean {
    return TECH_SPECIALIZATIONS.every((s) => {
      const scope = offer.scopes[s];
      if (!scope) return true;
      const rate = this.rate(s);
      if (rate === 0) return false;
      return (this.backlog(s) + scope) / rate <= offer.deadlineDays * this.strategy.slack;
    });
  }

  private acceptOffers(): void {
    for (;;) {
      if (this.activeProjects().length >= this.strategy.maxParallel) return;
      const candidates = this.state.contracts.offers
        .filter((o) => this.feasible(o))
        .sort((a, b) => b.reward / workOf(b) - a.reward / workOf(a));
      const best = candidates[0];
      if (!best || !this.send({ type: 'AcceptOffer', offerId: best.id })) return;
    }
  }

  private assign(): void {
    const projects = [...this.activeProjects()].sort((a, b) => a.deadlineDay - b.deadlineDay);
    const pmTaken = new Set<ProjectId>();
    for (const employee of this.employees()) {
      const target = this.targetFor(employee, projects, pmTaken);
      if (target === undefined) continue;
      if (employee.projectId !== target) {
        this.send({ type: 'AssignProject', employeeId: employee.id, projectId: target });
      }
      if (employee.specialization === 'pm' && target) pmTaken.add(target);
    }
  }

  private targetFor(
    employee: Employee,
    projects: ReadonlyProject[],
    pmTaken: Set<ProjectId>,
  ): ProjectId | null | undefined {
    const { specialization } = employee;
    if (specialization === 'qa') {
      // Najpierw projekty gotowe technicznie (czekają na oddanie), potem najbliższy termin.
      const withQueue = projects.filter((p) => testQueue(p, this.config).length > 0);
      const ready = withQueue.filter((p) => isReadyForDelivery(p));
      return (ready[0] ?? withQueue[0])?.id ?? null;
    }
    if (specialization === 'designer') {
      return projects.find((p) => remainingDesign(p) > 0)?.id ?? null;
    }
    if (specialization === 'pm') {
      // Projekt z największą pozostałą pracą techniczną, bez innego PM-a.
      const ranked = [...projects].sort((a, b) => totalRemaining(b) - totalRemaining(a));
      return ranked.find((p) => !pmTaken.has(p.id) && totalRemaining(p) > 0)?.id ?? null;
    }
    const tech = specialization as TechSpecialization;
    const openBugs = (p: ReadonlyProject) =>
      p.fragments.some(
        (f) =>
          f.specialization === tech &&
          f.hasBug &&
          f.testProgress >= this.config.bugs.fragmentPoints * POINT_SCALE &&
          f.repairProgress < this.config.bugs.repairPoints * POINT_SCALE,
      );
    // Najpierw naprawy w projektach, w których zakres tej roli jest skończony (zbliżają się do
    // oddania), potem nowy zakres według terminu, potem pozostałe naprawy.
    const repairs = projects.filter((p) => remainingPoints(p, tech) <= 0 && openBugs(p));
    if (this.strategy.waitForQuality && repairs[0]) return repairs[0].id;
    const withScope = projects.find((p) => remainingPoints(p, tech) > 0);
    if (withScope) return withScope.id;
    return repairs[0]?.id ?? employee.projectId ?? null;
  }

  private deliverDue(endOfDay: boolean): void {
    const day = this.state.mission.day;
    const hasQa = this.employees().some((e) => e.specialization === 'qa');
    const hasDesigner = this.employees().some((e) => e.specialization === 'designer');
    for (const project of this.activeProjects()) {
      if (!isReadyForDelivery(project)) continue;
      // Termin: w dniu terminu (przed rozliczeniem) albo dzień wcześniej pod koniec dnia.
      const deadline = endOfDay ? day >= project.deadlineDay - 1 : day >= project.deadlineDay;
      const late = day > project.deadlineDay;
      const cashShort = this.state.finance.cash < this.dailyCosts() * CASH_SHORT_DAYS;
      const tested = !hasQa || testQueue(project, this.config).length === 0;
      const fixed = detectedBugCount(project, this.config) === 0;
      const designed = !hasDesigner || remainingDesign(project) <= 0;
      const ready = !this.strategy.waitForQuality || (tested && fixed && designed);
      if (!(ready || deadline || late || cashShort)) continue;
      if (this.send({ type: 'DeliverProject', projectId: project.id })) {
        const delivered = this.state.contracts.projects[project.id];
        if (delivered?.delivery) {
          if (delivered.delivery.daysLate > 0) this.lateDeliveries++;
          this.remainingBugs += delivered.delivery.remainingBugs;
        }
      }
    }
  }

  // Zdarzenia: odpowiedź bez skutków, jeśli jest; inaczej o najmniejszej liczbie skutków.
  private resolveEvent(): void {
    const pending = this.state.events.pending;
    const template = EVENT_TEMPLATES.find((t) => t.id === pending?.templateId);
    if (!template) return;
    const option = [...template.options].sort((a, b) => a.effects.length - b.effects.length)[0];
    if (option) this.send({ type: 'ResolveEvent', optionId: option.id });
  }
}

function workOf(offer: Offer): number {
  return Object.values(offer.scopes).reduce((sum, s) => sum + (s ?? 0), 0) || 1;
}

function totalRemaining(project: ReadonlyProject): number {
  return TECH_SPECIALIZATIONS.reduce((sum, s) => sum + remainingPoints(project, s), 0);
}
