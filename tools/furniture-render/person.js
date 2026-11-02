// Własna postać: obłe bryły (lofty przekrojów eliptycznych) i tekstury rysowane w kodzie, gładkie
// cieniowanie. Hierarchia stawów, pozy liczone w render.html. Postać patrzy w stronę +Z.
/* global document */
import * as THREE from 'three';

export const CIGARETTE_LENGTH = 0.14;
// Powiększona głowa nadaje postaci styl „cute” (wybór właściciela, wariant B).
export const HEAD_SCALE = 1.42;
const HEAD_BASE_Y = 1.522; // głowa nad podłogą w pozie stojącej (biodra + kręgosłup + szyja)
const MOUTH_LOCAL = { y: 0.06, z: 0.097 };
const BEARD_LIFT = 0.012;
// Usta w układzie modelu, stojąca postać — stąd wychodzi dym.
export const MOUTH = new THREE.Vector3(
  0,
  HEAD_BASE_Y + MOUTH_LOCAL.y * HEAD_SCALE,
  MOUTH_LOCAL.z * HEAD_SCALE,
);

// ---------- Tekstury ----------
let seed = 0;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

function canvasTexture(size, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

// Mieszanie w sRGB: `amount` > 0 rozjaśnia, < 0 przyciemnia.
function shade(hex, amount) {
  const c = new THREE.Color(hex).convertLinearToSRGB();
  const target = amount > 0 ? 1 : 0;
  const a = Math.abs(amount);
  const channel = (v) => Math.round((v + (target - v) * a) * 255);
  return `rgb(${channel(c.r)},${channel(c.g)},${channel(c.b)})`;
}

function mix(hexA, hexB, amount) {
  const color = new THREE.Color(hexA).lerp(new THREE.Color(hexB), amount);
  return `#${color.getHexString()}`;
}

function weave(g, s, count) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.04)';
    g.fillRect(rnd() * s, rnd() * s, 2, 2);
  }
}

function fold(g, [x0, y0, x1, y1], width, color) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x0, y0);
  g.quadraticCurveTo((x0 + x1) / 2 + width, (y0 + y1) / 2, x1, y1);
  g.stroke();
}

// Koszulka: tkanina, miękkie fałdy, dekolt z lamówką, ściągacz u dołu. u = 0,5 to przód.
function shirtTexture(shirt, skin) {
  return canvasTexture(512, (g, s) => {
    g.fillStyle = shirt;
    g.fillRect(0, 0, s, s);
    weave(g, s, 26000);
    g.filter = 'blur(7px)';
    for (const [x0, y0, x1, y1, w] of [
      [150, 300, 240, 420, 14],
      [362, 300, 280, 430, 14],
      [190, 200, 240, 300, 10],
      [322, 190, 275, 290, 10],
      [80, 260, 110, 440, 14],
      [430, 260, 400, 440, 14],
      [20, 240, 40, 420, 16],
      [490, 240, 470, 420, 16],
    ]) {
      fold(g, [x0, y0, x1, y1], w, 'rgba(0,0,0,.11)');
      fold(g, [x0 + 14, y0, x1 + 14, y1], w * 0.7, 'rgba(255,255,255,.09)');
    }
    g.filter = 'none';
    g.fillStyle = skin;
    g.beginPath();
    g.ellipse(256, 0, 48, 46, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = shade(shirt, -0.3);
    g.lineWidth = 7;
    g.beginPath();
    g.ellipse(256, 0, 51, 49, 0, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = shade(shirt, -0.3);
    g.fillRect(0, 0, 90, 8);
    g.fillRect(422, 0, 90, 8);
    g.fillStyle = shade(shirt, -0.12);
    g.fillRect(0, s - 22, s, 22);
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.fillRect(0, s - 24, s, 3);
  });
}

function sleeveTexture(shirt) {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = shirt;
    g.fillRect(0, 0, s, s);
    weave(g, s, 9000);
    g.filter = 'blur(5px)';
    fold(g, [40, 80, 110, 150], 10, 'rgba(0,0,0,.2)');
    fold(g, [180, 110, 230, 180], 10, 'rgba(0,0,0,.2)');
    g.filter = 'none';
    g.fillStyle = shade(shirt, -0.28);
    g.fillRect(0, s - 26, s, 26);
    g.fillStyle = 'rgba(0,0,0,.3)';
    g.fillRect(0, s - 28, s, 3);
  });
}

// Spodnie: splot skośny dżinsu, szew boczny, jaśniejsze przetarcie z przodu.
function denimTexture(pants) {
  return canvasTexture(512, (g, s) => {
    g.fillStyle = pants;
    g.fillRect(0, 0, s, s);
    g.lineWidth = 1.4;
    for (let i = -s; i < s * 2; i += 5) {
      g.strokeStyle = i % 10 === 0 ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.14)';
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + s / 2, s);
      g.stroke();
    }
    const fade = g.createRadialGradient(256, 260, 10, 256, 260, 190);
    fade.addColorStop(0, 'rgba(255,255,255,.20)');
    fade.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = fade;
    g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.fillRect(124, 0, 5, s);
    g.fillRect(382, 0, 5, s);
    g.fillStyle = 'rgba(255,220,160,.25)';
    g.fillRect(131, 0, 2, s);
    g.fillRect(378, 0, 2, s);
  });
}

// Włosy: pasma wzdłuż v i pas połysku, oba w odcieniach koloru włosów.
function hairTexture(hair) {
  const light = shade(hair, 0.28);
  return canvasTexture(512, (g, s) => {
    g.fillStyle = hair;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const x = rnd() * s;
      g.globalAlpha = rnd() > 0.45 ? 0.08 + rnd() * 0.22 : 0.08 + rnd() * 0.2;
      g.strokeStyle = rnd() > 0.45 ? light : '#000';
      g.lineWidth = 1 + rnd() * 3;
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(
        x + rnd() * 14 - 7,
        s / 3,
        x + rnd() * 14 - 7,
        (2 * s) / 3,
        x + rnd() * 10 - 5,
        s,
      );
      g.stroke();
    }
    g.globalAlpha = 1;
    const sheen = g.createLinearGradient(0, s * 0.1, 0, s * 0.5);
    sheen.addColorStop(0, 'rgba(255,235,210,0)');
    sheen.addColorStop(0.5, 'rgba(255,235,210,.18)');
    sheen.addColorStop(1, 'rgba(255,235,210,0)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, s, s);
  });
}

// ---------- Geometria ----------
const catmullRom = (a, b, c, d, t) =>
  0.5 *
  (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);

// Bryła z przekrojów eliptycznych wzdłuż osi Y: { y, rx, rz, cx?, cz? }. Przekroje wygładzane
// splajnem; u = 0,5 to przód (+Z), v rośnie ku górze.
function loft(input, { radial = 28, sub = 5, p = 2 } = {}) {
  const sections = [...input].sort((a, b) => a.y - b.y);
  const rows = [];
  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[Math.max(0, i - 1)];
    const b = sections[i];
    const c = sections[i + 1];
    const d = sections[Math.min(sections.length - 1, i + 2)];
    for (let k = 0; k < sub; k++) {
      const t = k / sub;
      const at = (key) => catmullRom(a[key] ?? 0, b[key] ?? 0, c[key] ?? 0, d[key] ?? 0, t);
      rows.push({
        y: b.y + (c.y - b.y) * t,
        rx: Math.max(0.0005, at('rx')),
        rz: Math.max(0.0005, at('rz')),
        cx: at('cx'),
        cz: at('cz'),
      });
    }
  }
  const last = sections[sections.length - 1];
  rows.push({ y: last.y, rx: last.rx, rz: last.rz, cx: last.cx ?? 0, cz: last.cz ?? 0 });
  const yMin = rows[0].y;
  const yMax = rows[rows.length - 1].y;
  const position = [];
  const uv = [];
  const index = [];
  for (const row of rows) {
    for (let j = 0; j <= radial; j++) {
      const angle = -Math.PI + (j / radial) * Math.PI * 2;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      position.push(
        row.cx + row.rx * Math.sign(sin) * Math.abs(sin) ** (2 / p),
        row.y,
        row.cz + row.rz * Math.sign(cos) * Math.abs(cos) ** (2 / p),
      );
      uv.push(j / radial, (row.y - yMin) / (yMax - yMin));
    }
  }
  const width = radial + 1;
  for (let i = 0; i < rows.length - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * width + j;
      const b = a + 1;
      const c = a + width;
      const d = c + 1;
      index.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  // Szew: wspólna normalna pierwszej i ostatniej kolumny.
  const normal = geometry.attributes.normal;
  for (let i = 0; i < rows.length; i++) {
    const a = i * width;
    const b = a + radial;
    const n = new THREE.Vector3(
      normal.getX(a) + normal.getX(b),
      normal.getY(a) + normal.getY(b),
      normal.getZ(a) + normal.getZ(b),
    ).normalize();
    normal.setXYZ(a, n.x, n.y, n.z);
    normal.setXYZ(b, n.x, n.y, n.z);
  }
  return geometry;
}

const smooth = (props) => new THREE.MeshStandardMaterial({ roughness: 0.82, ...props });

function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  return m;
}

function ball(rx, ry, rz, material, x = 0, y = 0, z = 0) {
  const geometry = new THREE.SphereGeometry(1, 24, 18);
  geometry.scale(rx, ry, rz);
  return mesh(geometry, material, x, y, z);
}

function joint(parent, x, y, z = 0) {
  const j = new THREE.Group();
  j.position.set(x, y, z);
  parent.add(j);
  return j;
}

// Kończyna: kapsuła o zmiennym promieniu, z „brzuścem” mięśnia.
function limb(rTop, rBottom, len, belly, bellyAt) {
  const section = (y, r) => ({ y, rx: r, rz: r });
  return loft(
    [
      section(rTop * 0.72, 0.001),
      section(rTop * 0.55, rTop * 0.75),
      section(0, rTop),
      section(-len * bellyAt, rTop + (rBottom - rTop) * bellyAt + belly),
      section(-len * 0.72, rTop + (rBottom - rTop) * 0.72),
      section(-len, rBottom),
      section(-len - rBottom * 0.55, rBottom * 0.75),
      section(-len - rBottom * 0.72, 0.001),
    ],
    { radial: 20, sub: 4 },
  );
}

// ---------- Włosy ----------
function addHair(head, onFace, hairStyle, hairMat, accentMat) {
  const add = (object) => head.add(object);
  const cap = (tilt = -0.36) => {
    const m = mesh(
      loft(
        [
          { y: 0.0, rx: 0.11, rz: 0.11, cz: -0.012 },
          { y: 0.06, rx: 0.113, rz: 0.116, cz: -0.009 },
          { y: 0.105, rx: 0.092, rz: 0.098, cz: -0.006 },
          { y: 0.135, rx: 0.05, rz: 0.054, cz: -0.006 },
          { y: 0.146, rx: 0.003, rz: 0.003, cz: -0.006 },
        ],
        { radial: 36 },
      ),
      hairMat,
      0,
      0.122,
      -0.004,
    );
    m.rotation.x = tilt;
    add(m);
  };
  // Pasmo grzywki: elipsoida głęboko w głowie, więc końce chowają się w krzywiźnie zamiast odstawać.
  const lock = (g, w, h, tilt) => {
    const m = ball(w, h, 0.03, hairMat, 0, 0, -0.012);
    m.rotation.z = tilt;
    g.add(m);
  };
  // Grzywka: dwa pasma rozchodzące się od przedziałka.
  const fringe = (left = 0.05, right = 0.038) => {
    for (const [side, w, tilt] of [
      [-1, left, 0.42],
      [1, right, -0.5],
    ]) {
      onFace(side * 0.03, 0.181, (g) => lock(g, w, 0.019, tilt));
    }
  };
  // Boki: od skroni w dół do `bottom`, cofnięte tak, by nie zasłaniać dalszego oka.
  const sides = (bottom) => {
    for (const side of [-1, 1]) {
      const mid = Math.max(bottom + 0.05, 0.03);
      add(
        mesh(
          loft([
            { y: bottom, rx: 0.003, rz: 0.003, cx: side * 0.098, cz: -0.012 },
            { y: bottom + 0.018, rx: 0.026, rz: 0.036, cx: side * 0.1, cz: -0.014 },
            { y: mid, rx: 0.03, rz: 0.056, cx: side * 0.106, cz: -0.026 },
            { y: 0.11, rx: 0.024, rz: 0.066, cx: side * 0.102, cz: -0.028 },
            { y: 0.18, rx: 0.018, rz: 0.06, cx: side * 0.086, cz: -0.018 },
            { y: 0.215, rx: 0.003, rz: 0.008, cx: side * 0.07, cz: -0.012 },
          ]),
          hairMat,
        ),
      );
    }
  };
  // Masa włosów z tyłu, zaokrąglona na końcu.
  const back = (bottom) => {
    add(
      mesh(
        loft(
          [
            { y: bottom, rx: 0.003, rz: 0.003, cz: -0.096 },
            { y: bottom + 0.017, rx: 0.08, rz: 0.04, cz: -0.096 },
            { y: bottom + 0.085, rx: 0.122, rz: 0.058, cz: -0.088 },
            { y: Math.max(bottom + 0.14, 0.09), rx: 0.122, rz: 0.07, cz: -0.066 },
            { y: Math.max(bottom + 0.2, 0.15), rx: 0.112, rz: 0.072, cz: -0.05 },
            { y: 0.2, rx: 0.086, rz: 0.058, cz: -0.044 },
            { y: 0.228, rx: 0.003, rz: 0.003, cz: -0.04 },
          ],
          { radial: 36 },
        ),
        hairMat,
      ),
    );
  };
  // Krótko przy karku: czasza schodzi nisko z tyłu.
  const nape = () => {
    add(
      mesh(
        loft(
          [
            { y: 0.035, rx: 0.003, rz: 0.003, cz: -0.056 },
            { y: 0.05, rx: 0.07, rz: 0.04, cz: -0.056 },
            { y: 0.1, rx: 0.102, rz: 0.066, cz: -0.044 },
            { y: 0.17, rx: 0.098, rz: 0.066, cz: -0.036 },
            { y: 0.212, rx: 0.003, rz: 0.003, cz: -0.03 },
          ],
          { radial: 36 },
        ),
        hairMat,
      ),
    );
  };
  const sideburns = () => {
    for (const side of [-1, 1]) add(ball(0.012, 0.042, 0.024, hairMat, side * 0.098, 0.128, 0.002));
  };

  if (hairStyle === 'long') {
    cap();
    fringe();
    sides(-0.085);
    back(-0.135);
  }
  if (hairStyle === 'bob') {
    cap();
    fringe();
    sides(0.02);
    back(-0.02);
  }
  if (hairStyle === 'bun') {
    cap();
    fringe(0.042, 0.034);
    nape();
    sideburns();
    add(ball(0.052, 0.048, 0.052, hairMat, 0, 0.226, -0.066));
    add(ball(0.03, 0.012, 0.03, accentMat, 0, 0.19, -0.052));
  }
  if (hairStyle === 'ponytail') {
    cap();
    fringe(0.042, 0.034);
    nape();
    sideburns();
    add(
      mesh(
        loft([
          { y: -0.165, rx: 0.004, rz: 0.004, cz: -0.13 },
          { y: -0.13, rx: 0.026, rz: 0.026, cz: -0.15 },
          { y: -0.03, rx: 0.04, rz: 0.04, cz: -0.162 },
          { y: 0.09, rx: 0.038, rz: 0.04, cz: -0.15 },
          { y: 0.17, rx: 0.024, rz: 0.026, cz: -0.122 },
        ]),
        hairMat,
      ),
    );
    add(ball(0.03, 0.022, 0.026, accentMat, 0, 0.165, -0.112));
  }
  if (hairStyle === 'short' || hairStyle === 'beard') {
    cap();
    nape();
    sideburns();
    onFace(-0.012, 0.181, (g) => lock(g, 0.06, 0.016, 0.2));
  }
  if (hairStyle === 'quiff') {
    cap(-0.42);
    nape();
    sideburns();
    const quiff = ball(0.072, 0.036, 0.05, hairMat, 0, 0.212, 0.07);
    quiff.rotation.x = -0.5;
    add(quiff);
  }
  if (hairStyle === 'bald') {
    // Wieniec włosów nisko z tyłu głowy i nad uszami.
    add(ball(0.096, 0.04, 0.05, hairMat, 0, 0.098, -0.06));
    for (const side of [-1, 1]) add(ball(0.012, 0.032, 0.04, hairMat, side * 0.096, 0.112, -0.022));
  }
  if (hairStyle === 'beard') {
    // Pełna broda: cała dolna część twarzy; usta leżą na niej (BEARD_LIFT).
    add(
      mesh(
        loft(
          [
            { y: -0.014, rx: 0.003, rz: 0.003, cz: 0.012 },
            { y: 0.0, rx: 0.056, rz: 0.058, cz: 0.012 },
            { y: 0.03, rx: 0.09, rz: 0.088, cz: 0.01 },
            { y: 0.058, rx: 0.102, rz: 0.098, cz: 0.004 },
            { y: 0.078, rx: 0.106, rz: 0.098, cz: 0.0 },
            { y: 0.088, rx: 0.003, rz: 0.003, cz: 0.0 },
          ],
          { radial: 36 },
        ),
        hairMat,
      ),
    );
    for (const side of [-1, 1]) add(ball(0.011, 0.05, 0.02, hairMat, side * 0.1, 0.095, 0.006));
  }
}

// ---------- Postać ----------
export function buildPerson(look) {
  const { skin, shirt, pants, shoes = '#2b2b2b', hair, hairStyle, glasses } = look;
  seed = 777;
  const skinMat = smooth({ color: skin, roughness: 0.62, emissive: skin, emissiveIntensity: 0.1 });
  const shirtMat = smooth({ map: shirtTexture(shirt, skin), roughness: 0.92 });
  const sleeveMat = smooth({ map: sleeveTexture(shirt), roughness: 0.92 });
  const pantsMat = smooth({ map: denimTexture(pants), roughness: 0.95 });
  const hairMat = smooth({ map: hairTexture(hair), roughness: 0.46 });
  const shoeMat = smooth({ color: shoes, roughness: 0.55 });
  const soleMat = smooth({ color: '#eeeae1', roughness: 0.8 });

  const root = new THREE.Group();
  const hips = joint(root, 0, 0.9);
  const p = { root, hips };
  hips.add(
    mesh(
      loft([
        { y: -0.115, rx: 0.07, rz: 0.05 },
        { y: -0.085, rx: 0.145, rz: 0.076, cz: -0.006 },
        { y: -0.02, rx: 0.158, rz: 0.094, cz: -0.008 },
        { y: 0.05, rx: 0.15, rz: 0.092 },
        { y: 0.075, rx: 0.14, rz: 0.086 },
      ]),
      pantsMat,
    ),
  );
  for (const [side, s] of [
    [-1, 'L'],
    [1, 'R'],
  ]) {
    const thigh = joint(hips, side * 0.085, -0.04);
    thigh.add(mesh(limb(0.077, 0.056, 0.42, 0.006, 0.3), pantsMat));
    const knee = joint(thigh, 0, -0.42);
    knee.add(mesh(limb(0.056, 0.047, 0.4, 0.006, 0.28), pantsMat));
    const ankle = joint(knee, 0, -0.4);
    // But: gumowa podeszwa + obły wierzch, nosek do przodu.
    ankle.add(
      mesh(
        loft(
          [
            { y: -0.065, rx: 0.047, rz: 0.12, cz: 0.05 },
            { y: -0.05, rx: 0.056, rz: 0.13, cz: 0.05 },
            { y: -0.034, rx: 0.054, rz: 0.125, cz: 0.05 },
            { y: -0.03, rx: 0.052, rz: 0.12, cz: 0.05 },
          ],
          { p: 2.4 },
        ),
        soleMat,
      ),
    );
    ankle.add(
      mesh(
        loft([
          { y: -0.036, rx: 0.052, rz: 0.118, cz: 0.05 },
          { y: -0.008, rx: 0.056, rz: 0.112, cz: 0.044 },
          { y: 0.012, rx: 0.048, rz: 0.08, cz: 0.012 },
          { y: 0.035, rx: 0.048, rz: 0.058, cz: -0.012 },
          { y: 0.045, rx: 0.044, rz: 0.05, cz: -0.012 },
        ]),
        shoeMat,
      ),
    );
    p[`thigh${s}`] = thigh;
    p[`knee${s}`] = knee;
  }

  const spine = joint(hips, 0, 0.05);
  // Tułów: talia, klatka, łagodnie opadające barki.
  spine.add(
    mesh(
      loft([
        { y: -0.012, rx: 0.164, rz: 0.104, cz: -0.004 },
        { y: 0.09, rx: 0.152, rz: 0.095 },
        { y: 0.17, rx: 0.156, rz: 0.1, cz: 0.004 },
        { y: 0.3, rx: 0.172, rz: 0.113, cz: 0.008 },
        { y: 0.39, rx: 0.18, rz: 0.106, cz: 0.002 },
        { y: 0.445, rx: 0.15, rz: 0.088, cz: -0.002 },
        { y: 0.49, rx: 0.098, rz: 0.066, cz: -0.004 },
        { y: 0.512, rx: 0.06, rz: 0.052, cz: -0.004 },
        { y: 0.53, rx: 0.05, rz: 0.05 },
      ]),
      shirtMat,
    ),
  );
  p.spine = spine;
  const neck = joint(spine, 0, 0.52);
  neck.add(
    mesh(
      loft([
        { y: -0.03, rx: 0.052, rz: 0.054 },
        { y: 0.03, rx: 0.042, rz: 0.045 },
        { y: 0.1, rx: 0.042, rz: 0.046 },
      ]),
      skinMat,
    ),
  );
  const head = joint(neck, 0, 0.052);
  head.scale.setScalar(HEAD_SCALE);
  // Krągła głowa: niemal kula, miękki podbródek.
  head.add(
    mesh(
      loft(
        [
          { y: 0.0, rx: 0.003, rz: 0.003, cz: 0.006 },
          { y: 0.012, rx: 0.052, rz: 0.052, cz: 0.006 },
          { y: 0.055, rx: 0.09, rz: 0.09, cz: 0.003 },
          { y: 0.12, rx: 0.102, rz: 0.1 },
          { y: 0.185, rx: 0.082, rz: 0.08 },
          { y: 0.222, rx: 0.044, rz: 0.042 },
          { y: 0.24, rx: 0.003, rz: 0.003 },
        ],
        { radial: 36 },
      ),
      skinMat,
    ),
  );
  // Elementy twarzy leżą na powierzchni głowy i są obrócone zgodnie z jej krzywizną.
  const onFace = (x, y, build, lift = 0) => {
    const g = new THREE.Group();
    const dy = (y - 0.12) / 0.12;
    const dx = x / 0.102;
    g.position.set(
      x,
      y,
      0.1 * Math.sqrt(Math.max(0.02, 1 - dx * dx - dy * dy)) +
        (y < 0.09 ? (0.09 - y) * 0.28 : 0) +
        lift,
    );
    g.rotation.set(-Math.asin(Math.max(-1, Math.min(1, dy))) * 0.9, Math.asin(dx), 0);
    build(g);
    head.add(g);
  };
  const eyeMat = smooth({ color: '#241712', roughness: 0.22 });
  const shineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const browMat = smooth({ color: hair, roughness: 0.7 });
  // Rumieniec i usta z karnacji — ten sam odbiór na jasnej i ciemnej skórze.
  const blushMat = new THREE.MeshBasicMaterial({
    color: mix(skin, '#f0504c', 0.55),
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const lipMat = smooth({ color: mix(skin, '#6e1f1c', 0.72), roughness: 0.5 });
  const glassesMat = smooth({ color: '#22262c', roughness: 0.35 });
  for (const side of [-1, 1]) {
    head.add(ball(0.012, 0.022, 0.016, skinMat, side * 0.1, 0.112, 0));
    // Duże oko-koralik z dwoma błyskami, nisko na twarzy.
    onFace(side * 0.046, 0.104, (g) => {
      g.add(ball(0.0195, 0.026, 0.007, eyeMat));
      g.add(ball(0.0072, 0.0082, 0.002, shineMat, -0.0065, 0.0105, 0.0065));
      g.add(ball(0.0036, 0.0036, 0.002, shineMat, 0.0065, -0.0085, 0.0065));
      if (glasses) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.0036, 8, 28), glassesMat);
        rim.position.z = 0.009;
        g.add(rim);
      }
    });
    onFace(side * 0.046, 0.149, (g) => {
      const brow = ball(0.0165, 0.0042, 0.004, browMat);
      brow.rotation.z = side * -0.12;
      g.add(brow);
    });
    onFace(side * 0.07, 0.074, (g) => g.add(ball(0.021, 0.0125, 0.005, blushMat)), 0.002);
    if (glasses) {
      // Zausznik: od oprawki do ucha.
      const arm = ball(0.003, 0.003, 0.05, glassesMat, side * 0.099, 0.108, 0.042);
      head.add(arm);
    }
  }
  if (glasses) {
    onFace(0, 0.112, (g) => g.add(ball(0.016, 0.0032, 0.003, glassesMat)), 0.006);
  }
  onFace(0, 0.082, (g) => g.add(ball(0.0065, 0.005, 0.005, skinMat)));
  // Mały uśmiech.
  onFace(
    0,
    MOUTH_LOCAL.y,
    (g) => {
      const smile = new THREE.Mesh(
        new THREE.TorusGeometry(0.0165, 0.0033, 8, 18, Math.PI * 0.8),
        lipMat,
      );
      smile.position.y = 0.009;
      smile.rotation.z = Math.PI + Math.PI * 0.1;
      g.add(smile);
    },
    hairStyle === 'beard' ? BEARD_LIFT : 0.002,
  );
  addHair(head, onFace, hairStyle, hairMat, smooth({ color: shirt, roughness: 0.6 }));

  for (const [side, s] of [
    [-1, 'L'],
    [1, 'R'],
  ]) {
    const shoulder = joint(spine, side * 0.19, 0.415);
    shoulder.add(mesh(limb(0.05, 0.045, 0.26, 0.002, 0.3), sleeveMat));
    const elbow = joint(shoulder, 0, -0.26);
    elbow.add(ball(0.04, 0.04, 0.04, skinMat));
    elbow.add(mesh(limb(0.04, 0.029, 0.25, 0.005, 0.25), skinMat));
    const hand = joint(elbow, 0, -0.25);
    hand.add(ball(0.038, 0.044, 0.032, skinMat, 0, -0.04, 0));
    hand.add(ball(0.014, 0.02, 0.014, skinMat, side * -0.032, -0.03, 0.016));
    p[`shoulder${s}`] = shoulder;
    p[`elbow${s}`] = elbow;
    p[`hand${s}`] = hand;
  }
  const cupMat = smooth({ color: '#f4f1ea', roughness: 0.35 });
  const cup = mesh(new THREE.CylinderGeometry(0.037, 0.031, 0.09, 24), cupMat, 0, -0.09, 0.03);
  cup.add(mesh(new THREE.TorusGeometry(0.02, 0.006, 8, 16), cupMat, 0.04, 0, 0));
  p.handR.add(cup);
  p.cup = cup;
  // Papieros w prawej dłoni: trzymany w 1/3 długości; kierunek ustawia aimCigarette.
  const cigarette = new THREE.Group();
  cigarette.position.set(0, -0.08, 0.02);
  const paper = mesh(
    new THREE.CylinderGeometry(0.014, 0.014, CIGARETTE_LENGTH, 8),
    smooth({ color: '#f6f1e6' }),
    0,
    CIGARETTE_LENGTH / 6,
  );
  const ember = mesh(
    new THREE.CylinderGeometry(0.017, 0.017, 0.035, 8),
    new THREE.MeshBasicMaterial({ color: 0xff5a1f }),
    0,
    (CIGARETTE_LENGTH * 2) / 3,
  );
  cigarette.add(paper, ember);
  p.handR.add(cigarette);
  p.cigarette = cigarette;
  p.ember = ember;
  root.traverse((node) => {
    if (node.isMesh) node.castShadow = node.receiveShadow = true;
  });
  return p;
}
