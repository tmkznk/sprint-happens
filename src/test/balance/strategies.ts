import type { Hire, Strategy } from './missionBot';

// SH-044: strategie do porównania (kryterium 2): rozsądny gracz i warianty bez QA, PM-a,
// Designera, z innym seniority, bez rozbudowy zespołu i z oddawaniem od razu.
const h = (specialization: Hire['specialization'], seniority: Hire['seniority']): Hire => ({
  specialization,
  seniority,
});

const CORE: Hire[] = [h('frontend', 'mid'), h('backend', 'mid'), h('devops', 'junior')];
const GROWTH: Hire[] = [
  h('qa', 'mid'),
  h('frontend', 'mid'),
  h('qa', 'junior'),
  h('pm', 'mid'),
  h('backend', 'mid'),
  h('mobile', 'mid'),
  h('designer', 'junior'),
  h('qa', 'mid'),
];

const base: Strategy = {
  name: 'rozsądny',
  team: CORE,
  growth: GROWTH,
  growthCash: 20_000,
  maxParallel: 3,
  waitForQuality: true,
  slack: 1,
};

export const STRATEGIES: Strategy[] = [
  base,
  { ...base, name: 'bez QA', growth: GROWTH.filter((x) => x.specialization !== 'qa') },
  { ...base, name: 'bez PM', growth: GROWTH.filter((x) => x.specialization !== 'pm') },
  {
    ...base,
    name: 'bez designera',
    growth: GROWTH.filter((x) => x.specialization !== 'designer'),
  },
  {
    ...base,
    name: 'same juniory',
    team: CORE.map((x) => h(x.specialization, 'junior')),
    growth: GROWTH.map((x) => h(x.specialization, 'junior')),
  },
  {
    ...base,
    name: 'seniorzy',
    team: CORE.map((x) => h(x.specialization, 'senior')),
    growth: GROWTH.map((x) => h(x.specialization, 'senior')),
  },
  { ...base, name: 'bez rozbudowy', growth: [] },
  { ...base, name: 'oddaje od razu', waitForQuality: false },
];
