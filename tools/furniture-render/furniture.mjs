// Kompozycje mebli gry z modeli paczki VNB Low Poly Office Set 2 (układ modelu: metry, z w górę,
// przód mebla w stronę −y = strona punktów korzystania w grze, +y siatki).
const M = 0.75; // metry na kafel

// Środek krzesła biurka względem środka biurka (m, układ modelu) — gra liczy z tego miejsce
// siedzącej postaci (src/rendering/agentPose.ts: DESK_SEAT).
export const CHAIR = { x: -0.05, y: -0.33 };
// Wysokość cięcia krzesła na siedzisko i oparcie (m nad podłogą): poduszka kończy się na 0,59 m,
// słupek oparcia zaczyna się od 0,65 m.
const CHAIR_CUT = 0.62;
const chairItems = [
  // Podstawa krzesła ma gwiazdę na wysokości 7 cm (bez kółek) — opuszczamy całe krzesło.
  { model: 'Chair_Base', at: [CHAIR.x, CHAIR.y, -0.07] },
  { model: 'Chair_Body', at: [CHAIR.x, CHAIR.y, -0.07], rotZ: 180 },
];

// Ekspres spoza paczki — proste bryły w stylu low poly (czerwony korpus jak na grafikach paczki).
const espresso = (x, y, z) => ({
  boxes: [
    { size: [0.3, 0.32, 0.04], at: [x, y, z], color: 0x2b2b2b },
    { size: [0.3, 0.12, 0.32], at: [x, y + 0.1, z + 0.04], color: 0xb3262b },
    { size: [0.3, 0.32, 0.06], at: [x, y, z + 0.34], color: 0xb3262b },
    {
      size: [0.2, 0.1, 0.03],
      at: [x, y - 0.06, z + 0.04],
      color: 0x9a9a9a,
      metalness: 0.4,
      roughness: 0.4,
    },
    { size: [0.07, 0.07, 0.07], at: [x, y - 0.07, z + 0.07], color: 0xf4f1ea, cylinder: true },
    { size: [0.06, 0.06, 0.05], at: [x, y - 0.07, z + 0.27], color: 0x3a3a3a, cylinder: true },
    { size: [0.18, 0.02, 0.05], at: [x, y - 0.16, z + 0.3], color: 0x1d1d1d },
  ],
  at: [0, 0, 0],
});

export const FURNITURE = {
  desk: {
    footprint: { w: 3, h: 2 },
    metersPerTile: M,
    items: [
      { model: 'Desk_2', at: [0, 0.36, 0] },
      { model: 'Pc_Monitor', at: [-0.05, 0.52, 0.95] },
      { model: 'Pc_Keyboard', at: [-0.05, 0.22, 0.95] },
      { model: 'Pc_Mouse_Pad', at: [0.32, 0.22, 0.95] },
      { model: 'Pc_Mouse', at: [0.32, 0.22, 0.965] },
      { model: 'Pc_Case', at: [0.58, 0.45, 0.95], rotZ: 0 },
    ],
  },
  // Krzesło biurka w dwóch warstwach (ten sam footprint i kotwica): siedzisko z podstawą zawsze
  // pod siedzącą postacią, oparcie — przed nią albo za nią zależnie od obrotu biurka.
  deskChairSeat: {
    footprint: { w: 3, h: 2 },
    metersPerTile: M,
    clip: { keep: 'below', heightM: CHAIR_CUT },
    items: chairItems,
  },
  deskChairBack: {
    footprint: { w: 3, h: 2 },
    metersPerTile: M,
    clip: { keep: 'above', heightM: CHAIR_CUT },
    shadow: false,
    items: chairItems,
  },
  sofa: {
    footprint: { w: 3, h: 2 },
    metersPerTile: M,
    items: [{ model: 'Sofa_3', at: [0, 0.25, 0] }],
  },
  coffeeMachine: {
    footprint: { w: 1, h: 1 },
    metersPerTile: M,
    items: [{ model: 'Drawer_1', at: [0, 0.05, 0] }, espresso(0, 0.05, 0.92)],
  },
  plant: {
    footprint: { w: 1, h: 1 },
    metersPerTile: M,
    // Deco to miniaturowe kaktusy bez rzeczywistej skali — jak w scenach autora paczki rozciągamy je
    // do rośliny podłogowej w wysokiej donicy (ok. 0,8 × 0,8 × 1,4 m).
    items: [{ model: 'Deco_3', at: [0, 0, 0], scale: [8, 8, 16] }],
  },
};
