import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   환경과 기본 데이터
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const G = 6.67430e-11;
const FIXED_DT = 0.01;
const MAX_HISTORY_STEPS = 12000;

const ENVIRONMENTS = {
  earth: {
    name: "Earth · 지구",
    g: 9.8,
    mu: 0.30,
    cd: 0.47,
    rho: 1.225,
    wind: 0,
    background: 0x08172d,
    floor: 0x606974
  },

  moon: {
    name: "Moon · 달",
    g: 1.62,
    mu: 0.20,
    cd: 0,
    rho: 0,
    wind: 0,
    background: 0x02040a,
    floor: 0x9198a1
  },

  mars: {
    name: "Mars · 화성",
    g: 3.72,
    mu: 0.40,
    cd: 0.47,
    rho: 0.020,
    wind: -3,
    background: 0x260b05,
    floor: 0xb65424
  },

  space: {
    name: "Space · 우주",
    g: 0,
    mu: 0,
    cd: 0,
    rho: 0,
    wind: 0,
    background: 0x000000,
    floor: 0x121721
  },

  vacuum: {
    name: "Vacuum · 지구 중력 진공",
    g: 9.8,
    mu: 0,
    cd: 0,
    rho: 0,
    wind: 0,
    background: 0x06101f,
    floor: 0x444d59
  }
};

const MODE_NAMES = {
  gravity: "포물선 운동",
  freefall: "자유 낙하",
  friction: "마찰 운동",
  drag: "공기저항과 바람",
  collision: "탄성 충돌",
  incline: "빗면 운동",
  circular: "원운동",
  torque: "돌림힘",
  escape: "탈출 속도"
};

const MODE_DEFAULTS = {
  gravity: {
    speed: 15,
    angle: 60
  },

  freefall: {
    speed: 0,
    angle: 270
  },

  friction: {
    speed: 15,
    angle: 0
  },

  drag: {
    speed: 20,
    angle: 35
  },

  collision: {
    speed: 15,
    angle: 0
  },

  incline: {
    speed: 0,
    angle: 0
  },

  circular: {
    speed: 10,
    angle: 0
  },

  torque: {
    speed: 0,
    angle: 0
  },

  escape: {
    speed: 11200,
    angle: 0
  }
};

const FORMULA_HELP = {
  gravity: {
    title: "포물선 운동",
    formula:
      "x = x₀ + v₀cosθ·t\n" +
      "y = y₀ + v₀sinθ·t − ½gt²\n" +
      "vₓ = v₀cosθ,  vᵧ = v₀sinθ − gt",
    description:
      "공기저항이 없을 때 수평 방향의 가속도는 0이고 수직 방향에는 " +
      "중력가속도 −g가 작용합니다. 따라서 수평속도는 일정하고 " +
      "수직속도는 시간에 따라 변합니다."
  },

  freefall: {
    title: "자유 낙하 운동",
    formula:
      "vᵧ = v₀ᵧ − gt\n" +
      "y = y₀ + v₀ᵧt − ½gt²",
    description:
      "물체가 중력만 받아 수직으로 낙하하는 운동입니다. 공기저항을 " +
      "무시하면 질량과 관계없이 같은 위치에서 동일한 중력가속도를 갖습니다."
  },

  friction: {
    title: "수평면 마찰 운동",
    formula:
      "fₖ = μₖN = μₖmg\n" +
      "aₓ = −μₖg · sgn(vₓ)",
    description:
      "운동마찰력은 수직항력 N에 비례하며 물체의 운동 방향과 반대로 " +
      "작용합니다. 물체가 정지한 뒤에는 속도가 반대 방향으로 바뀌지 않도록 " +
      "정지 상태로 처리합니다."
  },

  drag: {
    title: "공기저항과 바람",
    formula:
      "v⃗rel = v⃗ − v⃗wind\n" +
      "F⃗D = −½ρCᴅA|v⃗rel|v⃗rel",
    description:
      "항력은 공기 기준 상대속도의 반대 방향으로 작용하며 상대속력의 " +
      "제곱에 비례합니다. ρ는 유체 밀도, Cᴅ는 항력계수, A는 단면적입니다."
  },

  collision: {
    title: "1차원 완전 탄성 충돌",
    formula:
      "m₁v₁ + m₂v₂ = m₁v₁′ + m₂v₂′\n" +
      "½m₁v₁² + ½m₂v₂² = ½m₁v₁′² + ½m₂v₂′²",
    description:
      "완전 탄성 충돌에서는 계의 총운동량과 총운동에너지가 모두 " +
      "보존됩니다. 이 시뮬레이션에서 두 번째 물체의 질량은 2 kg입니다."
  },

  incline: {
    title: "빗면에서의 운동",
    formula:
      "F∥ = mg sinβ\n" +
      "N = mg cosβ\n" +
      "fₖ = μₖmg cosβ",
    description:
      "중력을 빗면과 나란한 성분과 빗면에 수직인 성분으로 분해합니다. " +
      "마찰력은 빗면 위 운동 방향의 반대로 작용합니다."
  },

  circular: {
    title: "등속 원운동",
    formula:
      "v = rω\n" +
      "a꜀ = v²/r = rω²\n" +
      "F꜀ = mrω²",
    description:
      "등속 원운동에서는 속력은 일정하지만 속도의 방향이 계속 변합니다. " +
      "따라서 원의 중심을 향하는 구심가속도와 구심력이 존재합니다."
  },

  torque: {
    title: "돌림힘과 회전 운동",
    formula:
      "τ = Iα\n" +
      "ω = ω₀ + αt\n" +
      "θ = θ₀ + ω₀t + ½αt²",
    description:
      "돌림힘 τ는 각가속도 α를 만들며, 관성 모멘트 I가 클수록 같은 " +
      "돌림힘에서 각가속도가 작습니다. 여기서는 고정된 중심축 주위로 막대가 회전합니다."
  },

  escape: {
    title: "탈출 속도",
    formula:
      "vₑ = √(2GM/R)\n" +
      "a⃗ = −GM r⃗/r³",
    description:
      "탈출 속도는 물체가 추가 추진 없이 중심천체의 중력을 벗어나 " +
      "무한히 멀어질 수 있는 최소 초기속도입니다. 이 모드는 일정한 g가 " +
      "아니라 거리의 제곱에 반비례하는 중심중력을 사용합니다."
  }
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HTML 요소
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const elements = {
  container: document.querySelector("#canvasContainer"),

  mode: document.querySelector("#mode"),
  environment: document.querySelector("#environment"),

  speed: document.querySelector("#speed"),
  mass: document.querySelector("#mass"),
  angle: document.querySelector("#angle"),

  accelerationX: document.querySelector("#accelerationX"),
  accelerationY: document.querySelector("#accelerationY"),

  useCustomG: document.querySelector("#useCustomG"),
  customG: document.querySelector("#customG"),
  useCustomMu: document.querySelector("#useCustomMu"),
  customMu: document.querySelector("#customMu"),
  useCustomCd: document.querySelector("#useCustomCd"),
  customCd: document.querySelector("#customCd"),
  useCustomWind: document.querySelector("#useCustomWind"),
  customWind: document.querySelector("#customWind"),

  freefallHeight: document.querySelector("#freefallHeight"),
  inclineAngle: document.querySelector("#inclineAngle"),
  circularRadius: document.querySelector("#circularRadius"),
  angularVelocity: document.querySelector("#angularVelocity"),
  torque: document.querySelector("#torque"),
  momentOfInertia: document.querySelector("#momentOfInertia"),
  planetMass: document.querySelector("#planetMass"),
  planetRadius: document.querySelector("#planetRadius"),

  stageWidth: document.querySelector("#stageWidth"),
  timeScale: document.querySelector("#timeScale"),

  start: document.querySelector("#startButton"),
  playPause: document.querySelector("#playPauseButton"),
  stop: document.querySelector("#stopButton"),
  reset: document.querySelector("#resetButton"),

  timeline: document.querySelector("#timeline"),
  timelineValue: document.querySelector("#timelineValue"),

  message: document.querySelector("#message"),
  formula: document.querySelector("#formula"),
  info: document.querySelector("#physicsInfo"),

  modeModal: document.querySelector("#modeModal"),
  openModeModal: document.querySelector("#openModeModalButton"),
  currentModeBadge: document.querySelector("#currentModeBadge"),

  zoomIn: document.querySelector("#zoomInButton"),
  zoomOut: document.querySelector("#zoomOutButton"),
  resetCamera: document.querySelector("#resetCameraButton"),

  formulaHelpButton: document.querySelector("#formulaHelpButton"),
  formulaHelpModal: document.querySelector("#formulaHelpModal"),
  formulaHelpTitle: document.querySelector("#formulaHelpTitle"),
  formulaHelpContent: document.querySelector("#formulaHelpContent"),
  closeFormulaHelp: document.querySelector("#closeFormulaHelpButton"),

  quantitySettings: document.querySelector("#quantitySettingsButton"),
  quantityModal: document.querySelector("#quantityModal"),
  closeQuantity: document.querySelector("#closeQuantityButton"),
  saveQuantity: document.querySelector("#saveQuantityButton")
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Three.js 장면
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
camera.position.set(0, 14, 52);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

elements.container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

controls.enableDamping = true;
controls.dampingFactor = 0.07;

controls.enableZoom = true;
controls.zoomSpeed = 0.9;

controls.enablePan = true;
controls.panSpeed = 0.7;

controls.enableRotate = true;
controls.rotateSpeed = 0.55;

controls.minDistance = 7;
controls.maxDistance = 600;

controls.target.set(0, 2, 0);
controls.update();

scene.add(new THREE.HemisphereLight(0xffffff, 0x152238, 1.7));

const mainLight = new THREE.DirectionalLight(0xffffff, 2.2);
mainLight.position.set(12, 25, 18);
scene.add(mainLight);

const floor = new THREE.Mesh(
  new THREE.BoxGeometry(1, 0.3, 10),
  new THREE.MeshStandardMaterial({
    color: 0x606974,
    roughness: 0.9
  })
);

floor.position.y = -5;
scene.add(floor);

const grid = new THREE.GridHelper(80, 40, 0x34506f, 0x182b42);
grid.position.y = -4.84;
scene.add(grid);

const ballRadius = 1.2;
const dragRadius = 0.35;
const dragArea = Math.PI * dragRadius ** 2;

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(ballRadius, 36, 24),
  new THREE.MeshStandardMaterial({
    color: 0xffda25,
    roughness: 0.42
  })
);

scene.add(ball);

const target = new THREE.Mesh(
  new THREE.SphereGeometry(ballRadius, 36, 24),
  new THREE.MeshStandardMaterial({
    color: 0x29d66f,
    roughness: 0.42
  })
);

scene.add(target);

const incline = new THREE.Mesh(
  new THREE.BoxGeometry(34, 0.65, 8),
  new THREE.MeshStandardMaterial({
    color: 0x587390,
    roughness: 0.9
  })
);

incline.visible = false;
scene.add(incline);

const rotatingRod = new THREE.Mesh(
  new THREE.BoxGeometry(15, 0.65, 0.9),
  new THREE.MeshStandardMaterial({
    color: 0xff9848,
    roughness: 0.45
  })
);

rotatingRod.visible = false;
scene.add(rotatingRod);

const rotationPivot = new THREE.Mesh(
  new THREE.CylinderGeometry(0.75, 0.75, 1.2, 32),
  new THREE.MeshStandardMaterial({
    color: 0x65d5ff
  })
);

rotationPivot.rotation.x = Math.PI / 2;
rotationPivot.visible = false;
scene.add(rotationPivot);

const planet = new THREE.Mesh(
  new THREE.SphereGeometry(8, 52, 36),
  new THREE.MeshStandardMaterial({
    color: 0x247bd2,
    roughness: 0.72
  })
);

planet.visible = false;
scene.add(planet);

const orbitLineMaterial = new THREE.LineBasicMaterial({
  color: 0x496a8d,
  transparent: true,
  opacity: 0.65
});

const orbitPoints = [];

for (let i = 0; i <= 128; i += 1) {
  const theta = (i / 128) * Math.PI * 2;

  orbitPoints.push(
    new THREE.Vector3(
      10 * Math.cos(theta),
      5 + 10 * Math.sin(theta),
      0
    )
  );
}

const orbitLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints(orbitPoints),
  orbitLineMaterial
);

orbitLine.visible = false;
scene.add(orbitLine);

/* 별 배경 */

const starGeometry = new THREE.BufferGeometry();
const starPositions = [];

for (let i = 0; i < 700; i += 1) {
  starPositions.push(
    (Math.random() - 0.5) * 500,
    (Math.random() - 0.5) * 300,
    (Math.random() - 0.5) * 400
  );
}

starGeometry.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(starPositions, 3)
);

const stars = new THREE.Points(
  starGeometry,
  new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.45,
    sizeAttenuation: true
  })
);

stars.visible = false;
scene.add(stars);

/* 궤적 */

const trailMaterial = new THREE.LineBasicMaterial({
  color: 0xff9f25
});

let trailPoints = [];
let trail = new THREE.Line(
  new THREE.BufferGeometry(),
  trailMaterial
);

scene.add(trail);

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   상태 변수
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

let running = false;
let elapsed = 0;
let lastTime = performance.now();

let velocity = new THREE.Vector3();
let targetVelocity = new THREE.Vector3();

let lastForce = new THREE.Vector3();
let lastAcceleration = new THREE.Vector3();

let collisionDone = false;

let angularPosition = 0;
let angularVelocityState = 0;
let angularAccelerationState = 0;

let circularCenter = new THREE.Vector3(0, 5, 0);

let escapePosition = new THREE.Vector3();
let escapeVelocity = new THREE.Vector3();
let escapeVisualScale = 1;

let history = [];
let historyIndex = 0;

let selectedQuantities = new Set([
  "time",
  "position",
  "velocity",
  "speed",
  "energy"
]);

const floorTop = floor.position.y + 0.15;

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   설정과 UI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function numberValue(element, fallback = 0) {
  const value = Number(element.value);
  return Number.isFinite(value) ? value : fallback;
}

function getSettings() {
  const preset = ENVIRONMENTS[elements.environment.value];

  return {
    mode: elements.mode.value,
    environmentKey: elements.environment.value,
    environment: preset,

    speed: numberValue(elements.speed, 15),
    mass: numberValue(elements.mass, 1),
    angle: numberValue(elements.angle, 0),

    extraAcceleration: new THREE.Vector3(
      numberValue(elements.accelerationX, 0),
      numberValue(elements.accelerationY, 0),
      0
    ),

    g: elements.useCustomG.checked
      ? numberValue(elements.customG, preset.g)
      : preset.g,

    mu: elements.useCustomMu.checked
      ? Math.max(numberValue(elements.customMu, preset.mu), 0)
      : preset.mu,

    cd: elements.useCustomCd.checked
      ? Math.max(numberValue(elements.customCd, preset.cd), 0)
      : preset.cd,

    wind: elements.useCustomWind.checked
      ? numberValue(elements.customWind, preset.wind)
      : preset.wind,

    rho: preset.rho,

    freefallHeight: Math.max(
      numberValue(elements.freefallHeight, 25),
      1
    ),

    inclineAngle: THREE.MathUtils.clamp(
      numberValue(elements.inclineAngle, 30),
      -80,
      80
    ),

    circularRadius: Math.max(
      numberValue(elements.circularRadius, 10),
      0.1
    ),

    inputAngularVelocity:
      numberValue(elements.angularVelocity, 1),

    torque:
      numberValue(elements.torque, 10),

    momentOfInertia: Math.max(
      numberValue(elements.momentOfInertia, 5),
      0.01
    ),

    planetMass: Math.max(
      numberValue(elements.planetMass, 5.972e24),
      1
    ),

    planetRadius: Math.max(
      numberValue(elements.planetRadius, 6.371e6),
      1
    ),

    stageWidth: Math.max(
      numberValue(elements.stageWidth, 80),
      10
    ),

    timeScale: Math.max(
      numberValue(elements.timeScale, 1),
      0.01
    )
  };
}

function setMessage(text) {
  elements.message.textContent = text;
}

function updateEnvironment(settings) {
  scene.background = new THREE.Color(
    settings.environment.background
  );

  floor.material.color.setHex(settings.environment.floor);

  stars.visible =
    settings.environmentKey === "space" ||
    settings.environmentKey === "moon" ||
    settings.mode === "escape";
}

function updateFormula(settings) {
  const escapeSpeed = Math.sqrt(
    2 * G * settings.planetMass / settings.planetRadius
  );

  const formulas = {
    gravity:
`[포물선 운동]
x = x₀ + v₀cosθ·t
y = y₀ + v₀sinθ·t − ½gt²
F⃗g = m g⃗`,

    freefall:
`[자유 낙하]
vᵧ = v₀ᵧ − gt
y = y₀ + v₀ᵧt − ½gt²
F⃗g = m g⃗`,

    friction:
`[수평면 마찰]
fₖ = μₖN
N = mg
aₓ = −μₖg·sgn(vₓ)`,

    drag:
`[공기저항과 바람]
v⃗rel = v⃗ − v⃗wind
F⃗D = −½ρCᴅA|v⃗rel|v⃗rel
ρ = ${settings.rho} kg·m⁻³`,

    collision:
`[완전 탄성 충돌]
Σp⃗before = Σp⃗after
ΣKbefore = ΣKafter
m₂ = 2.00 kg`,

    incline:
`[빗면 운동]
F∥ = mg sinβ
N = mg cosβ
fₖ = μₖN
β = ${settings.inclineAngle.toFixed(1)}°`,

    circular:
`[등속 원운동]
v = rω
a꜀ = rω² = v²/r
F꜀ = mrω²`,

    torque:
`[돌림힘]
τ = Iα
ω = ω₀ + αt
θ = θ₀ + ω₀t + ½αt²`,

    escape:
`[탈출 속도]
vₑ = √(2GM/R)
a⃗ = −GM r⃗/r³
vₑ = ${(escapeSpeed / 1000).toFixed(2)} km·s⁻¹`
  };

  elements.formula.textContent = formulas[settings.mode];
}

function physicsRow(symbol, value) {
  return `
    <div class="physics-row">
      <span class="physics-symbol">${symbol}</span>
      <span class="physics-value">${value}</span>
    </div>
  `;
}

function updateInfo(settings, force = lastForce, acceleration = lastAcceleration) {
  const speed = velocity.length();
  const momentum = velocity.clone().multiplyScalar(settings.mass);

  let height = Math.max(
    ball.position.y - (floorTop + ballRadius),
    0
  );

  let kineticEnergy = 0.5 * settings.mass * speed ** 2;
  let potentialEnergy = settings.mass * settings.g * height;

  if (settings.mode === "escape") {
    const radius = Math.max(escapePosition.length(), 1);

    kineticEnergy =
      0.5 * settings.mass * escapeVelocity.lengthSq();

    potentialEnergy =
      -G * settings.planetMass * settings.mass / radius;
  }

  if (settings.mode === "torque") {
    kineticEnergy =
      0.5 *
      settings.momentOfInertia *
      angularVelocityState ** 2;

    potentialEnergy = 0;
  }

  const mechanicalEnergy = kineticEnergy + potentialEnergy;

  let html = "";

  if (selectedQuantities.has("time")) {
    html += physicsRow("<i>t</i>", `${elapsed.toFixed(2)} s`);
  }

  if (selectedQuantities.has("position")) {
    if (settings.mode === "escape") {
      html += physicsRow(
        "<b>r⃗</b>",
        `(${formatScientific(escapePosition.x)}, ` +
        `${formatScientific(escapePosition.y)}) m`
      );
    } else if (settings.mode === "torque") {
      html += physicsRow("θ", `${angularPosition.toFixed(3)} rad`);
    } else {
      html += physicsRow(
        "<b>r⃗</b>",
        `(${ball.position.x.toFixed(2)}, ` +
        `${ball.position.y.toFixed(2)}) m`
      );
    }
  }

  if (selectedQuantities.has("velocity")) {
    html += physicsRow(
      "<b>v⃗</b>",
      `(${velocity.x.toFixed(2)}, ${velocity.y.toFixed(2)}) m·s⁻¹`
    );
  }

  if (selectedQuantities.has("speed")) {
    html += physicsRow(
      "|<b>v⃗</b>|",
      `${speed.toFixed(2)} m·s⁻¹`
    );
  }

  if (selectedQuantities.has("acceleration")) {
    html += physicsRow(
      "<b>a⃗</b>",
      `(${acceleration.x.toFixed(2)}, ` +
      `${acceleration.y.toFixed(2)}) m·s⁻²`
    );
  }

  if (selectedQuantities.has("force")) {
    html += physicsRow(
      "<b>F⃗</b><sub>net</sub>",
      `(${force.x.toFixed(2)}, ${force.y.toFixed(2)}) N`
    );
  }

  if (selectedQuantities.has("momentum")) {
    html += physicsRow(
      "<b>p⃗</b>",
      `(${momentum.x.toFixed(2)}, ` +
      `${momentum.y.toFixed(2)}) kg·m·s⁻¹`
    );
  }

  if (selectedQuantities.has("energy")) {
    html += physicsRow(
      "<i>K</i>",
      `${formatEnergy(kineticEnergy)} J`
    );

    html += physicsRow(
      "<i>U</i>",
      `${formatEnergy(potentialEnergy)} J`
    );

    html += physicsRow(
      "<i>E</i><sub>mech</sub>",
      `${formatEnergy(mechanicalEnergy)} J`
    );
  }

  if (selectedQuantities.has("angular")) {
    html += physicsRow(
      "θ",
      `${angularPosition.toFixed(3)} rad`
    );

    html += physicsRow(
      "ω",
      `${angularVelocityState.toFixed(3)} rad·s⁻¹`
    );

    html += physicsRow(
      "α",
      `${angularAccelerationState.toFixed(3)} rad·s⁻²`
    );
  }

  elements.info.innerHTML =
    html || `<span class="physics-symbol">표시할 물리량을 선택하세요.</span>`;
}

function formatScientific(value) {
  if (!Number.isFinite(value)) {
    return "−";
  }

  if (Math.abs(value) >= 100000 || (Math.abs(value) > 0 && Math.abs(value) < 0.001)) {
    return value.toExponential(3);
  }

  return value.toFixed(2);
}

function formatEnergy(value) {
  if (!Number.isFinite(value)) {
    return "−";
  }

  if (Math.abs(value) >= 100000) {
    return value.toExponential(3);
  }

  return value.toFixed(2);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   카메라
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function fitCameraToStage() {
  const settings = getSettings();

  if (settings.mode === "escape") {
    camera.position.set(0, 23, 50);
    controls.target.set(0, 0, 0);
  } else if (settings.mode === "circular") {
    const radius = settings.circularRadius;
    const distance = Math.max(34, radius * 3.2);

    camera.position.set(0, 8, distance);
    controls.target.copy(circularCenter);
  } else if (settings.mode === "torque") {
    camera.position.set(0, 3, 32);
    controls.target.set(0, 2, 0);
  } else {
    const scale = settings.stageWidth / 80;
    const distance = Math.max(30, 52 * scale);

    camera.position.set(
      0,
      Math.max(13, 15 * scale),
      distance
    );

    controls.target.set(0, 2, 0);
  }

  camera.near = 0.1;
  camera.far = 5000;
  camera.updateProjectionMatrix();

  controls.update();
}

function zoomCamera(factor) {
  const offset = camera.position.clone().sub(controls.target);

  const nextDistance = THREE.MathUtils.clamp(
    offset.length() * factor,
    controls.minDistance,
    controls.maxDistance
  );

  offset.setLength(nextDistance);

  camera.position.copy(controls.target).add(offset);
  controls.update();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   객체와 시뮬레이션 초기화
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function clearTrail() {
  trailPoints = [ball.position.clone()];

  trail.geometry.dispose();
  trail.geometry = new THREE.BufferGeometry().setFromPoints(trailPoints);
}

function addTrailPoint() {
  if (trailPoints.length > 2500) {
    trailPoints.shift();
  }

  trailPoints.push(ball.position.clone());

  trail.geometry.dispose();
  trail.geometry = new THREE.BufferGeometry().setFromPoints(trailPoints);
}

function updateOrbitLine(radius) {
  const points = [];

  for (let i = 0; i <= 128; i += 1) {
    const theta = (i / 128) * Math.PI * 2;

    points.push(
      new THREE.Vector3(
        circularCenter.x + radius * Math.cos(theta),
        circularCenter.y + radius * Math.sin(theta),
        0
      )
    );
  }

  orbitLine.geometry.dispose();
  orbitLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
}

function resetObjectVisibility() {
  ball.visible = true;
  target.visible = false;
  incline.visible = false;
  rotatingRod.visible = false;
  rotationPivot.visible = false;
  planet.visible = false;
  orbitLine.visible = false;

  floor.visible = true;
  grid.visible = true;
  trail.visible = true;
}

function resetObjects({ resetHistory = true } = {}) {
  const settings = getSettings();

  running = false;
  elapsed = 0;

  velocity.set(0, 0, 0);
  targetVelocity.set(0, 0, 0);

  lastForce.set(0, 0, 0);
  lastAcceleration.set(0, 0, 0);

  collisionDone = false;

  angularPosition = 0;
  angularVelocityState = settings.inputAngularVelocity;
  angularAccelerationState = 0;

  resetObjectVisibility();

  floor.scale.set(settings.stageWidth, 1, 1);
  grid.scale.x = settings.stageWidth / 80;

  const startX = -settings.stageWidth * (25 / 80);
  const targetX = settings.stageWidth * (10 / 80);

  ball.position.set(
    startX,
    floorTop + ballRadius,
    0
  );

  target.position.set(
    targetX,
    floorTop + ballRadius,
    0
  );

  target.material.color.setHex(0x29d66f);

  const angleRadians = THREE.MathUtils.degToRad(settings.angle);

  velocity.set(
    settings.speed * Math.cos
  const angleRadians = THREE.MathUtils.degToRad(settings.angle);

  velocity.set(
    settings.speed * Math.cos(angleRadians),
    settings.speed * Math.sin(angleRadians),
    0
  );

  if (settings.mode === "freefall") {
    ball.position.set(
      0,
      floorTop + ballRadius + settings.freefallHeight,
      0
    );

    velocity.set(
      0,
      -Math.abs(settings.speed),
      0
    );
  }

  if (settings.mode === "friction") {
    velocity.y = 0;
  }

  if (settings.mode === "collision") {
    ball.position.set(
      settings.collisionPosition1 ?? -20,
      floorTop + ballRadius,
      0
    );

    target.position.set(
      settings.collisionPosition2 ?? 10,
      floorTop + ballRadius,
      0
    );

    velocity.set(
      settings.collisionVelocity1 ?? settings.speed,
      0,
      0
    );

    targetVelocity.set(
      settings.collisionVelocity2 ?? 0,
      0,
      0
    );

    target.visible = true;
  }

  updateEnvironment(settings);
  updateFormula(settings);
  fitCameraToStage();
  clearTrail();

  if (resetHistory) {
    history = [];
    historyIndex = 0;
    saveState();
  }

  updateInfo(
    settings,
    lastForce,
    lastAcceleration
  );

  updateTimeline();

  elements.playPause.textContent = "▶ 재생";
}
