import * as THREE from "three";

const ENVIRONMENTS = {
  earth: {
    name: "Earth (지구)",
    g: 9.8,
    mu: 0.3,
    cd: 0.47,
    rho: 1.225,
    wind: 0,
    background: 0x0d1a33,
    floor: 0x666666
  },
  moon: {
    name: "Moon (달)",
    g: 1.62,
    mu: 0.2,
    cd: 0,
    rho: 0,
    wind: 0,
    background: 0x000000,
    floor: 0x999999
  },
  mars: {
    name: "Mars (화성)",
    g: 3.72,
    mu: 0.4,
    cd: 0.47,
    rho: 0.02,
    wind: -3,
    background: 0x260d05,
    floor: 0xcc661a
  },
  space: {
    name: "Space (우주)",
    g: 0,
    mu: 0,
    cd: 0,
    rho: 0,
    wind: 0,
    background: 0x000000,
    floor: 0x1a1a1a
  },
  vacuum: {
    name: "Vacuum (진공)",
    g: 9.8,
    mu: 0,
    cd: 0,
    rho: 0,
    wind: 0,
    background: 0x050d1a,
    floor: 0x4d4d4d
  }
};

const elements = {
  container: document.querySelector("#canvasContainer"),
  mode: document.querySelector("#mode"),
  environment: document.querySelector("#environment"),
  speed: document.querySelector("#speed"),
  mass: document.querySelector("#mass"),
  angle: document.querySelector("#angle"),
  stageWidth: document.querySelector("#stageWidth"),
  timeScale: document.querySelector("#timeScale"),

  useCustomG: document.querySelector("#useCustomG"),
  customG: document.querySelector("#customG"),
  useCustomMu: document.querySelector("#useCustomMu"),
  customMu: document.querySelector("#customMu"),
  useCustomCd: document.querySelector("#useCustomCd"),
  customCd: document.querySelector("#customCd"),
  useCustomWind: document.querySelector("#useCustomWind"),
  customWind: document.querySelector("#customWind"),

  start: document.querySelector("#startButton"),
  stop: document.querySelector("#stopButton"),
  reset: document.querySelector("#resetButton"),
  message: document.querySelector("#message"),
  formula: document.querySelector("#formula"),
  info: document.querySelector("#physicsInfo")
};

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
camera.position.set(0, 14, 52);
camera.lookAt(0, 2, 0);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
elements.container.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 1.2));

const mainLight = new THREE.DirectionalLight(0xffffff, 2);
mainLight.position.set(10, 20, 15);
scene.add(mainLight);

const floor = new THREE.Mesh(
  new THREE.BoxGeometry(1, 0.3, 10),
  new THREE.MeshStandardMaterial({ color: 0x666666 })
);
floor.position.y = -5;
scene.add(floor);

const ballRadius = 1.2;
const dragRadius = 0.35;
const dragArea = Math.PI * dragRadius ** 2;

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(ballRadius, 32, 20),
  new THREE.MeshStandardMaterial({ color: 0xffdd22 })
);
scene.add(ball);

const target = new THREE.Mesh(
  new THREE.SphereGeometry(ballRadius, 32, 20),
  new THREE.MeshStandardMaterial({ color: 0x22cc55 })
);
scene.add(target);

let running = false;
let elapsed = 0;
let stageWidth = 80;
let floorTop = -5 + 0.15;
let velocity = new THREE.Vector3();
let targetVelocity = new THREE.Vector3();
let collisionDone = false;
let lastTime = performance.now();

function numberValue(element, fallback = 0) {
  const value = Number(element.value);
  return Number.isFinite(value) ? value : fallback;
}

function getSettings() {
  const preset = ENVIRONMENTS[elements.environment.value];

  return {
    mode: elements.mode.value,
    environment: preset,
    speed: numberValue(elements.speed, 15),
    mass: numberValue(elements.mass, 1),
    angle: numberValue(elements.angle, 0),
    stageWidth: Math.max(numberValue(elements.stageWidth, 80), 10),
    timeScale: numberValue(elements.timeScale, 1),

    g: elements.useCustomG.checked
      ? numberValue(elements.customG)
      : preset.g,

    mu: elements.useCustomMu.checked
      ? numberValue(elements.customMu)
      : preset.mu,

    cd: elements.useCustomCd.checked
      ? numberValue(elements.customCd)
      : preset.cd,

    wind: elements.useCustomWind.checked
      ? numberValue(elements.customWind)
      : preset.wind,

    rho: preset.rho
  };
}

function resetObjects() {
  const settings = getSettings();

  stageWidth = settings.stageWidth;
  floor.scale.set(stageWidth, 1, 1);
  floor.visible = elements.environment.value !== "space";

  ball.position.set(
    -stageWidth * (25 / 80),
    floorTop + ballRadius,
    0
  );

  target.position.set(
    stageWidth * (10 / 80),
    floorTop + ballRadius,
    0
  );

  target.visible = settings.mode === "collision";
  target.material.color.setHex(0x22cc55);

  const angle = THREE.MathUtils.degToRad(settings.angle);

  velocity.set(
    settings.speed * Math.cos(angle),
    settings.speed * Math.sin(angle),
    0
  );

  if (settings.mode === "friction") {
    velocity.y = 0;
  }

  targetVelocity.set(0, 0, 0);
  collisionDone = false;
  elapsed = 0;

  const cameraDistance = 52 * (stageWidth / 80);
  camera.position.set(0, 14, Math.max(cameraDistance, 28));
  camera.lookAt(0, 2, 0);

  updateEnvironment(settings);
  updateFormula(settings);
  updateInfo(settings, new THREE.Vector3(), new THREE.Vector3());
}

function updateEnvironment(settings) {
  scene.background = new THREE.Color(
    settings.environment.background
  );

  floor.material.color.setHex(settings.environment.floor);
}

function updateFormula(settings) {
  const formulas = {
    gravity:
      `[중력/포물선]
vx = v₀ cos(θ)
vy = v₀ sin(θ)
Fy = -mg
g = ${settings.g} m/s²`,

    friction:
      `[마찰]
Ff = μmg
μ = ${settings.mu}
g = ${settings.g} m/s²`,

    drag:
      `[공기저항]
Fd = 0.5ρCdA|v 상대|²
ρ = ${settings.rho} kg/m³
Cd = ${settings.cd}
wind = ${settings.wind} m/s`,

    collision:
      `[1차원 탄성 충돌]
v₁' = ((m₁-m₂)v₁+2m₂v₂)/(m₁+m₂)
v₂' = (2m₁v₁+(m₂-m₁)v₂)/(m₁+m₂)`
  };

  elements.formula.textContent = formulas[settings.mode];
}

function startSimulation() {
  const settings = getSettings();

  if (settings.mass <= 0) {
    elements.message.textContent = "질량은 0보다 커야 합니다.";
    return;
  }

  resetObjects();
  running = true;
  elements.message.textContent = "시뮬레이션 실행 중";
}

function stopSimulation() {
  running = false;
  elements.message.textContent = "시뮬레이션이 중지되었습니다.";
}

function resetSimulation() {
  running = false;
  resetObjects();
  elements.message.textContent = "초기화되었습니다.";
}

function calculateAcceleration(settings) {
  const force = new THREE.Vector3();

  if (
    settings.mode === "gravity" ||
    settings.mode === "drag" ||
    settings.mode === "collision"
  ) {
    force.y -= settings.mass * settings.g;
  }

  if (settings.mode === "friction") {
    if (Math.abs(velocity.x) > 0.01 && settings.mu > 0) {
      const friction = settings.mu * settings.mass * settings.g;
      force.x -= Math.sign(velocity.x) * friction;
    } else {
      velocity.x = 0;
    }
  }

  if (
    settings.mode === "drag" &&
    settings.rho > 0 &&
    settings.cd > 0
  ) {
    const windVelocity = new THREE.Vector3(settings.wind, 0, 0);
    const relativeVelocity = velocity.clone().sub(windVelocity);
    const relativeSpeed = relativeVelocity.length();

    if (relativeSpeed > 0) {
      const dragMagnitude =
        0.5 *
        settings.rho *
        settings.cd *
        dragArea *
        relativeSpeed ** 2;

      force.add(
        relativeVelocity
          .normalize()
          .multiplyScalar(-dragMagnitude)
      );
    }
  }

  return {
    force,
    acceleration: force.clone().divideScalar(settings.mass)
  };
}

function resolveGround(settings) {
  if (elements.environment.value === "space") {
    return;
  }

  const groundY = floorTop + ballRadius;

  if (ball.position.y < groundY) {
    ball.position.y = groundY;

    if (settings.mode === "gravity") {
      velocity.y *= -0.6;
    } else if (settings.mode === "drag") {
      velocity.y *= -0.45;
    } else {
      velocity.y = 0;
    }
  }
}

function resolveCollision(settings) {
  if (
    settings.mode !== "collision" ||
    collisionDone ||
    !target.visible
  ) {
    return;
  }

  const distance = ball.position.distanceTo(target.position);

  if (distance < ballRadius * 2) {
    const m1 = settings.mass;
    const m2 = 2;
    const v1 = velocity.x;
    const v2 = targetVelocity.x;

    velocity.x =
      ((m1 - m2) * v1 + 2 * m2 * v2) / (m1 + m2);

    targetVelocity.x =
      (2 * m1 * v1 + (m2 - m1) * v2) / (m1 + m2);

    ball.position.x =
      target.position.x - ballRadius * 2 - 0.05;

    target.material.color.setHex(0xff3333);
    collisionDone = true;
  }
}

function updatePhysics(dt) {
  const settings = getSettings();
  const { force, acceleration } = calculateAcceleration(settings);

  velocity.addScaledVector(acceleration, dt);
  ball.position.addScaledVector(velocity, dt);

  if (target.visible) {
    target.position.addScaledVector(targetVelocity, dt);
  }

  resolveGround(settings);
  resolveCollision(settings);

  elapsed += dt;
  updateInfo(settings, force, acceleration);

  const limit = settings.stageWidth / 2 + 5;

  if (
    Math.abs(ball.position.x) > limit ||
    ball.position.y < -35 ||
    ball.position.y > 60
  ) {
    running = false;
    elements.message.textContent =
      "공이 시뮬레이션 범위를 벗어났습니다.";
  }

  if (
    settings.mode === "friction" &&
    Math.abs(velocity.x) < 0.005
  ) {
    running = false;
    velocity.x = 0;
    elements.message.textContent = "마찰로 인해 공이 정지했습니다.";
  }
}

function updateInfo(settings, force, acceleration) {
  const speed = velocity.length();
  const height = Math.max(
    ball.position.y - (floorTop + ballRadius),
    0
  );

  const kineticEnergy =
    0.5 * settings.mass * speed ** 2;

  const potentialEnergy =
    settings.mass * settings.g * height;

  elements.info.textContent =
`환경 = ${settings.environment.name}
시간 = ${elapsed.toFixed(2)} s
x = ${ball.position.x.toFixed(2)} m
y = ${ball.position.y.toFixed(2)} m
vx = ${velocity.x.toFixed(2)} m/s
vy = ${velocity.y.toFixed(2)} m/s
속력 = ${speed.toFixed(2)} m/s
ax = ${acceleration.x.toFixed(2)} m/s²
ay = ${acceleration.y.toFixed(2)} m/s²
Fx = ${force.x.toFixed(2)} N
Fy = ${force.y.toFixed(2)} N
KE = ${kineticEnergy.toFixed(2)} J
PE = ${potentialEnergy.toFixed(2)} J
ME = ${(kineticEnergy + potentialEnergy).toFixed(2)} J`;
}

function resizeRenderer() {
  const width = elements.container.clientWidth;
  const height = elements.container.clientHeight;

  renderer.setSize(width, height, false);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate(now) {
  requestAnimationFrame(animate);

  const realDt = Math.min((now - lastTime) / 1000, 0.03);
  lastTime = now;

  if (running) {
    const settings = getSettings();
    const simulationDt = realDt * settings.timeScale;

    // 큰 프레임 간격에서도 계산이 불안정해지지 않도록 분할
    const maxStep = 0.01;
    let remaining = simulationDt;

    while (remaining > 0 && running) {
      const step = Math.min(remaining, maxStep);
      updatePhysics(step);
      remaining -= step;
    }
  }

  renderer.render(scene, camera);
}

elements.start.addEventListener("click", startSimulation);
elements.stop.addEventListener("click", stopSimulation);
elements.reset.addEventListener("click", resetSimulation);

document.querySelectorAll("[data-angle]").forEach((button) => {
  button.addEventListener("click", () => {
    elements.angle.value = button.dataset.angle;
  });
});

elements.mode.addEventListener("change", resetSimulation);
elements.environment.addEventListener("change", resetSimulation);
elements.stageWidth.addEventListener("change", resetSimulation);

window.addEventListener("resize", resizeRenderer);

resizeRenderer();
resetObjects();
requestAnimationFrame(animate);