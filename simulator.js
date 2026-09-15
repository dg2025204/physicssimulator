import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const G = 6.67430e-11;
const FIXED_DT = 0.01;
const MAX_HISTORY = 12000;

const ENVIRONMENTS = {
  earth: {
    name: "Earth · 지구",
    g: 9.8,
    mu: 0.30,
    cd: 0.47,
    rho: 1.225,
    wind: 0,
    background: 0x08172d,
    floor: 0x626b76
  },

  moon: {
    name: "Moon · 달",
    g: 1.62,
    mu: 0.20,
    cd: 0,
    rho: 0,
    wind: 0,
    background: 0x010307,
    floor: 0x9299a1
  },

  mars: {
    name: "Mars · 화성",
    g: 3.72,
    mu: 0.40,
    cd: 0.47,
    rho: 0.020,
    wind: -3,
    background: 0x270b05,
    floor: 0xb75525
  },

  space: {
    name: "Space · 우주",
    g: 0,
    mu: 0,
    cd: 0,
    rho: 0,
    wind: 0,
    background: 0x000000,
    floor: 0x141820
  },

  vacuum: {
    name: "Vacuum · 지구 중력 진공",
    g: 9.8,
    mu: 0,
    cd: 0,
    rho: 0,
    wind: 0,
    background: 0x06101f,
    floor: 0x48515c
  }
};

const MODE_NAMES = {
  projectile: "포물선 운동",
  freefall: "자유 낙하",
  friction: "마찰 운동",
  drag: "공기저항과 바람",
  collision: "충돌",
  incline: "빗면 운동",
  circular: "원운동",
  torque: "돌림힘",
  escape: "탈출 속도"
};

const MODE_DEFAULTS = {
  projectile: { speed: 15, angle: 60 },
  freefall: { speed: 0, angle: 270 },
  friction: { speed: 15, angle: 0 },
  drag: { speed: 20, angle: 35 },
  collision: { speed: 15, angle: 0 },
  incline: { speed: 0, angle: 0 },
  circular: { speed: 10, angle: 0 },
  torque: { speed: 0, angle: 0 },
  escape: { speed: 11200, angle: 0 }
};

const FORMULAS = {
  projectile: {
    title: "포물선 운동",
    short:
`x = x₀ + v₀cosθ·t
y = y₀ + v₀sinθ·t − ½gt²
F⃗g = m g⃗`,
    description:
      "공기저항이 없으면 수평 가속도는 0이고 수직 방향에는 −g가 작용합니다. " +
      "따라서 수평속도는 일정하고 수직속도는 시간에 따라 변합니다."
  },

  freefall: {
    title: "자유 낙하",
    short:
`vᵧ = v₀ᵧ − gt
y = y₀ + v₀ᵧt − ½gt²
F⃗g = m g⃗`,
    description:
      "물체가 중력만 받으며 수직으로 낙하하는 운동입니다. 공기저항을 무시하면 " +
      "물체의 질량과 관계없이 중력가속도는 같습니다."
  },

  friction: {
    title: "수평면 마찰 운동",
    short:
`fₖ = μₖN
N = mg
aₓ = −μₖg·sgn(vₓ)`,
    description:
      "운동마찰력은 수직항력 N에 비례하며 물체의 운동 방향과 반대로 작용합니다."
  },

  drag: {
    title: "공기저항과 바람",
    short:
`v⃗rel = v⃗ − v⃗wind
F⃗D = −½ρCᴅA|v⃗rel|v⃗rel`,
    description:
      "항력은 공기 기준 상대속도의 반대 방향으로 작용하며 상대속력의 제곱에 " +
      "비례합니다. ρ는 밀도, Cᴅ는 항력계수, A는 단면적입니다."
  },

  collision: {
    title: "충돌",
    short:
`m₁u₁ + m₂u₂ = m₁v₁ + m₂v₂
v₂ − v₁ = e(u₁ − u₂)
0 ≤ e ≤ 1`,
    description:
      "운동량 보존과 반발계수 e를 사용합니다. e = 1이면 완전 탄성 충돌이고, " +
      "e = 0이면 충돌 직후 두 물체의 속도가 같아지는 완전 비탄성 충돌입니다."
  },

  incline: {
    title: "빗면 운동",
    short:
`F∥ = mg sinβ
N = mg cosβ
fₖ = μₖN`,
    description:
      "중력을 빗면과 나란한 성분 mg sinβ와 수직 성분 mg cosβ로 분해합니다. " +
      "운동마찰력은 빗면 위 운동 방향과 반대로 작용합니다."
  },

  circular: {
    title: "등속 원운동",
    short:
`v = rω
a꜀ = rω² = v²/r
F꜀ = mrω²`,
    description:
      "속력은 일정하지만 속도 방향이 계속 변하므로 원의 중심을 향하는 " +
      "구심가속도와 구심력이 존재합니다."
  },

  torque: {
    title: "돌림힘",
    short:
`τ = Iα
ω = ω₀ + αt
θ = θ₀ + ω₀t + ½αt²`,
    description:
      "돌림힘 τ는 각가속도 α를 만듭니다. 관성 모멘트 I가 클수록 같은 " +
      "돌림힘에 대한 각가속도는 작습니다."
  },

  escape: {
    title: "탈출 속도",
    short:
`vₑ = √(2GM/R)
a⃗ = −GM r⃗/r³`,
    description:
      "추가 추진 없이 중심천체의 중력장을 벗어날 수 있는 최소 초기속도입니다. " +
      "이 모드는 거리의 제곱에 반비례하는 중심중력을 사용합니다."
  }
};

const el = {
  container: document.querySelector("#canvasContainer"),

  modeModal: document.querySelector("#modeModal"),
  mode: document.querySelector("#mode"),
  environment: document.querySelector("#environment"),
  modeBadge: document.querySelector("#modeBadge"),
  openModeButton: document.querySelector("#openModeButton"),

  mass: document.querySelector("#mass"),
  speed: document.querySelector("#speed"),
  angle: document.querySelector("#angle"),
  extraAx: document.querySelector("#extraAx"),
  extraAy: document.querySelector("#extraAy"),

  collisionSettings: document.querySelector("#collisionSettings"),
  mass1: document.querySelector("#mass1"),
  velocity1: document.querySelector("#velocity1"),
  position1: document.querySelector("#position1"),
  mass2: document.querySelector("#mass2"),
  velocity2: document.querySelector("#velocity2"),
  position2: document.querySelector("#position2"),
  restitution: document.querySelector("#restitution"),

  freefallHeight: document.querySelector("#freefallHeight"),
  inclineAngle: document.querySelector("#inclineAngle"),
  circleRadius: document.querySelector("#circleRadius"),
  angularSpeed: document.querySelector("#angularSpeed"),
  torque: document.querySelector("#torque"),
  inertia: document.querySelector("#inertia"),
  initialOmega: document.querySelector("#initialOmega"),
  planetMass: document.querySelector("#planetMass"),
  planetRadius: document.querySelector("#planetRadius"),
  setEscapeSpeed: document.querySelector("#setEscapeSpeedButton"),
  noModeSettings: document.querySelector("#noModeSettings"),

  useCustomG: document.querySelector("#useCustomG"),
  customG: document.querySelector("#customG"),
  useCustomMu: document.querySelector("#useCustomMu"),
  customMu: document.querySelector("#customMu"),
  useCustomCd: document.querySelector("#useCustomCd"),
  customCd: document.querySelector("#customCd"),
  useCustomWind: document.querySelector("#useCustomWind"),
  customWind: document.querySelector("#customWind"),

  showTrail: document.querySelector("#showTrail"),
  clearTrail: document.querySelector("#clearTrailButton"),
  stageWidth: document.querySelector("#stageWidth"),
  timeScale: document.querySelector("#timeScale"),

  start: document.querySelector("#startButton"),
  playPause: document.querySelector("#playPauseButton"),
  reset: document.querySelector("#resetButton"),
  timeline: document.querySelector("#timeline"),
  timelineOutput: document.querySelector("#timelineOutput"),
  message: document.querySelector("#message"),

  zoomIn: document.querySelector("#zoomInButton"),
  zoomOut: document.querySelector("#zoomOutButton"),
  fitCamera: document.querySelector("#fitCameraButton"),

  formulaText: document.querySelector("#formulaText"),
  formulaHelp: document.querySelector("#formulaHelpButton"),
  formulaModal: document.querySelector("#formulaModal"),
  formulaTitle: document.querySelector("#formulaTitle"),
  formulaDescription: document.querySelector("#formulaDescription"),
  closeFormula: document.querySelector("#closeFormulaButton"),

  physicsInfo: document.querySelector("#physicsInfo"),
  quantityButton: document.querySelector("#quantityButton"),
  quantityModal: document.querySelector("#quantityModal"),
  closeQuantity: document.querySelector("#closeQuantityButton"),
  applyQuantity: document.querySelector("#applyQuantityButton")
};

function num(element, fallback = 0) {
  const value = Number(element.value);
  return Number.isFinite(value) ? value : fallback;
}

function getSettings() {
  const environment = ENVIRONMENTS[el.environment.value];

  return {
    mode: el.mode.value,
    environmentKey: el.environment.value,
    environment,

    mass: Math.max(num(el.mass, 1), 0.01),
    speed: num(el.speed, 15),
    angle: num(el.angle, 0),

    extraAcceleration: new THREE.Vector3(
      num(el.extraAx, 0),
      num(el.extraAy, 0),
      0
    ),

    g: el.useCustomG.checked
      ? num(el.customG, environment.g)
      : environment.g,

    mu: el.useCustomMu.checked
      ? Math.max(num(el.customMu, environment.mu), 0)
      : environment.mu,

    cd: el.useCustomCd.checked
      ? Math.max(num(el.customCd, environment.cd), 0)
      : environment.cd,

    wind: el.useCustomWind.checked
      ? num(el.customWind, environment.wind)
      : environment.wind,

    rho: environment.rho,

    mass1: Math.max(num(el.mass1, 1), 0.01),
    velocity1: num(el.velocity1, 15),
    position1: num(el.position1, -20),

    mass2: Math.max(num(el.mass2, 2), 0.01),
    velocity2: num(el.velocity2, 0),
    position2: num(el.position2, 10),

    restitution: THREE.MathUtils.clamp(
      num(el.restitution, 1),
      0,
      1
    ),

    freefallHeight: Math.max(num(el.freefallHeight, 25), 1),

    inclineAngle: THREE.MathUtils.clamp(
      num(el.inclineAngle, 30),
      1,
      75
    ),

    circleRadius: Math.max(num(el.circleRadius, 10), 1),
    angularSpeed: num(el.angularSpeed, 1),

    torque: num(el.torque, 10),
    inertia: Math.max(num(el.inertia, 5), 0.01),
    initialOmega: num(el.initialOmega, 0),

    planetMass: Math.max(num(el.planetMass, 5.972e24), 1),
    planetRadius: Math.max(num(el.planetRadius, 6.371e6), 1),

    showTrail: el.showTrail.checked,
    stageWidth: Math.max(num(el.stageWidth, 80), 20),
    timeScale: Math.max(num(el.timeScale, 1), 0.01)
  };
}

/* Three.js */

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
camera.position.set(0, 15, 55);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
el.container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.enableZoom = true;
controls.enablePan = true;
controls.enableRotate = true;
controls.minDistance = 7;
controls.maxDistance = 1000;
controls.target.set(0, 2, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x152238, 1.8));

const directionalLight = new THREE.DirectionalLight(0xffffff, 2.2);
directionalLight.position.set(15, 25, 18);
scene.add(directionalLight);

const floor = new THREE.Mesh(
  new THREE.BoxGeometry(1, 0.3, 10),
  new THREE.MeshStandardMaterial({ color: 0x626b76, roughness: 0.9 })
);
floor.position.y = -5;
scene.add(floor);

const floorTop = -4.85;

const grid = new THREE.GridHelper(80, 40, 0x34506f, 0x182b42);
grid.position.y = floorTop + 0.01;
scene.add(grid);

const BALL_RADIUS = 1.2;
const DRAG_RADIUS = 0.35;
const DRAG_AREA = Math.PI * DRAG_RADIUS ** 2;

function makeBall(ballColor) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 36, 24),
    new THREE.MeshStandardMaterial({
      color: ballColor,
      roughness: 0.4
    })
  );
}

const ball1 = makeBall(0xffd83d);
const ball2 = makeBall(0x42dc89);
scene.add(ball1, ball2);

const incline = new THREE.Mesh(
  new THREE.BoxGeometry(34, 0.6, 8),
  new THREE.MeshStandardMaterial({ color: 0x58738f, roughness: 0.9 })
);
incline.visible = false;
scene.add(incline);

const rodGroup = new THREE.Group();

const rod = new THREE.Mesh(
  new THREE.BoxGeometry(15, 0.65, 0.8),
  new THREE.MeshStandardMaterial({ color: 0xff9849 })
);

const pivot = new THREE.Mesh(
  new THREE.CylinderGeometry(0.75, 0.75, 1.4, 32),
  new THREE.MeshStandardMaterial({ color: 0x55d4ff })
);

pivot.rotation.x = Math.PI / 2;
rodGroup.add(rod, pivot);
rodGroup.position.set(0, 2, 0);
rodGroup.visible = false;
scene.add(rodGroup);

const planet = new THREE.Mesh(
  new THREE.SphereGeometry(8, 48, 32),
  new THREE.MeshStandardMaterial({ color: 0x267bd1, roughness: 0.7 })
);
planet.visible = false;
scene.add(planet);

const circleLine = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({
    color: 0x5484b0,
    transparent: true,
    opacity: 0.75
  })
);
circleLine.visible = false;
scene.add(circleLine);

function makeTrail(colorValue) {
  return new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: colorValue })
  );
}

const trail1 = makeTrail(0xff9f25);
const trail2 = makeTrail(0x36dc89);
scene.add(trail1, trail2);

let trailPoints1 = [];
let trailPoints2 = [];

const starGeometry = new THREE.BufferGeometry();
const starPositions = [];

for (let i = 0; i < 700; i += 1) {
  starPositions.push(
    (Math.random() - 0.5) * 600,
    (Math.random() - 0.5) * 400,
    (Math.random() - 0.5) * 500
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
    size: 0.5
  })
);

stars.visible = false;
scene.add(stars);

/* 상태 */

let running = false;
let elapsed = 0;
let previousFrameTime = performance.now();

let velocity1 = new THREE.Vector3();
let velocity2 = new THREE.Vector3();

let lastAcceleration1 = new THREE.Vector3();
let lastAcceleration2 = new THREE.Vector3();
let lastForce1 = new THREE.Vector3();
let lastForce2 = new THREE.Vector3();

let collisionLocked = false;

let angleState = 0;
let omegaState = 0;
let alphaState = 0;

let escapePosition = new THREE.Vector3();
let escapeVelocity = new THREE.Vector3();
let escapeScale = 1;

let history = [];
let historyIndex = 0;
let stepCounter = 0;

let selectedQuantities = new Set([
  "time",
  "position",
  "velocity",
  "acceleration",
  "energy",
  "angular"
]);

function setMessage(text) {
  el.message.textContent = text;
}

function updateModeUI() {
  const mode = el.mode.value;

  el.modeBadge.textContent = MODE_NAMES[mode];

  if (mode === "collision") {
    el.collisionSettings.classList.remove("hidden-section");
  } else {
    el.collisionSettings.classList.add("hidden-section");
  }

  let activeCount = 0;

  document.querySelectorAll("[data-for-mode]").forEach((section) => {
    const active = section.dataset.forMode === mode;
    section.classList.toggle("active", active);

    if (active) {
      activeCount += 1;
    }
  });

  el.noModeSettings.style.display =
    activeCount === 0 ? "block" : "none";
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
  let text = FORMULAS[settings.mode].short;

  if (settings.mode === "escape") {
    const escapeSpeed = Math.sqrt(
      2 * G * settings.planetMass / settings.planetRadius
    );

    text += `\n\nvₑ = ${(escapeSpeed / 1000).toFixed(2)} km·s⁻¹`;
  }

  if (settings.mode === "collision") {
    text += `\n\n현재 e = ${settings.restitution.toFixed(2)}`;
  }

  el.formulaText.textContent = text;
}

function resetVisibility() {
  ball1.visible = true;
  ball2.visible = false;

  floor.visible = true;
  grid.visible = true;
  incline.visible = false;
  rodGroup.visible = false;
  planet.visible = false;
  circleLine.visible = false;

  trail1.visible = true;
  trail2.visible = false;
}

function clearTrails() {
  trailPoints1 = [];
  trailPoints2 = [];

  trail1.geometry.dispose();
  trail2.geometry.dispose();

  trail1.geometry = new THREE.BufferGeometry();
  trail2.geometry = new THREE.BufferGeometry();
}

function updateTrail(settings) {
  trail1.visible = settings.showTrail && ball1.visible;
  trail2.visible =
    settings.showTrail &&
    settings.mode === "collision" &&
    ball2.visible;

  if (!settings.showTrail) {
    return;
  }

  if (ball1.visible) {
    trailPoints1.push(ball1.position.clone());

    if (trailPoints1.length > 2000) {
      trailPoints1.shift();
    }

    trail1.geometry.dispose();
    trail1.geometry = new THREE.BufferGeometry().setFromPoints(
      trailPoints1
    );
  }

  if (settings.mode === "collision" && ball2.visible) {
    trailPoints2.push(ball2.position.clone());

    if (trailPoints2.length > 2000) {
      trailPoints2.shift();
    }

    trail2.geometry.dispose();
    trail2.geometry = new THREE.BufferGeometry().setFromPoints(
      trailPoints2
    );
  }
}

function updateCircleLine(radius) {
  const points = [];

  for (let i = 0; i <= 180; i += 1) {
    const theta = i / 180 * Math.PI * 2;

    points.push(
      new THREE.Vector3(
        radius * Math.cos(theta),
        5 + radius * Math.sin(theta),
        0
      )
    );
  }

  circleLine.geometry.dispose();
  circleLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
}

function fitCameraToScene() {
  const settings = getSettings();

  if (settings.mode === "escape") {
    camera.position.set(0, 22, 52);
    controls.target.set(0, 0, 0);
  } else if (settings.mode === "circular") {
    const distance = Math.max(38, settings.circleRadius * 3.5);
    camera.position.set(0, 8, distance);
    controls.target.set(0, 5, 0);
  } else if (settings.mode === "torque") {
    camera.position.set(0, 4, 34);
    controls.target.set(0, 2, 0);
  } else {
    const scale = settings.stageWidth / 80;
    camera.position.set(
      0,
      Math.max(14, 15 * scale),
      Math.max(36, 55 * scale)
    );
    controls.target.set(0, 2, 0);
  }

  controls.update();
}

function zoomCamera(factor) {
  const offset = camera.position.clone().sub(controls.target);

  offset.setLength(
    THREE.MathUtils.clamp(
      offset.length() * factor,
      controls.minDistance,
      controls.maxDistance
    )
  );

  camera.position.copy(controls.target).add(offset);
  controls.update();
}

function resetSimulation({ resetCamera = true } = {}) {
  const settings = getSettings();

  running = false;
  elapsed = 0;
  stepCounter = 0;

  velocity1.set(0, 0, 0);
  velocity2.set(0, 0, 0);

  lastAcceleration1.set(0, 0, 0);
  lastAcceleration2.set(0, 0, 0);
  lastForce1.set(0, 0, 0);
  lastForce2.set(0, 0, 0);

  collisionLocked = false;

  angleState = 0;
  omegaState = settings.initialOmega;
  alphaState = 0;

  resetVisibility();

  floor.scale.set(settings.stageWidth, 1, 1);
  grid.scale.x = settings.stageWidth / 80;

  ball1.position.set(
    -settings.stageWidth * 0.3,
    floorTop + BALL_RADIUS,
    0
  );

  ball2.position.set(
    settings.stageWidth * 0.12,
    floorTop + BALL_RADIUS,
    0
  );

  const launchAngle = THREE.MathUtils.degToRad(settings.angle);

  velocity1.set(
    settings.speed * Math.cos(launchAngle),
    settings.speed * Math.sin(launchAngle),
    0
  );

  if (settings.mode === "freefall") {
    ball1.position.set(
      0,
      floorTop + BALL_RADIUS + settings.freefallHeight,
      0
    );

    velocity1.set(0, -Math.abs(settings.speed), 0);
  }

  if (settings.mode === "friction") {
    velocity1.y = 0;
  }

  if (settings.mode === "collision") {
    ball1.position.set(
      settings.position1,
      floorTop + BALL_RADIUS,
      0
    );

    ball2.position.set(
      settings.position2,
      floorTop + BALL_RADIUS,
      0
    );

    velocity1.set(settings.velocity1, 0, 0);
    velocity2.set(settings.velocity2, 0, 0);

    ball2.visible = true;
  }

  if (settings.mode === "incline") {
    const beta = THREE.MathUtils.degToRad(settings.inclineAngle);

    floor.visible = false;
    grid.visible = false;
    incline.visible = true;

    incline.rotation.z = beta;
    incline.position.set(0, 1, 0);

    const uphill = new THREE.Vector3(
      Math.cos(beta),
      Math.sin(beta),
      0
    );

    ball1.position
      .copy(incline.position)
      .addScaledVector(uphill, 12)
      .add(new THREE.Vector3(
        -Math.sin(beta) * BALL_RADIUS,
        Math.cos(beta) * BALL_RADIUS,
        0
      ));

    velocity1.set(0, 0, 0);
  }

  if (settings.mode === "circular") {
    floor.visible = false;
    grid.visible = false;
    circleLine.visible = true;

    updateCircleLine(settings.circleRadius);

    angleState = 0;
    omegaState = settings.angularSpeed;

    ball1.position.set(settings.circleRadius, 5, 0);
    velocity1.set(0, settings.circleRadius * omegaState, 0);
  }

  if (settings.mode === "torque") {
    ball1.visible = false;
    floor.visible = false;
    grid.visible = false;
    rodGroup.visible = true;

    angleState = 0;
    omegaState = settings.initialOmega;
    rodGroup.rotation.z = 0;
  }

  if (settings.mode === "escape") {
    floor.visible = false;
    grid.visible = false;
    planet.visible = true;

    const launchDirection = new THREE.Vector3(
      Math.cos(launchAngle),
      Math.sin(launchAngle),
      0
    ).normalize();

    const surfaceDirection = new THREE.Vector3(1, 0, 0);

    escapePosition
      .copy(surfaceDirection)
      .multiplyScalar(settings.planetRadius);

    escapeVelocity
      .copy(launchDirection)
      .multiplyScalar(settings.speed);

    escapeScale = 8 / settings.planetRadius;

    ball1.position.copy(
      escapePosition.clone().multiplyScalar(escapeScale)
    );
  }

  clearTrails();

  history = [];
  historyIndex = 0;

  updateEnvironment(settings);
  updateFormula(settings);
  updatePhysicsInfo(settings);
  saveHistory();

  el.playPause.textContent = "▶ 재생";

  if (resetCamera) {
    fitCameraToScene();
  }
}

function calculateStandardForce(settings) {
  const force = settings.extraAcceleration
    .clone()
    .multiplyScalar(settings.mass);

  if (
    settings.mode === "projectile" ||
    settings.mode === "freefall" ||
    settings.mode === "drag"
  ) {
    force.y -= settings.mass * settings.g;
  }

  if (settings.mode === "friction") {
    if (Math.abs(velocity1.x) > 0.001) {
      const friction =
        settings.mu * settings.mass * settings.g;

      force.x -= Math.sign(velocity1.x) * friction;
    }
  }

  if (
    settings.mode === "drag" &&
    settings.rho > 0 &&
    settings.cd > 0
  ) {
    const windVelocity = new THREE.Vector3(
      settings.wind,
      0,
      0
    );

    const relativeVelocity = velocity1
      .clone()
      .sub(windVelocity);

    const relativeSpeed = relativeVelocity.length();

    if (relativeSpeed > 0) {
      const dragMagnitude =
        0.5 *
        settings.rho *
        settings.cd *
        DRAG_AREA *
        relativeSpeed ** 2;

      force.add(
        relativeVelocity
          .normalize()
          .multiplyScalar(-dragMagnitude)
      );
    }
  }

  return force;
}

function resolveGround(settings) {
  const groundY = floorTop + BALL_RADIUS;

  if (ball1.position.y >= groundY) {
    return;
  }

  ball1.position.y = groundY;

  if (settings.mode === "projectile") {
    velocity1.y *= -0.55;

    if (Math.abs(velocity1.y) < 0.08) {
      velocity1.y = 0;
    }
  } else if (
    settings.mode === "freefall" ||
    settings.mode === "drag"
  ) {
    velocity1.y = 0;
    pauseSimulation("물체가 바닥에 도달하여 일시정지했습니다.");
  } else {
    velocity1.y = 0;
  }
}

function updateStandard(settings, dt) {
  const force = calculateStandardForce(settings);
  const acceleration = force.clone().divideScalar(settings.mass);

  lastForce1.copy(force);
  lastAcceleration1.copy(acceleration);

  const oldVx = velocity1.x;

  velocity1.addScaledVector(acceleration, dt);

  if (
    settings.mode === "friction" &&
    oldVx !== 0 &&
    Math.sign(oldVx) !== Math.sign(velocity1.x)
  ) {
    velocity1.x = 0;
  }

  ball1.position.addScaledVector(velocity1, dt);

  resolveGround(settings);

  if (
    settings.mode === "friction" &&
    Math.abs(velocity1.x) < 0.001
  ) {
    velocity1.x = 0;
    pauseSimulation("마찰력으로 물체가 정지했습니다.");
  }
}

function resolveCollision(settings) {
  const deltaX = ball2.position.x - ball1.position.x;
  const minimumDistance = BALL_RADIUS * 2;

  if (Math.abs(deltaX) > minimumDistance) {
    if (Math.abs(deltaX) > minimumDistance * 1.25) {
      collisionLocked = false;
    }

    return;
  }

  if (collisionLocked) {
    return;
  }

  const relativeVelocity = velocity1.x - velocity2.x;

  if (relativeVelocity * deltaX <= 0) {
    return;
  }

  const m1 = settings.mass1;
  const m2 = settings.mass2;
  const e = settings.restitution;

  const u1 = velocity1.x;
  const u2 = velocity2.x;

  const v1 =
    (m1 * u1 + m2 * u2 - m2 * e * (u1 - u2)) /
    (m1 + m2);

  const v2 =
    (m1 * u1 + m2 * u2 + m1 * e * (u1 - u2)) /
    (m1 + m2);

  velocity1.x = v1;
  velocity2.x = v2;

  const direction = deltaX >= 0 ? 1 : -1;
  const midpoint =
    (ball1.position.x + ball2.position.x) / 2;

  ball1.position.x =
    midpoint - direction * minimumDistance / 2;

  ball2.position.x =
    midpoint + direction * minimumDistance / 2;

  collisionLocked
