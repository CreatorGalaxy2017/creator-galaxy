import * as THREE from 'three';

// =============================================================================
// World & feel constants
// =============================================================================

const PLANET_RADIUS = 80;
const PLANET_AMPLITUDE = 13;
const SURFACE_OFFSET = 0.04;
const SURFACE_MAX_R = PLANET_RADIUS + PLANET_AMPLITUDE + SURFACE_OFFSET;
const PLANET_DETAIL = 6;
const PLANET_TILT = 0.35;

const WORLD_VIEW_DIST = 60;
const TREE_TRUNK_GEOM_RADIUS = 0.018;

const STAR_COLLISION_RADIUS = 0.18;

const CAM_FOV = 65;
const CAM_NEAR = 0.1;
const CAM_FAR = 3000;
const CAM_BACK = 0.7;
const CAM_HEIGHT = 0.45;
const CAM_LOOK_RAISE = 0.28;
const CAM_PITCH_MIN = -1.05;
const CAM_PITCH_MAX = 0.96;

const MOUSE_SENS = 0.0022;

const WALK_SPEED = 0.018;
const TURN_SPEED = 2.4;
const WALK_CYCLE_FREQ = 5.5;
const IDLE_BREATH_FREQ = 0.45;

const STARFIELD_COUNT = 2500;
const STARFIELD_INNER = 900;
const STARFIELD_OUTER = 1500;

// =============================================================================
// Scene, camera, renderer
// =============================================================================

const canvas = document.getElementById('game-canvas');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);
scene.fog = new THREE.Fog(0x05060a, WORLD_VIEW_DIST * 1.5, WORLD_VIEW_DIST * 3.2);

const camera = new THREE.PerspectiveCamera(
  CAM_FOV,
  window.innerWidth / window.innerHeight,
  CAM_NEAR,
  CAM_FAR
);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);

const ambient = new THREE.AmbientLight(0xb8c8ff, 0.55);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff1d6, 1.2);
sun.position.set(120, 180, 90);
scene.add(sun);

const rimLight = new THREE.DirectionalLight(0x88a0ff, 0.32);
rimLight.position.set(-120, -60, -90);
scene.add(rimLight);

// Day/night cycle — full revolution every 30 minutes. Game starts at noon
// (phase=0, sunHeight=1) and reaches complete darkness at midnight (phase=0.5,
// 15 minutes in), then gradually returns to day.
const DAY_NIGHT_PERIOD = 1800; // seconds (30 min cycle, 15 min day→dark)
const _dnSunDir = new THREE.Vector3();
const _dnBgColor = new THREE.Color();

function updateDayNight(elapsedTime) {
  const phase = (elapsedTime % DAY_NIGHT_PERIOD) / DAY_NIGHT_PERIOD;
  const angle = phase * Math.PI * 2;
  // Sun orbits the planet; sunHeight=1 is noon, -1 is midnight.
  const sunHeight = Math.cos(angle);
  _dnSunDir.set(Math.sin(angle), sunHeight, 0.45).normalize();
  sun.position.copy(_dnSunDir).multiplyScalar(260);

  // Day factor: 0 at night, 1 at noon. Smooth twilight band near horizon.
  const dayFactor = Math.max(0, sunHeight);
  const horizonFactor = Math.max(0, 1 - Math.abs(sunHeight) * 3); // peaks near sunHeight=0

  sun.intensity = 0.04 + dayFactor * 1.35;
  ambient.intensity = 0.22 + dayFactor * 0.55;
  rimLight.intensity = 0.10 + dayFactor * 0.30;

  // Warm sunrise/sunset tint near the horizon, cool blue at night, bright at noon
  if (sunHeight > 0.35) {
    sun.color.setHex(0xfff1d6);
  } else if (sunHeight > 0) {
    const u = sunHeight / 0.35;          // 0 at horizon, 1 at "high enough"
    sun.color.setRGB(1.0, 0.55 + u * 0.4, 0.30 + u * 0.55);
  } else {
    sun.color.setHex(0x4a6699);
  }

  if (dayFactor > 0.3) {
    ambient.color.setHex(0xb8c8ff);
  } else if (sunHeight > -0.2) {
    // Twilight tint blends through warm/cool
    const u = (sunHeight + 0.2) / 0.5;
    ambient.color.setRGB(0.40 + u * 0.32, 0.40 + u * 0.38, 0.55 + u * 0.45);
  } else {
    ambient.color.setHex(0x2a3050);
  }

  // Scene background fades from black (night) to soft blue-grey (noon),
  // with a warm wash during sunrise/sunset.
  const bgNight = 0.02;
  const bgDay = 0.10;
  const bg = bgNight + dayFactor * (bgDay - bgNight);
  _dnBgColor.setRGB(bg * 0.55 + horizonFactor * 0.10, bg * 0.65 + horizonFactor * 0.06, bg * 0.85);
  scene.background.copy(_dnBgColor);
  if (scene.fog) scene.fog.color.copy(_dnBgColor);

  // Flashlight intensity scales with darkness — bright at night, dim in
  // sunlight so it's not blinding during the day.
  if (equipment.flashlight.equipped && equipment.flashlight.light) {
    equipment.flashlight.light.intensity = 0.4 + (1 - dayFactor) * 3.2;
  }
}

// =============================================================================
// Noise (terrain + tree clumping)
// =============================================================================

function noise3D(x, y, z) {
  return (
    Math.sin(x * 1.7 + y * 0.3 + z * 2.1) * 0.5 +
    Math.sin(x * 3.1 - y * 2.3 + z * 0.5) * 0.25 +
    Math.sin(x * 5.9 + y * 4.1 - z * 1.7) * 0.125
  );
}

function clumpNoise(x, y, z) {
  return (
    Math.sin(x * 0.8 + y * 1.1 - z * 0.6) * 0.5 +
    Math.sin(x * 1.9 - y * 0.7 + z * 1.5) * 0.3 +
    Math.sin(x * 4.1 + y * 2.7 + z * 3.3) * 0.2
  );
}

function surfaceHeightAt(direction) {
  const h = noise3D(direction.x * 2.4, direction.y * 2.4, direction.z * 2.4);
  return PLANET_RADIUS + h * PLANET_AMPLITUDE + SURFACE_OFFSET;
}

const _tnRef = new THREE.Vector3();
const _tnTan1 = new THREE.Vector3();
const _tnTan2 = new THREE.Vector3();
const _tnD1 = new THREE.Vector3();
const _tnD2 = new THREE.Vector3();
const _tnP0 = new THREE.Vector3();
const _tnP1 = new THREE.Vector3();
const _tnP2 = new THREE.Vector3();
const _tnE1 = new THREE.Vector3();
const _tnE2 = new THREE.Vector3();

// Approximate terrain normal at a given direction by sampling three nearby
// points on the displaced surface and crossing the resulting edges.
function computeTerrainNormal(dir, out) {
  const eps = 0.02;
  _tnRef.set(0, 1, 0);
  if (Math.abs(dir.y) > 0.9) _tnRef.set(1, 0, 0);
  _tnTan1.crossVectors(dir, _tnRef).normalize();
  _tnTan2.crossVectors(dir, _tnTan1).normalize();

  _tnP0.copy(dir).multiplyScalar(surfaceHeightAt(dir));

  _tnD1.copy(dir).addScaledVector(_tnTan1, eps).normalize();
  _tnD2.copy(dir).addScaledVector(_tnTan2, eps).normalize();
  _tnP1.copy(_tnD1).multiplyScalar(surfaceHeightAt(_tnD1));
  _tnP2.copy(_tnD2).multiplyScalar(surfaceHeightAt(_tnD2));

  _tnE1.subVectors(_tnP1, _tnP0);
  _tnE2.subVectors(_tnP2, _tnP0);
  out.crossVectors(_tnE1, _tnE2).normalize();
  if (out.dot(dir) < 0) out.negate();
  return out;
}

// =============================================================================
// Mountain planet
// =============================================================================

function buildMountainPlanet({ radius, detail, amplitude }) {
  const geo = new THREE.IcosahedronGeometry(radius, detail).toNonIndexed();
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const heights = new Float32Array(pos.count);

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.normalize();
    const h = noise3D(v.x * 2.4, v.y * 2.4, v.z * 2.4);
    heights[i] = h;
    const r = radius + h * amplitude;
    v.multiplyScalar(r);
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  const palette = {
    meadow:   [0.42, 0.58, 0.30],
    grass:    [0.55, 0.62, 0.32],
    foothill: [0.55, 0.42, 0.28],
    peak:     [0.82, 0.80, 0.78],
  };

  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 3) {
    const avg = (heights[i] + heights[i + 1] + heights[i + 2]) / 3;
    let c;
    if (avg < -0.20)      c = palette.meadow;
    else if (avg < 0.10)  c = palette.grass;
    else if (avg < 0.35)  c = palette.foothill;
    else                  c = palette.peak;

    for (let j = 0; j < 3; j++) {
      const k = (i + j) * 3;
      colors[k]     = c[0];
      colors[k + 1] = c[1];
      colors[k + 2] = c[2];
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.95,
    metalness: 0.0,
  });

  return new THREE.Mesh(geo, mat);
}

const planet = buildMountainPlanet({
  radius: PLANET_RADIUS,
  detail: PLANET_DETAIL,
  amplitude: PLANET_AMPLITUDE,
});
planet.rotation.x = PLANET_TILT;
scene.add(planet);

// =============================================================================
// Star the Fox — now with legs, tail rig, body group for animation
// =============================================================================

// Bipedal Star: stands upright on two legs, two arms with grabbable hands.
// Userdata exposes { bodyGroup, legs:{l,r}, arms:{l,r}, hands:{l,r}, tailRoot }
// for the animate loop to drive walk / swim / hold-flashlight poses.
function createStarTheFox() {
  const fox = new THREE.Group();

  const FUR_ORANGE = 0xe8732c;
  const FUR_WHITE = 0xfaf2e6;
  const SUIT_WHITE = 0xdce4f0;
  const SUIT_ACCENT = 0xff9a3c;
  const LIMB_ORANGE = 0xd66520;
  const EYE_BLACK = 0x121212;
  const HELMET_TINT = 0xaaccff;

  const furOrange = new THREE.MeshStandardMaterial({ color: FUR_ORANGE, flatShading: true, roughness: 0.85 });
  const furWhite = new THREE.MeshStandardMaterial({ color: FUR_WHITE, flatShading: true, roughness: 0.85 });
  const suit = new THREE.MeshStandardMaterial({ color: SUIT_WHITE, flatShading: true, roughness: 0.65 });
  const limbMat = new THREE.MeshStandardMaterial({ color: LIMB_ORANGE, flatShading: true, roughness: 0.85 });

  // ===== Two legs (pivot at hip, geometry hangs down) =====
  const legGeo = new THREE.CylinderGeometry(0.026, 0.020, 0.085, 6);
  legGeo.translate(0, -0.0425, 0);

  const HIP_Y = 0.085;
  const legL = new THREE.Mesh(legGeo, limbMat);
  legL.position.set(-0.04, HIP_Y, 0);
  const legR = new THREE.Mesh(legGeo, limbMat);
  legR.position.set(0.04, HIP_Y, 0);
  fox.add(legL, legR);

  // ===== Body group =====
  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 0.05;
  fox.add(bodyGroup);

  // Upright torso
  const bodyGeo = new THREE.SphereGeometry(0.085, 12, 10);
  bodyGeo.scale(0.95, 1.45, 0.75);
  const body = new THREE.Mesh(bodyGeo, suit);
  body.position.y = 0.15;
  bodyGroup.add(body);

  const chest = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, 0.045, 0.022),
    new THREE.MeshStandardMaterial({ color: SUIT_ACCENT, flatShading: true })
  );
  chest.position.set(0, 0.16, 0.07);
  bodyGroup.add(chest);

  // ===== Two arms with hands. Each arm is a group pivoted at the shoulder;
  // the arm mesh hangs down from it, and the hand is at the wrist. =====
  const armGeo = new THREE.CylinderGeometry(0.022, 0.017, 0.115, 5);
  armGeo.translate(0, -0.0575, 0);

  function buildArm(side) {
    const root = new THREE.Group();
    root.position.set(side * 0.085, 0.235, 0);
    const arm = new THREE.Mesh(armGeo, limbMat);
    root.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), limbMat);
    hand.position.y = -0.13;
    root.add(hand);
    return { root, hand };
  }
  const armLeft = buildArm(-1);
  const armRight = buildArm(1);
  bodyGroup.add(armLeft.root, armRight.root);

  // ===== Head =====
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.085, 1), furOrange);
  head.position.y = 0.305;
  bodyGroup.add(head);

  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 6), furWhite);
  snout.position.set(0, 0.29, 0.085);
  snout.rotation.x = Math.PI / 2;
  bodyGroup.add(snout);

  const noseTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 8, 6),
    new THREE.MeshStandardMaterial({ color: EYE_BLACK })
  );
  noseTip.position.set(0, 0.29, 0.125);
  bodyGroup.add(noseTip);

  const earGeo = new THREE.ConeGeometry(0.032, 0.07, 4);
  const earL = new THREE.Mesh(earGeo, furOrange);
  const earR = new THREE.Mesh(earGeo, furOrange);
  earL.position.set(-0.052, 0.385, -0.005);
  earR.position.set(0.052, 0.385, -0.005);
  earL.rotation.z = 0.22;
  earR.rotation.z = -0.22;
  bodyGroup.add(earL, earR);

  // Star marking around the right eye
  const starShape = new THREE.Shape();
  const STAR_PTS = 5;
  const STAR_OUTER = 0.032;
  const STAR_INNER = 0.014;
  for (let i = 0; i <= STAR_PTS * 2; i++) {
    const r = i % 2 === 0 ? STAR_OUTER : STAR_INNER;
    const a = (i / (STAR_PTS * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) starShape.moveTo(x, y);
    else starShape.lineTo(x, y);
  }
  const starMark = new THREE.Mesh(
    new THREE.ShapeGeometry(starShape),
    new THREE.MeshStandardMaterial({ color: FUR_WHITE, flatShading: true, side: THREE.DoubleSide })
  );
  starMark.position.set(0.04, 0.32, 0.078);
  starMark.lookAt(0.04, 0.32, 1);
  bodyGroup.add(starMark);

  const eyeMat = new THREE.MeshStandardMaterial({ color: EYE_BLACK });
  const eyeGeo = new THREE.SphereGeometry(0.012, 8, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.04, 0.32, 0.082);
  eyeR.position.set(0.04, 0.32, 0.088);
  bodyGroup.add(eyeL, eyeR);

  // Tail rig (low on the back) — pivots side-to-side for swish
  const tailRoot = new THREE.Group();
  tailRoot.position.set(0, 0.135, -0.075);
  bodyGroup.add(tailRoot);

  const tailTilt = new THREE.Group();
  tailTilt.rotation.x = -0.6;
  tailRoot.add(tailTilt);

  const tailGeo = new THREE.ConeGeometry(0.035, 0.16, 6);
  tailGeo.translate(0, 0.08, 0);
  const tail = new THREE.Mesh(tailGeo, furOrange);
  tailTilt.add(tail);

  const tailTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.038, 8, 6),
    furWhite
  );
  tailTip.position.set(0, 0.17, 0);
  tailTilt.add(tailTip);

  // Backpack on the upper back
  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.082, 0.13, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xc8d2e0, flatShading: true })
  );
  backpack.position.set(0, 0.18, -0.075);
  bodyGroup.add(backpack);

  // Helmet around the head
  const helmet = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.12, 2),
    new THREE.MeshStandardMaterial({
      color: HELMET_TINT,
      transparent: true,
      opacity: 0.22,
      roughness: 0.1,
      metalness: 0.4,
    })
  );
  helmet.position.y = 0.315;
  helmet.renderOrder = 1;
  bodyGroup.add(helmet);

  fox.userData = {
    bodyGroup,
    legs: { l: legL, r: legR },
    arms: { l: armLeft.root, r: armRight.root },
    hands: { l: armLeft.hand, r: armRight.hand },
    tailRoot,
  };
  return fox;
}

const starTheFox = createStarTheFox();
planet.add(starTheFox);

// =============================================================================
// Equipment (held items) — currently just the flashlight.
// =============================================================================

const equipment = {
  flashlight: { equipped: false, mesh: null, light: null },
};

function buildFlashlightMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x282b34, flatShading: true, metalness: 0.4, roughness: 0.55 });
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0xfff4a8, emissive: 0xfff4a8, emissiveIntensity: 1.4, roughness: 0.3,
  });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x4a4d57, flatShading: true, metalness: 0.55, roughness: 0.5 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 8), bodyMat);
  body.position.y = -0.025;
  g.add(body);

  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.014, 0.020, 8), headMat);
  head.position.y = 0.010;
  g.add(head);

  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.005, 8), lensMat);
  lens.position.y = 0.022;
  g.add(lens);

  return g;
}

function equipFlashlight() {
  if (equipment.flashlight.equipped) return;
  const hand = starTheFox.userData.hands.r;

  const mesh = buildFlashlightMesh();
  // Sit in the hand, oriented along hand's local +Y so it points the same
  // direction the arm extends. The "holding" arm pose has armR rotated
  // forward, so the flashlight ends up aiming forward in front of Star.
  mesh.position.set(0, -0.02, 0);
  hand.add(mesh);

  const light = new THREE.SpotLight(0xfff4a8, 0.0, 14, Math.PI / 6.5, 0.45, 1.4);
  light.position.set(0, 0.03, 0);
  const target = new THREE.Object3D();
  target.position.set(0, 1, 0); // along +Y in flashlight frame
  mesh.add(light, target);
  light.target = target;

  equipment.flashlight = { equipped: true, mesh, light };
}

function unequipFlashlight() {
  const e = equipment.flashlight;
  if (!e.equipped) return;
  const hand = starTheFox.userData.hands.r;
  if (e.mesh) {
    hand.remove(e.mesh);
    e.mesh.traverse((m) => {
      if (m.geometry) m.geometry.dispose?.();
    });
  }
  equipment.flashlight = { equipped: false, mesh: null, light: null };
}

// =============================================================================
// Star state on planet
// =============================================================================

const star = {
  position: new THREE.Vector3(0, SURFACE_MAX_R, 0),
  forward: new THREE.Vector3(0, 0, 1),          // body facing direction (smoothly chases targetForward)
  targetForward: new THREE.Vector3(0, 0, 1),    // direction Star is currently walking toward (set from input)
  walkPhase: 0,
  // Jump state — radial offset above the surface
  airHeight: 0,
  verticalVel: 0,
  airborne: false,
};

// Camera frame, independent from Star's facing — gets rotated by mouse/touch
// drag. Joystick input is interpreted in this frame so pushing "back" on the
// stick walks Star toward the camera (Roblox-style).
const camForward = new THREE.Vector3(0, 0, 1);

const STAR_JUMP_VEL = 5.5;     // initial radial velocity (units/sec)
const STAR_GRAVITY = 16;       // radial gravity (units/sec^2)
const STAR_TURN_RATE = 10;     // how fast star.forward chases star.targetForward (rad/sec)

// Place exactly on the displaced surface
{
  const dir = star.position.clone().normalize();
  star.position.setLength(surfaceHeightAt(dir));
}

const _right = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _stUp = new THREE.Vector3();
const _stTerrainUp = new THREE.Vector3();
const _stTempFwd = new THREE.Vector3();
const _stBaseQuat = new THREE.Quaternion();
const _stLeanQuat = new THREE.Quaternion();

// Star's storage frame stays anchored to the radial (sphere) up so mouse-look
// yaw and keyboard turn read out cleanly. We compute the visual terrain-lean
// as a separate quaternion that we post-multiply, without mutating star.forward.
function applyStarTransform() {
  _stUp.copy(star.position).normalize();

  // Base orientation: radial up + sphere-tangent forward (does not mutate star.forward)
  _stTempFwd.copy(star.forward).projectOnPlane(_stUp).normalize();
  _right.crossVectors(_stUp, _stTempFwd).normalize();
  _basis.makeBasis(_right, _stUp, _stTempFwd);
  _stBaseQuat.setFromRotationMatrix(_basis);

  // Visual lean: rotate from radial up to terrain up
  computeTerrainNormal(_stUp, _stTerrainUp);
  _stLeanQuat.setFromUnitVectors(_stUp, _stTerrainUp);

  starTheFox.quaternion.multiplyQuaternions(_stLeanQuat, _stBaseQuat);
  starTheFox.position.copy(star.position).addScaledVector(_stUp, star.airHeight);
}
applyStarTransform();

// =============================================================================
// Editor item factories — shared geometry/materials, individual Object3Ds
// =============================================================================

const trunkGeo = new THREE.CylinderGeometry(TREE_TRUNK_GEOM_RADIUS, 0.024, 0.08, 5);
trunkGeo.translate(0, 0.04, 0);
const trunkMat = new THREE.MeshStandardMaterial({
  color: 0x6b3f24, flatShading: true, roughness: 0.95,
});

const canopyLowerGeo = new THREE.ConeGeometry(0.07, 0.11, 6);
canopyLowerGeo.translate(0, 0.115, 0);
const canopyUpperGeo = new THREE.ConeGeometry(0.05, 0.08, 6);
canopyUpperGeo.translate(0, 0.17, 0);
const canopyMat = new THREE.MeshStandardMaterial({
  color: 0x37642e, flatShading: true, roughness: 0.9,
});

const rockMats = [
  new THREE.MeshStandardMaterial({ color: 0x807a72, flatShading: true, roughness: 0.95 }),
  new THREE.MeshStandardMaterial({ color: 0x6e6962, flatShading: true, roughness: 0.95 }),
  new THREE.MeshStandardMaterial({ color: 0x968f85, flatShading: true, roughness: 0.95 }),
];
const bushMats = [
  new THREE.MeshStandardMaterial({ color: 0x4e8a36, flatShading: true, roughness: 0.85 }),
  new THREE.MeshStandardMaterial({ color: 0x5fa346, flatShading: true, roughness: 0.85 }),
  new THREE.MeshStandardMaterial({ color: 0x3e6f2a, flatShading: true, roughness: 0.85 }),
];
const mushroomCapMat = new THREE.MeshStandardMaterial({
  color: 0xc0392b, flatShading: true, roughness: 0.7,
});
const mushroomSpotMat = new THREE.MeshStandardMaterial({
  color: 0xfaf2e6, flatShading: true, roughness: 0.7,
});
const mushroomStemMat = new THREE.MeshStandardMaterial({
  color: 0xf2e3c4, flatShading: true, roughness: 0.8,
});

// Builds a faceted irregular blob. Some geometries (SphereGeometry poles,
// IcosahedronGeometry non-indexed) have multiple vertex *entries* at the same
// XYZ position. Jittering each entry independently breaks face connectivity
// at those shared corners (the gaps Sam saw). Fix: group vertex entries by
// their original position and apply the SAME jitter scalar to every entry in
// a group. Coincident vertices stay coincident; faces stay connected.
function makeBlobGeo(radius, detail, jitterAmount) {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.attributes.position;

  const groups = new Map();
  const round = (x) => Math.round(x * 1e5) / 1e5;
  for (let i = 0; i < pos.count; i++) {
    const key = `${round(pos.getX(i))},${round(pos.getY(i))},${round(pos.getZ(i))}`;
    let group = groups.get(key);
    if (!group) {
      group = { jitter: 1 - jitterAmount * 0.5 + Math.random() * jitterAmount, indices: [] };
      groups.set(key, group);
    }
    group.indices.push(i);
  }

  const v = new THREE.Vector3();
  for (const group of groups.values()) {
    for (const i of group.indices) {
      v.fromBufferAttribute(pos, i);
      v.multiplyScalar(group.jitter);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }

  geo.computeVertexNormals();
  return geo;
}

// Flatten vertices below threshold so the blob sits on the ground.
function flattenBottom(geo, threshold, factor) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < threshold) pos.setY(i, y * factor);
  }
  geo.computeVertexNormals();
}

function createTreeItem() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(trunkGeo, trunkMat));
  g.add(new THREE.Mesh(canopyLowerGeo, canopyMat));
  g.add(new THREE.Mesh(canopyUpperGeo, canopyMat));
  return g;
}

function createRockItem() {
  const g = new THREE.Group();

  const mainGeo = makeBlobGeo(0.085, 1, 0.35);
  flattenBottom(mainGeo, -0.02, 0.25);
  const main = new THREE.Mesh(mainGeo, rockMats[Math.floor(Math.random() * 2)]);
  main.position.y = 0.018; // bottom of the flattened blob sits at ~ground
  main.rotation.y = Math.random() * Math.PI * 2;
  g.add(main);

  // Most rocks get a smaller buddy stone next to them
  if (Math.random() < 0.7) {
    const sGeo = makeBlobGeo(0.04, 1, 0.4);
    flattenBottom(sGeo, -0.01, 0.25);
    const s = new THREE.Mesh(sGeo, rockMats[2]);
    const a = Math.random() * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.075, 0.008, Math.sin(a) * 0.075);
    s.rotation.y = Math.random() * Math.PI * 2;
    g.add(s);
  }

  return g;
}

function createBushItem() {
  const g = new THREE.Group();

  const lumps = [
    { x:  0.000, y: 0.038, z:  0.000, r: 0.075, mat: bushMats[0] },
    { x:  0.055, y: 0.015, z:  0.020, r: 0.055, mat: bushMats[1] },
    { x: -0.045, y: 0.020, z: -0.030, r: 0.052, mat: bushMats[2] },
    { x:  0.015, y: 0.062, z: -0.035, r: 0.043, mat: bushMats[1] },
  ];
  for (const l of lumps) {
    const geo = makeBlobGeo(l.r, 1, 0.2);
    flattenBottom(geo, -l.r * 0.7, 0.45);
    const m = new THREE.Mesh(geo, l.mat);
    m.position.set(l.x, l.y, l.z);
    m.rotation.y = Math.random() * Math.PI * 2;
    g.add(m);
  }

  return g;
}

function createMushroomItem() {
  const g = new THREE.Group();
  const stemGeo = new THREE.CylinderGeometry(0.018, 0.022, 0.06, 6);
  stemGeo.translate(0, 0.03, 0);
  g.add(new THREE.Mesh(stemGeo, mushroomStemMat));

  const capGeo = new THREE.SphereGeometry(0.05, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const cap = new THREE.Mesh(capGeo, mushroomCapMat);
  cap.position.y = 0.06;
  g.add(cap);

  // Three white spots on the cap
  for (let i = 0; i < 3; i++) {
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), mushroomSpotMat);
    const a = (i / 3) * Math.PI * 2 + 0.7;
    spot.position.set(Math.cos(a) * 0.028, 0.087, Math.sin(a) * 0.028);
    g.add(spot);
  }
  return g;
}

const waterMat = new THREE.MeshStandardMaterial({
  color: 0x6aaedc,        // lighter, lake-blue so submerged shapes show through
  transparent: true,
  opacity: 0.62,          // translucent enough to see the swimming creature beneath
  roughness: 0.12,
  metalness: 0.5,
  flatShading: false,
  side: THREE.DoubleSide,
  // depthWrite default (true) — sharks render in opaque pass FIRST, water then
  // blends on top. So under-water bodies are tinted by water; the top fin
  // sticking above water surface is rendered without that tint.
});

const WATER_EDGE_COUNT = 12;
const WATER_DEFAULT_RADIUS = 0.22;
const WATER_BASE_Y = 0.005;

// Builds the pond as a triangle fan from a centre vertex out to N edge
// vertices. Edge vertex (x, z) values come from item.edgePoints — that's how
// dragging a handle reshapes the pond (a "stream" is just a few edge points
// pulled far out in one direction).
function buildWaterDiskGeometry(edgePoints) {
  const N = edgePoints.length;
  const positions = new Float32Array((N + 1) * 3);
  positions[0] = 0;
  positions[1] = WATER_BASE_Y;
  positions[2] = 0;
  for (let i = 0; i < N; i++) {
    const p = edgePoints[i];
    const o = (i + 1) * 3;
    positions[o] = p.x;
    positions[o + 1] = WATER_BASE_Y;
    positions[o + 2] = p.z;
  }
  const indices = new Uint16Array(N * 3);
  for (let i = 0; i < N; i++) {
    indices[i * 3] = 0;
    indices[i * 3 + 1] = i + 1;
    indices[i * 3 + 2] = ((i + 1) % N) + 1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();
  return geo;
}

function defaultWaterEdgePoints() {
  const pts = [];
  for (let i = 0; i < WATER_EDGE_COUNT; i++) {
    const a = (i / WATER_EDGE_COUNT) * Math.PI * 2;
    pts.push({
      x: Math.cos(a) * WATER_DEFAULT_RADIUS,
      z: Math.sin(a) * WATER_DEFAULT_RADIUS,
    });
  }
  return pts;
}

function createWaterItem() {
  const g = new THREE.Group();
  const edgePoints = defaultWaterEdgePoints();
  const geo = buildWaterDiskGeometry(edgePoints);
  const disk = new THREE.Mesh(geo, waterMat);
  g.add(disk);

  g.userData.waterDisk = disk;
  g.userData.initialEdgePoints = edgePoints;
  return g;
}

// Edge vertices of the pond polygon bend DOWN (in pond-local Y) so the disk
// follows the planet's curvature rather than extending tangent-flat into space.
// World drop ≈ r² / (2R); divide by item.scale to convert to pond-local.
function waterEdgeCurveY(item, px, pz) {
  const r2 = px * px + pz * pz;
  return -(r2 * item.scale) / (2 * PLANET_RADIUS);
}

function animateWater(t) {
  for (const item of placedItems) {
    if (item.type !== 'water') continue;
    const disk = item.root.userData.waterDisk;
    if (!disk || !item.edgePoints) continue;
    const arr = disk.geometry.attributes.position.array;

    // Centre vertex bobs slightly
    arr[1] = WATER_BASE_Y + Math.sin(t * 0.8) * 0.0012;

    for (let i = 0; i < item.edgePoints.length; i++) {
      const p = item.edgePoints[i];
      const offset = (i + 1) * 3;
      const curveY = waterEdgeCurveY(item, p.x, p.z);
      arr[offset] = p.x;
      arr[offset + 1] = WATER_BASE_Y + curveY +
        Math.sin(p.x * 6.5 + t * 1.4) * 0.005 +
        Math.cos(p.z * 8.2 + t * 1.05) * 0.004 +
        Math.sin((p.x + p.z) * 3.1 + t * 0.65) * 0.003;
      arr[offset + 2] = p.z;
    }

    disk.geometry.attributes.position.needsUpdate = true;
    disk.geometry.computeVertexNormals();
  }
}

// -----------------------------------------------------------------------------
// Pond local-frame helpers (used by handle drag + star-in-water check)
// -----------------------------------------------------------------------------

const _wlTerrainUp = new THREE.Vector3();
const _wlRef = new THREE.Vector3();
const _wlLocalZ = new THREE.Vector3();
const _wlLocalX = new THREE.Vector3();

function computeWaterLocalBasis(item, outX, outZ, outUp) {
  computeTerrainNormal(item.dir, _wlTerrainUp);
  outUp.copy(_wlTerrainUp);
  _wlRef.set(0, 1, 0);
  if (Math.abs(_wlTerrainUp.y) > 0.95) _wlRef.set(1, 0, 0);
  outZ.crossVectors(_wlTerrainUp, _wlRef).normalize();
  outZ.applyAxisAngle(_wlTerrainUp, item.yaw);
  outX.crossVectors(_wlTerrainUp, outZ).normalize();
}

const _wlPondPlanarVec = new THREE.Vector3();

// 2D point-in-polygon (ray-cast across +x). edgePoints are in pond local
// (x, z), so we treat them as 2D points.
function pointInWaterPolygon(px, pz, edgePoints) {
  let inside = false;
  for (let i = 0, j = edgePoints.length - 1; i < edgePoints.length; j = i++) {
    const xi = edgePoints[i].x;
    const zi = edgePoints[i].z;
    const xj = edgePoints[j].x;
    const zj = edgePoints[j].z;
    if (((zi > pz) !== (zj > pz)) &&
        (px < (xj - xi) * (pz - zi) / (zj - zi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// Convert a planet-local point to pond-local (x, z) and run point-in-polygon.
function pointInWater(item, planetLocalPoint) {
  computeWaterLocalBasis(item, _wlLocalX, _wlLocalZ, _wlTerrainUp);
  _wlPondPlanarVec.copy(planetLocalPoint).sub(item.pos).projectOnPlane(_wlTerrainUp);
  const px = _wlPondPlanarVec.dot(_wlLocalX) / item.scale;
  const pz = _wlPondPlanarVec.dot(_wlLocalZ) / item.scale;
  return pointInWaterPolygon(px, pz, item.edgePoints);
}

function starInWater(item) {
  return pointInWater(item, star.position);
}

const penguinBodyMat = new THREE.MeshStandardMaterial({ color: 0x3a3d6e, flatShading: true, roughness: 0.6 });
const penguinBellyMat = new THREE.MeshStandardMaterial({ color: 0xc4e0e8, flatShading: true, roughness: 0.7 });
const penguinBeakMat = new THREE.MeshStandardMaterial({ color: 0xe89a4e, flatShading: true, roughness: 0.7 });
const penguinFootMat = new THREE.MeshStandardMaterial({ color: 0xe89a4e, flatShading: true, roughness: 0.8 });
const penguinEyeWhiteMat = new THREE.MeshStandardMaterial({
  color: 0xfffce8, emissive: 0x66ccff, emissiveIntensity: 0.4, roughness: 0.4,
});
const penguinPupilMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2a });
const penguinAntennaMat = new THREE.MeshStandardMaterial({
  color: 0xff66cc, emissive: 0xff33aa, emissiveIntensity: 0.6, roughness: 0.4,
});

function createPenguinItem() {
  const root = new THREE.Group();

  // Body group lets us bob/animate without rebuilding the matrix
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const bodyGeo = new THREE.SphereGeometry(0.11, 10, 8);
  bodyGeo.scale(0.9, 1.2, 0.9);
  const body = new THREE.Mesh(bodyGeo, penguinBodyMat);
  body.position.y = 0.13;
  bodyGroup.add(body);

  const bellyGeo = new THREE.SphereGeometry(0.09, 10, 8);
  bellyGeo.scale(0.85, 1.05, 0.5);
  const belly = new THREE.Mesh(bellyGeo, penguinBellyMat);
  belly.position.set(0, 0.12, 0.038);
  bodyGroup.add(belly);

  const headGeo = new THREE.SphereGeometry(0.075, 10, 8);
  const head = new THREE.Mesh(headGeo, penguinBodyMat);
  head.position.y = 0.27;
  bodyGroup.add(head);

  const beakGeo = new THREE.ConeGeometry(0.022, 0.05, 6);
  beakGeo.rotateX(Math.PI / 2);
  beakGeo.translate(0, 0, 0.025);
  const beak = new THREE.Mesh(beakGeo, penguinBeakMat);
  beak.position.set(0, 0.26, 0.07);
  bodyGroup.add(beak);

  // Big alien eyes
  const eyeGeo = new THREE.SphereGeometry(0.022, 8, 6);
  const eyeL = new THREE.Mesh(eyeGeo, penguinEyeWhiteMat);
  const eyeR = new THREE.Mesh(eyeGeo, penguinEyeWhiteMat);
  eyeL.position.set(-0.032, 0.295, 0.058);
  eyeR.position.set(0.032, 0.295, 0.058);
  bodyGroup.add(eyeL, eyeR);

  const pupilGeo = new THREE.SphereGeometry(0.009, 6, 5);
  const pupilL = new THREE.Mesh(pupilGeo, penguinPupilMat);
  const pupilR = new THREE.Mesh(pupilGeo, penguinPupilMat);
  pupilL.position.set(-0.032, 0.295, 0.077);
  pupilR.position.set(0.032, 0.295, 0.077);
  bodyGroup.add(pupilL, pupilR);

  // Flippers — anchored from shoulder so we can flap
  const flipperGeo = new THREE.SphereGeometry(0.05, 8, 6);
  flipperGeo.scale(0.28, 1.1, 0.55);
  flipperGeo.translate(0, -0.04, 0); // pivot at top
  const flipperL = new THREE.Mesh(flipperGeo, penguinBodyMat);
  const flipperR = new THREE.Mesh(flipperGeo, penguinBodyMat);
  flipperL.position.set(-0.105, 0.18, 0);
  flipperR.position.set(0.105, 0.18, 0);
  flipperL.rotation.z = 0.25;
  flipperR.rotation.z = -0.25;
  bodyGroup.add(flipperL, flipperR);

  // Flat oval feet
  const footGeo = new THREE.SphereGeometry(0.04, 8, 6);
  footGeo.scale(0.65, 0.3, 1.3);
  const footL = new THREE.Mesh(footGeo, penguinFootMat);
  const footR = new THREE.Mesh(footGeo, penguinFootMat);
  footL.position.set(-0.035, 0.018, 0.04);
  footR.position.set(0.035, 0.018, 0.04);
  root.add(footL, footR);

  // Antennae — sway-able sub-group
  const antennaGroup = new THREE.Group();
  antennaGroup.position.y = 0.32;
  for (let i = 0; i < 2; i++) {
    const x = i === 0 ? -0.025 : 0.025;
    const stalkGeo = new THREE.CylinderGeometry(0.005, 0.007, 0.08, 5);
    stalkGeo.translate(0, 0.04, 0);
    const stalk = new THREE.Mesh(stalkGeo, penguinAntennaMat);
    stalk.position.set(x, 0, 0);
    antennaGroup.add(stalk);

    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 5), penguinAntennaMat);
    tip.position.set(x, 0.085, 0);
    antennaGroup.add(tip);
  }
  bodyGroup.add(antennaGroup);

  root.userData.parts = { bodyGroup, flipperL, flipperR, antennaGroup };
  return root;
}

// -----------------------------------------------------------------------------
// Alien shark — red + black mismatched eyes, big teeth, glow stripes,
// dives in and out via a vertical body bob.
// -----------------------------------------------------------------------------

function createSharkItem() {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const skinMat = new THREE.MeshStandardMaterial({ color: 0x3f4f78, flatShading: true, roughness: 0.55, metalness: 0.15 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xc8d4dc, flatShading: true });
  const finMat = new THREE.MeshStandardMaterial({ color: 0x2f3d5e, flatShading: true });
  const toothMat = new THREE.MeshStandardMaterial({ color: 0xfaf2e0, flatShading: true });
  const eyeRed = new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0xcc1010, emissiveIntensity: 0.6 });
  const eyeBlack = new THREE.MeshStandardMaterial({ color: 0x121212 });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x66ffcc, emissive: 0x44ffaa, emissiveIntensity: 0.7 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x661122, flatShading: true });

  // Body: elongated, slightly tapered
  const bodyGeo = new THREE.SphereGeometry(0.08, 14, 8);
  bodyGeo.scale(0.85, 0.85, 2.6);
  const body = new THREE.Mesh(bodyGeo, skinMat);
  body.position.y = 0.1;
  bodyGroup.add(body);

  // Lighter belly underneath
  const bellyGeo = new THREE.SphereGeometry(0.075, 12, 6);
  bellyGeo.scale(0.85, 0.45, 2.3);
  const belly = new THREE.Mesh(bellyGeo, bellyMat);
  belly.position.set(0, 0.062, 0);
  bodyGroup.add(belly);

  // Tail fin (vertical) at the back
  const tailGeo = new THREE.ConeGeometry(0.06, 0.13, 4);
  tailGeo.scale(0.5, 1, 1.6);
  tailGeo.rotateX(Math.PI);
  const tail = new THREE.Mesh(tailGeo, finMat);
  tail.position.set(0, 0.1, -0.22);
  bodyGroup.add(tail);

  // Dorsal fin
  const dorsalGeo = new THREE.ConeGeometry(0.05, 0.08, 3);
  dorsalGeo.scale(0.6, 1, 0.5);
  const dorsal = new THREE.Mesh(dorsalGeo, finMat);
  dorsal.position.set(0, 0.19, 0.02);
  bodyGroup.add(dorsal);

  // Side pectoral fins
  const sideFinGeo = new THREE.ConeGeometry(0.04, 0.09, 3);
  sideFinGeo.rotateZ(-Math.PI / 2);
  sideFinGeo.scale(1, 1, 0.4);
  const finL = new THREE.Mesh(sideFinGeo, finMat);
  const finR = new THREE.Mesh(sideFinGeo, finMat);
  finL.position.set(-0.085, 0.07, 0.05);
  finR.position.set(0.085, 0.07, 0.05);
  finR.rotation.z = Math.PI;
  bodyGroup.add(finL, finR);

  // Asymmetric alien eyes — RED on left, BLACK on right (Sam's spec)
  const eyeGeo = new THREE.SphereGeometry(0.016, 8, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeRed);
  const eyeR = new THREE.Mesh(eyeGeo, eyeBlack);
  eyeL.position.set(-0.045, 0.14, 0.16);
  eyeR.position.set(0.045, 0.14, 0.16);
  bodyGroup.add(eyeL, eyeR);

  // Mouth gape
  const mouthGeo = new THREE.SphereGeometry(0.06, 10, 6);
  mouthGeo.scale(1, 0.45, 0.7);
  const mouth = new THREE.Mesh(mouthGeo, mouthMat);
  mouth.position.set(0, 0.08, 0.19);
  bodyGroup.add(mouth);

  // Big teeth — two rows of cones (upper points down, lower points up)
  const toothGeo = new THREE.ConeGeometry(0.01, 0.028, 3);
  for (let i = 0; i < 7; i++) {
    const a = (i / 6 - 0.5) * Math.PI * 0.7;
    const x = Math.sin(a) * 0.04;
    const z = 0.22;
    const t = new THREE.Mesh(toothGeo, toothMat);
    t.position.set(x, 0.087, z);
    t.rotation.x = Math.PI;
    bodyGroup.add(t);
    const t2 = new THREE.Mesh(toothGeo, toothMat);
    t2.position.set(x, 0.058, z);
    bodyGroup.add(t2);
  }

  // Glow stripes along sides
  const stripeGeo = new THREE.SphereGeometry(0.011, 6, 5);
  for (let i = 0; i < 4; i++) {
    const z = 0.08 - i * 0.06;
    const sl = new THREE.Mesh(stripeGeo, glowMat);
    sl.position.set(-0.07, 0.11, z);
    bodyGroup.add(sl);
    const sr = new THREE.Mesh(stripeGeo, glowMat);
    sr.position.set(0.07, 0.11, z);
    bodyGroup.add(sr);
  }

  root.userData.parts = { bodyGroup, tail };
  return root;
}

// -----------------------------------------------------------------------------
// Alien dolphin — sleek body, FOUR side fins (two pairs), glowing pink dorsal
// stripes, big glowing eyes.
// -----------------------------------------------------------------------------

function createDolphinItem() {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const skinMat = new THREE.MeshStandardMaterial({ color: 0x86a8e6, flatShading: true, roughness: 0.3, metalness: 0.35 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xeaf2fa, flatShading: true });
  const finMat = new THREE.MeshStandardMaterial({ color: 0xc0a8e8, flatShading: true });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xfaf2e0, emissive: 0xff44aa, emissiveIntensity: 0.7 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xff66cc, emissive: 0xff44aa, emissiveIntensity: 0.55 });

  // Sleek body
  const bodyGeo = new THREE.SphereGeometry(0.07, 12, 8);
  bodyGeo.scale(0.7, 0.8, 2.4);
  const body = new THREE.Mesh(bodyGeo, skinMat);
  body.position.y = 0.1;
  bodyGroup.add(body);

  // Belly
  const bellyGeo = new THREE.SphereGeometry(0.065, 10, 6);
  bellyGeo.scale(0.7, 0.45, 2.0);
  const belly = new THREE.Mesh(bellyGeo, bellyMat);
  belly.position.set(0, 0.068, 0);
  bodyGroup.add(belly);

  // Long snout pointing forward
  const snoutGeo = new THREE.ConeGeometry(0.035, 0.13, 8);
  snoutGeo.rotateX(Math.PI / 2);
  const snout = new THREE.Mesh(snoutGeo, skinMat);
  snout.position.set(0, 0.1, 0.21);
  bodyGroup.add(snout);

  // Tail flukes (horizontal, two)
  const flukeGeo = new THREE.ConeGeometry(0.05, 0.07, 4);
  flukeGeo.scale(1.6, 1, 0.35);
  flukeGeo.rotateZ(Math.PI / 2);
  const flukeL = new THREE.Mesh(flukeGeo, finMat);
  const flukeR = new THREE.Mesh(flukeGeo, finMat);
  flukeL.position.set(-0.07, 0.1, -0.2);
  flukeR.position.set(0.07, 0.1, -0.2);
  flukeR.rotation.z = Math.PI;
  bodyGroup.add(flukeL, flukeR);

  // Dorsal fin
  const dorsalGeo = new THREE.ConeGeometry(0.04, 0.07, 3);
  dorsalGeo.scale(0.6, 1, 0.6);
  const dorsal = new THREE.Mesh(dorsalGeo, finMat);
  dorsal.position.set(0, 0.18, -0.05);
  bodyGroup.add(dorsal);

  // FOUR side fins (two pairs — alien!)
  const sideFinGeo = new THREE.ConeGeometry(0.035, 0.08, 3);
  sideFinGeo.rotateZ(-Math.PI / 2);
  sideFinGeo.scale(1, 1, 0.5);
  for (let i = 0; i < 4; i++) {
    const isLeft = i % 2 === 0;
    const isFront = i < 2;
    const fin = new THREE.Mesh(sideFinGeo, finMat);
    fin.position.set(isLeft ? -0.08 : 0.08, 0.08, isFront ? 0.04 : -0.06);
    if (!isLeft) fin.rotation.z = Math.PI;
    bodyGroup.add(fin);
  }

  // Big glowing pink eyes
  const eyeGeo = new THREE.SphereGeometry(0.018, 8, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.04, 0.14, 0.11);
  eyeR.position.set(0.04, 0.14, 0.11);
  bodyGroup.add(eyeL, eyeR);

  // Glowing stripe of dots along the back
  for (let i = 0; i < 5; i++) {
    const stripe = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 5), stripeMat);
    stripe.position.set(0, 0.165, 0.1 - i * 0.06);
    bodyGroup.add(stripe);
  }

  root.userData.parts = { bodyGroup };
  return root;
}

// -----------------------------------------------------------------------------
// Dragon — bat-style wings, horns, glowing orange eyes, visible saddle.
// (Placeable only; the ride/mount mechanic is queued for a follow-up.)
// -----------------------------------------------------------------------------

function createDragonItem() {
  const root = new THREE.Group();

  const scaleMat = new THREE.MeshStandardMaterial({ color: 0x4a3a6e, flatShading: true, roughness: 0.5, metalness: 0.35 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0x8a6ab0, flatShading: true });
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x6a4a8a, flatShading: true, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff5500, emissiveIntensity: 0.85 });
  const saddleMat = new THREE.MeshStandardMaterial({ color: 0x6b3f24, flatShading: true });
  const saddleAccentMat = new THREE.MeshStandardMaterial({ color: 0xc28846, flatShading: true });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xff4488, emissive: 0xff2266, emissiveIntensity: 0.5 });

  // Body
  const bodyGeo = new THREE.SphereGeometry(0.12, 14, 8);
  bodyGeo.scale(1.0, 0.9, 1.85);
  const body = new THREE.Mesh(bodyGeo, scaleMat);
  body.position.y = 0.18;
  root.add(body);

  // Belly
  const bellyGeo = new THREE.SphereGeometry(0.115, 12, 6);
  bellyGeo.scale(1.0, 0.5, 1.6);
  const belly = new THREE.Mesh(bellyGeo, bellyMat);
  belly.position.set(0, 0.12, 0);
  root.add(belly);

  // Long curving neck (cylinder angled up + forward)
  const neckGeo = new THREE.CylinderGeometry(0.05, 0.085, 0.18, 8);
  neckGeo.rotateX(Math.PI / 2.5);
  const neck = new THREE.Mesh(neckGeo, scaleMat);
  neck.position.set(0, 0.26, 0.16);
  root.add(neck);

  // Head
  const headGeo = new THREE.SphereGeometry(0.085, 10, 6);
  headGeo.scale(0.95, 0.9, 1.4);
  const head = new THREE.Mesh(headGeo, scaleMat);
  head.position.set(0, 0.32, 0.3);
  root.add(head);

  // Horns
  const hornGeo = new THREE.ConeGeometry(0.018, 0.08, 5);
  const hornL = new THREE.Mesh(hornGeo, accentMat);
  const hornR = new THREE.Mesh(hornGeo, accentMat);
  hornL.position.set(-0.045, 0.39, 0.27);
  hornR.position.set(0.045, 0.39, 0.27);
  hornL.rotation.z = 0.35;
  hornR.rotation.z = -0.35;
  root.add(hornL, hornR);

  // Glowing orange eyes
  const eyeGeo = new THREE.SphereGeometry(0.02, 8, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.048, 0.335, 0.36);
  eyeR.position.set(0.048, 0.335, 0.36);
  root.add(eyeL, eyeR);

  // Bat wings — simple triangles pivoted from shoulders
  function makeWing(side) {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      0,    0,    0,
      0.32, 0.05, -0.04,
      0,    0,    -0.22,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex([0, 1, 2]);
    geo.computeVertexNormals();
    const w = new THREE.Mesh(geo, wingMat);
    w.position.set(side * 0.1, 0.24, 0);
    if (side < 0) w.scale.x = -1;
    return w;
  }
  const wingL = makeWing(-1);
  const wingR = makeWing(1);
  root.add(wingL, wingR);

  // Tail (long cone)
  const tailGeo = new THREE.ConeGeometry(0.045, 0.3, 6);
  tailGeo.rotateX(-Math.PI / 2);
  const tail = new THREE.Mesh(tailGeo, scaleMat);
  tail.position.set(0, 0.18, -0.27);
  root.add(tail);

  // Saddle (visible, prominent on back)
  const saddleGeo = new THREE.BoxGeometry(0.16, 0.05, 0.13);
  const saddle = new THREE.Mesh(saddleGeo, saddleMat);
  saddle.position.set(0, 0.295, -0.02);
  root.add(saddle);
  const saddleHornGeo = new THREE.BoxGeometry(0.06, 0.05, 0.035);
  const saddleHorn = new THREE.Mesh(saddleHornGeo, saddleAccentMat);
  saddleHorn.position.set(0, 0.33, 0.05);
  root.add(saddleHorn);

  // Four short legs
  for (let i = 0; i < 4; i++) {
    const isFront = i < 2;
    const isLeft = i % 2 === 0;
    const legGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.1, 6);
    legGeo.translate(0, -0.05, 0);
    const leg = new THREE.Mesh(legGeo, scaleMat);
    leg.position.set(isLeft ? -0.09 : 0.09, 0.1, isFront ? 0.09 : -0.1);
    root.add(leg);
  }

  root.userData.parts = { wingL, wingR, head };
  return root;
}

// -----------------------------------------------------------------------------
// Three alien birds — Sky Wisp, Plasma Wren, Twinbeak.
// All share the same animation hook (root.userData.parts.wings).
// -----------------------------------------------------------------------------

function makeBirdWingGeo(span, depth) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0,     0, 0,
    span,  0, -depth * 0.3,
    0,     0, -depth,
  ]), 3));
  geo.setIndex([0, 1, 2]);
  geo.computeVertexNormals();
  return geo;
}

function createBirdSkyWispItem() {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xa8e0f0, flatShading: true });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0xc8f0ff, flatShading: true, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xb8e0ff, flatShading: true, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
  });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111122 });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xffaa66, flatShading: true });

  const bodyGeo = new THREE.SphereGeometry(0.05, 10, 6);
  bodyGeo.scale(1, 0.9, 1.5);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  root.add(body);

  // Trailing ribbon-like tail
  for (let i = 0; i < 4; i++) {
    const tailGeo = new THREE.ConeGeometry(0.018 - i * 0.003, 0.05, 4);
    tailGeo.rotateX(-Math.PI / 2);
    const t = new THREE.Mesh(tailGeo, tailMat);
    t.position.set(0, 0, -0.07 - i * 0.04);
    root.add(t);
  }

  const wingGeo = makeBirdWingGeo(0.13, 0.08);
  const wingL = new THREE.Mesh(wingGeo, wingMat);
  const wingR = new THREE.Mesh(wingGeo, wingMat);
  wingL.position.set(0, 0.015, 0);
  wingR.position.set(0, 0.015, 0);
  wingR.scale.x = -1;
  root.add(wingL, wingR);

  const beakGeo = new THREE.ConeGeometry(0.014, 0.03, 4);
  beakGeo.rotateX(Math.PI / 2);
  const beak = new THREE.Mesh(beakGeo, beakMat);
  beak.position.set(0, 0, 0.08);
  root.add(beak);

  const eyeGeo = new THREE.SphereGeometry(0.008, 6, 5);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.022, 0.02, 0.045);
  eyeR.position.set(0.022, 0.02, 0.045);
  root.add(eyeL, eyeR);

  root.userData.parts = { wings: [wingL, wingR] };
  return root;
}

function createBirdPlasmaWrenItem() {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff44aa, flatShading: true, emissive: 0xff2288, emissiveIntensity: 0.25 });
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x66ccff, flatShading: true, emissive: 0x4488ff, emissiveIntensity: 0.35 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xfff0aa, emissive: 0xffcc44, emissiveIntensity: 0.7 });

  const bodyGeo = new THREE.IcosahedronGeometry(0.05, 0);
  bodyGeo.scale(0.9, 0.9, 1.6);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  root.add(body);

  const crestGeo = new THREE.ConeGeometry(0.014, 0.06, 4);
  const crest = new THREE.Mesh(crestGeo, wingMat);
  crest.position.set(0, 0.06, 0.01);
  root.add(crest);

  const wingGeo = makeBirdWingGeo(0.11, 0.07);
  const wingL = new THREE.Mesh(wingGeo, wingMat);
  const wingR = new THREE.Mesh(wingGeo, wingMat);
  wingL.position.set(0, 0.02, 0);
  wingR.position.set(0, 0.02, 0);
  wingR.scale.x = -1;
  root.add(wingL, wingR);

  const beakGeo = new THREE.ConeGeometry(0.013, 0.028, 4);
  beakGeo.rotateX(Math.PI / 2);
  const beak = new THREE.Mesh(beakGeo, wingMat);
  beak.position.set(0, -0.005, 0.075);
  root.add(beak);

  const eyeGeo = new THREE.SphereGeometry(0.009, 6, 5);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.022, 0.018, 0.04);
  eyeR.position.set(0.022, 0.018, 0.04);
  root.add(eyeL, eyeR);

  const tailGeo = new THREE.ConeGeometry(0.02, 0.06, 4);
  tailGeo.rotateX(-Math.PI / 2);
  const tail = new THREE.Mesh(tailGeo, bodyMat);
  tail.position.set(0, 0.005, -0.075);
  root.add(tail);

  root.userData.parts = { wings: [wingL, wingR] };
  return root;
}

function createBirdTwinbeakItem() {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x7e9d5a, flatShading: true });
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x5a7d3a, flatShading: true });
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xd6c878, flatShading: true });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xddaa44, flatShading: true });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const tuftMat = new THREE.MeshStandardMaterial({ color: 0xddaa44, flatShading: true });

  const bodyGeo = new THREE.SphereGeometry(0.055, 10, 8);
  bodyGeo.scale(1.1, 1, 1.45);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  root.add(body);

  // Belly
  const bellyGeo = new THREE.SphereGeometry(0.05, 8, 6);
  bellyGeo.scale(0.9, 0.45, 1.25);
  const belly = new THREE.Mesh(bellyGeo, bellyMat);
  belly.position.y = -0.025;
  root.add(belly);

  // Two beaks (alien feature)
  const beakGeo = new THREE.ConeGeometry(0.013, 0.04, 4);
  beakGeo.rotateX(Math.PI / 2);
  const beak1 = new THREE.Mesh(beakGeo, beakMat);
  beak1.position.set(-0.018, 0, 0.08);
  beak1.rotation.y = -0.2;
  const beak2 = new THREE.Mesh(beakGeo, beakMat);
  beak2.position.set(0.018, 0, 0.08);
  beak2.rotation.y = 0.2;
  root.add(beak1, beak2);

  // Crown tuft
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), tuftMat);
  crown.position.set(0, 0.055, 0.02);
  root.add(crown);

  // Wings (rounded triangles)
  const wingGeo = makeBirdWingGeo(0.1, 0.06);
  const wingL = new THREE.Mesh(wingGeo, wingMat);
  const wingR = new THREE.Mesh(wingGeo, wingMat);
  wingL.position.set(0, 0.012, 0);
  wingR.position.set(0, 0.012, 0);
  wingR.scale.x = -1;
  root.add(wingL, wingR);

  // Four small eyes (alien!)
  const eyeGeo = new THREE.SphereGeometry(0.008, 6, 5);
  for (let i = 0; i < 4; i++) {
    const e = new THREE.Mesh(eyeGeo, eyeMat);
    const x = i % 2 === 0 ? -0.022 : 0.022;
    const y = i < 2 ? 0.028 : 0.012;
    e.position.set(x, y, 0.045);
    root.add(e);
  }

  const tailGeo = new THREE.SphereGeometry(0.026, 6, 5);
  tailGeo.scale(1, 0.55, 1.2);
  const tail = new THREE.Mesh(tailGeo, bodyMat);
  tail.position.set(0, 0, -0.08);
  root.add(tail);

  root.userData.parts = { wings: [wingL, wingR] };
  return root;
}

const ITEM_TYPES = {
  tree:     { label: 'Tree',        build: createTreeItem,            defaultScale: 6,   collisionR: 0.035, collisionType: 'solid' },
  rock:     { label: 'Rock',        build: createRockItem,            defaultScale: 4,   collisionR: 0.06,  collisionType: 'solid' },
  bush:     { label: 'Bush',        build: createBushItem,            defaultScale: 3,   collisionR: 0.05,  collisionType: 'solid' },
  mushroom: { label: 'Mushroom',    build: createMushroomItem,        defaultScale: 2.5, collisionR: 0.04,  collisionType: 'solid' },
  water:    { label: 'Pond',        build: createWaterItem,           defaultScale: 4,   collisionR: 0.21,  collisionType: 'submerge' },
  penguin:  { label: 'Penguin',     build: createPenguinItem,         defaultScale: 1.4, collisionR: 0.10,  collisionType: 'solid', behavior: 'creature' },
  shark:    { label: 'Shark',       build: createSharkItem,           defaultScale: 1.2, collisionR: 0.16,  collisionType: 'solid', behavior: 'aquatic' },
  dolphin:  { label: 'Dolphin',     build: createDolphinItem,         defaultScale: 1.3, collisionR: 0.14,  collisionType: 'solid', behavior: 'aquatic' },
  dragon:   { label: 'Dragon',      build: createDragonItem,          defaultScale: 2.4, collisionR: 0.20,  collisionType: 'solid', behavior: 'dragon' },
  birdWisp: { label: 'Sky Wisp',    build: createBirdSkyWispItem,     defaultScale: 1.0, collisionR: 0.04,  collisionType: 'solid', behavior: 'flyer', flightAlt: 3.5, flightRadius: 6 },
  birdWren: { label: 'Plasma Wren', build: createBirdPlasmaWrenItem,  defaultScale: 0.9, collisionR: 0.04,  collisionType: 'solid', behavior: 'flyer', flightAlt: 5.0, flightRadius: 8 },
  birdTwin: { label: 'Twinbeak',    build: createBirdTwinbeakItem,    defaultScale: 1.0, collisionR: 0.05,  collisionType: 'solid', behavior: 'flyer', flightAlt: 4.0, flightRadius: 7 },
};

// =============================================================================
// Placed items registry — anything the editor drops into the world
// =============================================================================

const placedItems = []; // { type, root, scale, dir, pos }
const itemsGroup = new THREE.Group();
planet.add(itemsGroup);

// Place an item on the planet at `dir` with the given yaw around the surface
// normal. yaw is persisted on the item so dragging only changes position.
function placeItemOnSurface(root, dir, yaw) {
  const surfaceR = surfaceHeightAt(dir);
  const pos = dir.clone().multiplyScalar(surfaceR);

  const terrainUp = new THREE.Vector3();
  computeTerrainNormal(dir, terrainUp);

  const ref = Math.abs(terrainUp.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const fwd = new THREE.Vector3().crossVectors(terrainUp, ref).normalize();
  fwd.applyAxisAngle(terrainUp, yaw);
  const right = new THREE.Vector3().crossVectors(terrainUp, fwd).normalize();

  const basis = new THREE.Matrix4().makeBasis(right, terrainUp, fwd);
  root.quaternion.setFromRotationMatrix(basis);
  root.position.copy(pos);
  return pos;
}

function addItem(type, dir) {
  const def = ITEM_TYPES[type];
  if (!def) return null;
  const root = def.build();
  const scale = def.defaultScale;
  root.scale.setScalar(scale);
  root.userData.itemType = type;
  root.userData.isPlacedItem = true;
  const yaw = Math.random() * Math.PI * 2;
  const pos = placeItemOnSurface(root, dir, yaw);
  itemsGroup.add(root);

  const item = { type, root, scale, dir: dir.clone(), pos: pos.clone(), yaw };
  if (root.userData.initialEdgePoints) {
    item.edgePoints = root.userData.initialEdgePoints;
    delete root.userData.initialEdgePoints;
    updateWaterMaxRadius(item);
  }
  root.userData.item = item;
  placedItems.push(item);
  return item;
}

function moveItem(item, newDir, resetHome = false) {
  const pos = placeItemOnSurface(item.root, newDir, item.yaw);
  item.dir.copy(newDir);
  item.pos.copy(pos);
  // When the user drags an item, re-anchor its wander/flight AI to the new
  // spot so it doesn't try to crawl back to where it started.
  if (resetHome && item.ai && item.ai.homeDir) {
    item.ai.homeDir.copy(newDir);
    if (item.ai.targetDir) item.ai.targetDir.copy(newDir);
  }
}

function removeItem(item) {
  const idx = placedItems.indexOf(item);
  if (idx === -1) return;
  placedItems.splice(idx, 1);
  if (item.handlesGroup) hideWaterHandles(item);
  itemsGroup.remove(item.root);
  if (item.bubble) {
    item.bubble.remove();
    item.bubble = null;
  }
  item.root.traverse((obj) => {
    if (obj.geometry && obj.geometry !== trunkGeo && obj.geometry !== canopyLowerGeo &&
        obj.geometry !== canopyUpperGeo && obj.geometry !== handleGeo) {
      obj.geometry.dispose?.();
    }
  });
}

function duplicateItem(item) {
  // Offset the duplicate slightly along a random tangent
  const dir = item.dir.clone();
  const ref = Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const tan = new THREE.Vector3().crossVectors(dir, ref).normalize();
  tan.applyAxisAngle(dir, Math.random() * Math.PI * 2);
  const newDir = dir.addScaledVector(tan, 0.005).normalize();
  const newItem = addItem(item.type, newDir);
  if (newItem) {
    newItem.scale = item.scale;
    newItem.root.scale.setScalar(item.scale);
    newItem.yaw = item.yaw;
    placeItemOnSurface(newItem.root, newDir, item.yaw);
  }
  return newItem;
}

function resizeItem(item, factor) {
  item.scale = Math.max(0.5, Math.min(20, item.scale * factor));
  item.root.scale.setScalar(item.scale);
}

function resolveCollisions(targetPos) {
  for (const item of placedItems) {
    const def = ITEM_TYPES[item.type];
    if (def.collisionType !== 'solid') continue;
    const dx = targetPos.x - item.pos.x;
    const dy = targetPos.y - item.pos.y;
    const dz = targetPos.z - item.pos.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq > 9) continue;
    const totalR = STAR_COLLISION_RADIUS + def.collisionR * item.scale;
    if (distSq < totalR * totalR && distSq > 1e-6) {
      const dist = Math.sqrt(distSq);
      const push = (totalR - dist) / dist;
      targetPos.x += dx * push;
      targetPos.y += dy * push;
      targetPos.z += dz * push;
    }
  }
}

const _settleDir = new THREE.Vector3();

// Adjust Star's radial height each frame:
// - On ground: sit at the noise surface + SURFACE_OFFSET
// - In a pond: sit AT the water surface (no submerging into the planet mesh)
// Also sets star.inWater for the animation loop to switch to swim-cycle.
function settleStarOnSurface(starPos) {
  const dir = _settleDir.copy(starPos).normalize();

  let waterItem = null;
  for (const item of placedItems) {
    const def = ITEM_TYPES[item.type];
    if (def.collisionType !== 'submerge') continue;
    if (!item.edgePoints) continue;
    const dx = starPos.x - item.pos.x;
    const dy = starPos.y - item.pos.y;
    const dz = starPos.z - item.pos.z;
    const maxR = (item.maxEdgeRadius || 0.3) * item.scale + 0.1;
    if (dx * dx + dy * dy + dz * dz > maxR * maxR) continue;
    if (starInWater(item)) {
      waterItem = item;
      break;
    }
  }
  star.inWater = !!waterItem;

  const surfaceR = surfaceHeightAt(dir); // already includes SURFACE_OFFSET
  if (waterItem) {
    // Place Star on top of the pond disk (disk sits at noise + 0.005*scale).
    // Net: she swims on the water surface, body above the planet mesh.
    starPos.copy(dir).multiplyScalar(surfaceR - SURFACE_OFFSET + 0.005 * waterItem.scale);
  } else {
    starPos.copy(dir).multiplyScalar(surfaceR);
  }
}

// Cache the largest edgePoint distance per item so the prefilter above can
// reject far-away ponds without running point-in-polygon.
function updateWaterMaxRadius(item) {
  if (!item.edgePoints) return;
  let m = 0;
  for (const p of item.edgePoints) {
    const d = Math.sqrt(p.x * p.x + p.z * p.z);
    if (d > m) m = d;
  }
  item.maxEdgeRadius = m;
}

// -----------------------------------------------------------------------------
// Water push: drift Star while she's inside a pond. Direction rotates slowly
// over time so it feels like a swirling current.
// -----------------------------------------------------------------------------

const _wpUpL = new THREE.Vector3();
const _wpTan1 = new THREE.Vector3();
const _wpTan2 = new THREE.Vector3();
const _wpRef = new THREE.Vector3();
const _wpCurrent = new THREE.Vector3();
const _wpAxis = new THREE.Vector3();
const WATER_PUSH_LINEAR_SPEED = 0.45; // units / second along the surface

function applyWaterPush(dt) {
  let inWater = false;
  for (const item of placedItems) {
    if (item.type !== 'water') continue;
    if (!item.edgePoints) continue;
    if (starInWater(item)) {
      inWater = true;
      break;
    }
  }
  if (!inWater) return;

  _wpUpL.copy(star.position).normalize();
  _wpRef.set(0, 1, 0);
  if (Math.abs(_wpUpL.y) > 0.95) _wpRef.set(1, 0, 0);
  _wpTan1.crossVectors(_wpUpL, _wpRef).normalize();
  _wpTan2.crossVectors(_wpUpL, _wpTan1).normalize();

  const t = clock.elapsedTime;
  const angle = t * 0.35;
  _wpCurrent
    .copy(_wpTan1).multiplyScalar(Math.cos(angle))
    .addScaledVector(_wpTan2, Math.sin(angle));

  _wpAxis.crossVectors(_wpCurrent, _wpUpL).normalize();
  const angSpeed = WATER_PUSH_LINEAR_SPEED / PLANET_RADIUS;
  const stepAngle = angSpeed * dt;
  star.position.applyAxisAngle(_wpAxis, stepAngle);
  star.forward.applyAxisAngle(_wpAxis, stepAngle);
}

// =============================================================================
// Creatures — wander AI + flipper / antenna animation
// =============================================================================

const _crUpL = new THREE.Vector3();
const _crToStar = new THREE.Vector3();
const _crTan = new THREE.Vector3();
const _crAxis = new THREE.Vector3();
const _crMoveAxis = new THREE.Vector3();
const _crTerrainUp = new THREE.Vector3();
const _crFwd = new THREE.Vector3();
const _crRight = new THREE.Vector3();
const _crBasis = new THREE.Matrix4();
const _crRef = new THREE.Vector3();
const _crFwdRef = new THREE.Vector3();
const _crSign = new THREE.Vector3();

function setItemFacing(item, facingDir) {
  computeTerrainNormal(item.dir, _crTerrainUp);
  _crFwd.copy(facingDir).projectOnPlane(_crTerrainUp);
  if (_crFwd.lengthSq() < 1e-6) return;
  _crFwd.normalize();
  _crRight.crossVectors(_crTerrainUp, _crFwd).normalize();
  _crBasis.makeBasis(_crRight, _crTerrainUp, _crFwd);
  item.root.quaternion.setFromRotationMatrix(_crBasis);

  // Keep item.yaw in sync (so drag-to-move preserves current facing)
  _crRef.set(0, 1, 0);
  if (Math.abs(_crTerrainUp.y) > 0.95) _crRef.set(1, 0, 0);
  _crFwdRef.crossVectors(_crTerrainUp, _crRef).normalize();
  _crSign.crossVectors(_crFwdRef, _crFwd);
  const sin = _crSign.dot(_crTerrainUp);
  const cos = _crFwdRef.dot(_crFwd);
  item.yaw = Math.atan2(sin, cos);
}

// -----------------------------------------------------------------------------
// Penguin audio (synthesized alien speech) + speech bubbles
// -----------------------------------------------------------------------------

let audioCtx = null;
function ensureAudio() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
  } catch (e) {
    audioCtx = null;
  }
  return audioCtx;
}

const PENGUIN_SOUND_PRESETS = {
  greet:   { baseFreq: 380, syllables: 4, vary: 0.45, duration: 0.65, volume: 0.10 },
  close:   { baseFreq: 540, syllables: 2, vary: 0.35, duration: 0.32, volume: 0.10 },
  idle:    { baseFreq: 320, syllables: 3, vary: 0.55, duration: 0.55, volume: 0.08 },
  arrived: { baseFreq: 430, syllables: 2, vary: 0.4,  duration: 0.42, volume: 0.09 },
  placed:  { baseFreq: 270, syllables: 5, vary: 0.6,  duration: 0.95, volume: 0.11 },
};

function playPenguinTalk(type) {
  const ctx = audioCtx;
  if (!ctx) return;
  const p = PENGUIN_SOUND_PRESETS[type] || PENGUIN_SOUND_PRESETS.idle;
  const t = ctx.currentTime;
  const syllableDur = p.duration / p.syllables;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1600;
  filter.Q.value = 1.2;
  filter.connect(ctx.destination);

  for (let i = 0; i < p.syllables; i++) {
    const start = t + i * syllableDur;
    const freq = p.baseFreq * (1 + (Math.random() - 0.5) * p.vary);
    const sub = syllableDur * (0.65 + Math.random() * 0.25);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = Math.random() < 0.55 ? 'square' : 'triangle';

    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.linearRampToValueAtTime(freq * (1 + (Math.random() - 0.5) * 0.4), start + sub * 0.5);
    osc.frequency.linearRampToValueAtTime(freq * (0.85 + Math.random() * 0.2), start + sub);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(p.volume, start + sub * 0.08);
    gain.gain.linearRampToValueAtTime(p.volume * 0.9, start + sub * 0.75);
    gain.gain.linearRampToValueAtTime(0, start + sub);

    osc.connect(gain);
    gain.connect(filter);
    osc.start(start);
    osc.stop(start + sub + 0.02);
  }
}

const PENGUIN_PHRASES = {
  greet: [
    'Greetings, fox-being!',
    'Glorbnax! A friend!',
    'Beep boop — hello!',
    'Salutations, traveler!',
    'Ooh, a fluffy creature!',
    'Take me to your leader!',
    'Friend or moon-snack?',
    'Two legs! Marvellous!',
  ],
  close: [
    '*waddle waddle*',
    'Personal space, please!',
    'Your whiskers tickle!',
    '*sniffs curiously*',
    'Such a soft tail!',
    'Are you... real?',
  ],
  idle: [
    '*hums an alien tune*',
    'Lovely planet you have here.',
    'Three moons rising tonight.',
    'I miss the home nebula.',
    '*scratches antenna*',
    'Is this... grass? Wonderful.',
    'My helmet feels itchy.',
    'Beep.',
    'Squawk!',
    'Where did I park my ship?',
  ],
  arrived: [
    'What a view!',
    'This spot will do.',
    '*surveys the area*',
    'Hmm, cozy.',
    'I claim this rock.',
  ],
  placed: [
    'Whoa! Where am I?',
    'How did I get here?',
    'Hello, new world!',
    'Cool, a planet!',
    'Did someone summon me?',
  ],
};

function showSpeechBubble(item, text, holdSeconds = 3.2) {
  if (!item.bubble) {
    item.bubble = document.createElement('div');
    item.bubble.className = 'speech-bubble';
    document.body.appendChild(item.bubble);
  }
  item.bubble.textContent = text;
  item.bubble.classList.add('is-visible');
  item.bubbleHideAt = clock.elapsedTime + holdSeconds + Math.min(2, text.length * 0.04);
}

function tryPenguinSpeak(item, type) {
  const ai = item.ai;
  if (!ai) return;
  const now = clock.elapsedTime;
  if (ai.lastSpokeAt && now - ai.lastSpokeAt < 2.4) return;
  const pool = PENGUIN_PHRASES[type];
  if (!pool || pool.length === 0) return;

  let phrase;
  let tries = 0;
  do {
    phrase = pool[Math.floor(Math.random() * pool.length)];
    tries++;
  } while (phrase === ai.lastPhrase && pool.length > 1 && tries < 5);
  ai.lastPhrase = phrase;
  ai.lastSpokeAt = now;

  showSpeechBubble(item, phrase);
  playPenguinTalk(type);
}

const _bubbleWorld = new THREE.Vector3();
function updateSpeechBubbles() {
  const now = clock.elapsedTime;
  for (const item of placedItems) {
    if (item.type !== 'penguin' || !item.bubble) continue;
    if (item.bubbleHideAt && now > item.bubbleHideAt) {
      item.bubble.classList.remove('is-visible');
    }
    _bubbleWorld.set(0, 0.5, 0);
    item.root.localToWorld(_bubbleWorld);
    _bubbleWorld.project(camera);
    if (_bubbleWorld.z > 1 || Math.abs(_bubbleWorld.x) > 1.4 || Math.abs(_bubbleWorld.y) > 1.4) {
      item.bubble.style.display = 'none';
    } else {
      item.bubble.style.display = '';
      const x = (_bubbleWorld.x + 1) * 0.5 * window.innerWidth;
      const y = (1 - _bubbleWorld.y) * 0.5 * window.innerHeight;
      item.bubble.style.left = `${x}px`;
      item.bubble.style.top = `${y}px`;
    }
  }
}

// -----------------------------------------------------------------------------

const PENGUIN_WALK_SPEED = 0.005;
const PENGUIN_TURN_SPEED = 3.0;
const PENGUIN_VERY_CLOSE_DIST = 1.6;
const PENGUIN_WANDER_ARC = 0.025;
const PENGUIN_NOTICE_DIST = 4.0;

function updateCreatures(dt) {
  const t = clock.elapsedTime;
  for (const item of placedItems) {
    const def = ITEM_TYPES[item.type];
    const behavior = def.behavior;
    if (behavior === 'creature') updatePenguinAI(item, dt);
    else if (behavior === 'aquatic') updateAquaticAI(item, dt, t);
    else if (behavior === 'flyer') updateFlyerAI(item, dt, t);
    else if (behavior === 'dragon') updateDragonAI(item, dt, t);
  }
}

function updatePenguinAI(item, dt) {
    if (!item.ai) {
      item.ai = {
        homeDir: item.dir.clone(),
        targetDir: item.dir.clone(),
        retargetIn: 1.5 + Math.random() * 3,
        facingDir: null,
        walkAnim: 0,
        idle: true,
        walking: false,
        justSpawned: true,
        spawnSpeakAt: clock.elapsedTime + 0.6,
        starNoticed: false,
        starVeryClose: false,
        idleSpeakIn: 6 + Math.random() * 8,
        lastTargetAi: null,
      };
    }
    const ai = item.ai;
    const now = clock.elapsedTime;

    // First-words after spawn
    if (ai.justSpawned && now >= ai.spawnSpeakAt) {
      ai.justSpawned = false;
      tryPenguinSpeak(item, 'placed');
    }

    _crUpL.copy(item.dir);
    _crToStar.subVectors(star.position, item.pos);
    const distToStar = _crToStar.length();

    // Greet / close / left triggers
    if (distToStar < PENGUIN_NOTICE_DIST) {
      if (!ai.starNoticed) {
        ai.starNoticed = true;
        tryPenguinSpeak(item, 'greet');
      }
    } else if (distToStar > PENGUIN_NOTICE_DIST + 1.8) {
      ai.starNoticed = false;
    }

    if (distToStar < PENGUIN_VERY_CLOSE_DIST) {
      if (!ai.starVeryClose) {
        ai.starVeryClose = true;
        tryPenguinSpeak(item, 'close');
      }
    } else if (distToStar > PENGUIN_VERY_CLOSE_DIST + 0.6) {
      ai.starVeryClose = false;
    }

    let desiredFacing = null;
    ai.walking = false;

    if (distToStar < PENGUIN_NOTICE_DIST) {
      // Look at Star, stop wandering
      _crToStar.projectOnPlane(_crUpL);
      if (_crToStar.lengthSq() > 0.001) desiredFacing = _crToStar.clone().normalize();
      ai.idle = true;
      ai.retargetIn = Math.max(ai.retargetIn, 1.5);
    } else {
      ai.retargetIn -= dt;
      if (ai.retargetIn <= 0 && ai.idle) {
        // Pick new wander target near home
        _crRef.set(0, 1, 0);
        if (Math.abs(ai.homeDir.y) > 0.95) _crRef.set(1, 0, 0);
        _crTan.crossVectors(ai.homeDir, _crRef).normalize();
        _crTan.applyAxisAngle(ai.homeDir, Math.random() * Math.PI * 2);
        _crAxis.crossVectors(ai.homeDir, _crTan).normalize();
        const arc = PENGUIN_WANDER_ARC * (0.4 + Math.random() * 0.6);
        ai.targetDir.copy(ai.homeDir).applyAxisAngle(_crAxis, arc).normalize();
        ai.idle = false;
        ai.retargetIn = 3 + Math.random() * 4;
      }

      if (!ai.idle) {
        const angleToTarget = item.dir.angleTo(ai.targetDir);
        if (angleToTarget > 0.0005) {
          ai.walking = true;
          _crMoveAxis.crossVectors(item.dir, ai.targetDir);
          if (_crMoveAxis.lengthSq() > 1e-8) {
            _crMoveAxis.normalize();
            const step = Math.min(angleToTarget, PENGUIN_WALK_SPEED * dt * 60);
            const newDir = item.dir.clone().applyAxisAngle(_crMoveAxis, step).normalize();
            // Movement direction in tangent plane = perpendicular to up, along moveAxis
            _crFwd.crossVectors(_crMoveAxis, _crUpL).normalize();
            desiredFacing = _crFwd.clone();
            moveItem(item, newDir);
            _crUpL.copy(item.dir);
          }
        } else {
          ai.idle = true;
          ai.retargetIn = 1.5 + Math.random() * 2.5;
          if (Math.random() < 0.45) tryPenguinSpeak(item, 'arrived');
        }
      }

      // Random idle chit-chat when Star is far away
      ai.idleSpeakIn -= dt;
      if (ai.idleSpeakIn <= 0) {
        ai.idleSpeakIn = 9 + Math.random() * 12;
        tryPenguinSpeak(item, 'idle');
      }
    }

    // Smoothly rotate facingDir toward desiredFacing
    if (desiredFacing) {
      if (!ai.facingDir) {
        ai.facingDir = desiredFacing.clone();
      } else {
        const angle = ai.facingDir.angleTo(desiredFacing);
        if (angle > 0.001) {
          const maxStep = PENGUIN_TURN_SPEED * dt;
          const stepFrac = Math.min(1, maxStep / angle);
          const stepAngle = stepFrac * angle;
          const axis = new THREE.Vector3().crossVectors(ai.facingDir, desiredFacing);
          if (axis.lengthSq() > 1e-6) {
            axis.normalize();
            ai.facingDir.applyAxisAngle(axis, stepAngle);
          }
          ai.facingDir.projectOnPlane(_crUpL).normalize();
        }
      }
      setItemFacing(item, ai.facingDir);
    }

    // Walk / idle animation
    const parts = item.root.userData.parts;
    if (parts) {
      if (ai.walking) {
        ai.walkAnim += dt * 5;
        const swing = Math.sin(ai.walkAnim);
        parts.flipperL.rotation.z = 0.25 + swing * 0.45;
        parts.flipperR.rotation.z = -0.25 - swing * 0.45;
        parts.bodyGroup.position.y = Math.abs(Math.sin(ai.walkAnim * 2)) * 0.012;
      } else {
        ai.walkAnim += dt * 0.6;
        parts.flipperL.rotation.z = 0.25 + Math.sin(ai.walkAnim) * 0.05;
        parts.flipperR.rotation.z = -0.25 - Math.sin(ai.walkAnim + 0.3) * 0.05;
        parts.bodyGroup.position.y = 0;
      }
      if (parts.antennaGroup) {
        parts.antennaGroup.rotation.z = Math.sin(ai.walkAnim * 0.7) * 0.18;
        parts.antennaGroup.rotation.x = Math.sin(ai.walkAnim * 0.5 + 1.1) * 0.12;
      }
    }
}

// -----------------------------------------------------------------------------
// Aquatic creatures (shark, dolphin) — penguin-style wander + vertical
// dive-bob animation.
// -----------------------------------------------------------------------------

const _aqProbe = new THREE.Vector3();

// Picks a target inside the pond polygon by sampling in pond-local (x, z)
// directly. This is faster + tighter than angular sampling around homeDir
// because the rejection rate is much lower (we already know the bounds).
function pickAquaticTarget(item) {
  const water = item.waterItem;
  if (!water || !water.edgePoints) return item.dir.clone();

  computeWaterLocalBasis(water, _hdLocalX, _hdLocalZ, _hdTerrainUp);
  const maxR = water.maxEdgeRadius || 0.3;

  for (let attempt = 0; attempt < 22; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * (maxR * 0.78); // bias toward interior
    const px = Math.cos(angle) * r;
    const pz = Math.sin(angle) * r;
    if (!pointInWaterPolygon(px, pz, water.edgePoints)) continue;
    _aqProbe.copy(water.pos)
      .addScaledVector(_hdLocalX, px * water.scale)
      .addScaledVector(_hdLocalZ, pz * water.scale);
    return _aqProbe.normalize().clone();
  }
  return item.dir.clone();
}

const AQUATIC_LINEAR_SPEED = 0.7;  // world units per second
const AQUATIC_TURN_RATE = 1.6;     // rad / sec, smoothing facingDir
const AQUATIC_WIGGLE_AMPLITUDE = 0.22;
const AQUATIC_WIGGLE_FREQ = 4.0;   // sin freq while swimming

function updateAquaticAI(item, dt, t) {
  if (!item.ai) {
    item.ai = {
      homeDir: item.dir.clone(),
      targetDir: item.dir.clone(),
      retargetIn: 0.5 + Math.random() * 2,
      facingDir: null,
      walking: false,
      speedT: 0,
      swimPhase: Math.random() * Math.PI * 2,
      breachIn: 6 + Math.random() * 12,
      breachT: 0,
    };
    // Seed the first target right away so it doesn't sit motionless
    item.ai.targetDir.copy(pickAquaticTarget(item));
  }
  const ai = item.ai;

  ai.retargetIn -= dt;
  if (ai.retargetIn <= 0) {
    ai.targetDir.copy(pickAquaticTarget(item));
    ai.retargetIn = 2.5 + Math.random() * 4;
  }

  _crUpL.copy(item.dir);
  let desiredFacing = null;
  const wasWalking = ai.walking;

  const angleToTarget = item.dir.angleTo(ai.targetDir);
  // Step size driven by absolute linear speed + speed-easing factor
  const maxStep = (AQUATIC_LINEAR_SPEED / PLANET_RADIUS) * dt * ai.speedT;
  if (angleToTarget > maxStep * 0.05) {
    ai.walking = true;
    _crMoveAxis.crossVectors(item.dir, ai.targetDir);
    if (_crMoveAxis.lengthSq() > 1e-8) {
      _crMoveAxis.normalize();
      const step = Math.min(angleToTarget, Math.max(maxStep, 1e-6));
      const newDir = item.dir.clone().applyAxisAngle(_crMoveAxis, step).normalize();
      _crFwd.crossVectors(_crMoveAxis, _crUpL).normalize();
      desiredFacing = _crFwd.clone();
      moveItem(item, newDir);
    }
  } else {
    ai.walking = false;
  }

  // Smoothly chase the desired facing direction
  if (desiredFacing) {
    if (!ai.facingDir) {
      ai.facingDir = desiredFacing.clone();
    } else {
      const angle = ai.facingDir.angleTo(desiredFacing);
      if (angle > 0.001) {
        const maxTurn = AQUATIC_TURN_RATE * dt;
        const stepFrac = Math.min(1, maxTurn / angle);
        const axis = new THREE.Vector3().crossVectors(ai.facingDir, desiredFacing);
        if (axis.lengthSq() > 1e-6) {
          axis.normalize();
          ai.facingDir.applyAxisAngle(axis, stepFrac * angle);
        }
        ai.facingDir.projectOnPlane(_crUpL).normalize();
      }
    }
    setItemFacing(item, ai.facingDir);
  }

  // Speed easing — exponential lerp toward target speed.
  const targetSpeedT = ai.walking ? 1 : 0;
  ai.speedT += (targetSpeedT - ai.speedT) * Math.min(1, dt * 2.4);

  // Body wiggle: tail/body sways side-to-side while swimming. Amplitude
  // scales with current speed, so it eases in/out with the motion.
  ai.swimPhase += dt * (1.4 + ai.speedT * AQUATIC_WIGGLE_FREQ);

  // Breach trigger
  ai.breachIn -= dt;
  if (ai.breachIn <= 0 && ai.breachT <= 0) {
    ai.breachT = 1.1;
    ai.breachIn = 8 + Math.random() * 14;
  }
  let breachOffset = 0;
  let breachPitch = 0;
  if (ai.breachT > 0) {
    ai.breachT -= dt;
    const u = Math.max(0, Math.min(1, 1 - ai.breachT / 1.1));
    const arc = 4 * u * (1 - u);
    breachOffset = arc * 0.55;
    breachPitch = -Math.cos(u * Math.PI) * 0.55;
  }

  const parts = item.root.userData.parts;
  if (parts && parts.bodyGroup) {
    // Body sits deep so it's mostly submerged below the water disk; only the
    // top fin / back pokes above the surface. Breach lifts it up clearly.
    parts.bodyGroup.position.y = -0.20 + breachOffset;
    parts.bodyGroup.rotation.x = breachPitch;
    parts.bodyGroup.rotation.y = Math.sin(ai.swimPhase) * AQUATIC_WIGGLE_AMPLITUDE * ai.speedT;
  }
}

// -----------------------------------------------------------------------------
// Flyers (alien birds) — orbit at altitude above their placement point.
// -----------------------------------------------------------------------------

const _flyTan1 = new THREE.Vector3();
const _flyTan2 = new THREE.Vector3();
const _flyDir = new THREE.Vector3();
const _flyVel = new THREE.Vector3();
const _flyRight = new THREE.Vector3();
const _flyBasis = new THREE.Matrix4();
const _flyRef = new THREE.Vector3();

function updateFlyerAI(item, dt, t) {
  const def = ITEM_TYPES[item.type];
  if (!item.ai) {
    item.ai = {
      homeDir: item.dir.clone(),
      orbitAngle: Math.random() * Math.PI * 2,
      orbitSpeed: 0.55 + Math.random() * 0.5,
      orbitRadius: (def.flightRadius || 6) * (0.7 + Math.random() * 0.6),
      altitude: (def.flightAlt || 4) * (0.85 + Math.random() * 0.3),
      altOscPhase: Math.random() * Math.PI * 2,
    };
  }
  const ai = item.ai;

  ai.orbitAngle += dt * ai.orbitSpeed;
  ai.altOscPhase += dt * 1.6;

  // Build tangent basis at the bird's home point
  _flyRef.set(0, 1, 0);
  if (Math.abs(ai.homeDir.y) > 0.95) _flyRef.set(1, 0, 0);
  _flyTan1.crossVectors(ai.homeDir, _flyRef).normalize();
  _flyTan2.crossVectors(ai.homeDir, _flyTan1).normalize();

  const arcRadius = ai.orbitRadius / PLANET_RADIUS;
  const cosA = Math.cos(ai.orbitAngle);
  const sinA = Math.sin(ai.orbitAngle);
  _flyDir.copy(ai.homeDir)
    .addScaledVector(_flyTan1, cosA * arcRadius)
    .addScaledVector(_flyTan2, sinA * arcRadius)
    .normalize();

  const surfaceR = surfaceHeightAt(_flyDir);
  const altWobble = Math.sin(ai.altOscPhase) * 0.35;
  const r = surfaceR + ai.altitude + altWobble;

  item.dir.copy(_flyDir);
  item.pos.copy(_flyDir).multiplyScalar(r);
  item.root.position.copy(item.pos);

  // Facing = direction of motion (tangent to the orbit on the sphere)
  _flyVel.copy(_flyTan1).multiplyScalar(-sinA)
    .addScaledVector(_flyTan2, cosA)
    .projectOnPlane(_flyDir)
    .normalize();
  _flyRight.crossVectors(_flyDir, _flyVel).normalize();
  _flyBasis.makeBasis(_flyRight, _flyDir, _flyVel);
  item.root.quaternion.setFromRotationMatrix(_flyBasis);

  // Wing flap
  const parts = item.root.userData.parts;
  if (parts && parts.wings) {
    const flap = Math.sin(t * 9) * 0.7;
    parts.wings[0].rotation.z = 0.3 + flap;
    parts.wings[1].rotation.z = -0.3 - flap;
  }
}

// -----------------------------------------------------------------------------
// Dragon — placeholder idle animation while we wait on the ride mechanic.
// -----------------------------------------------------------------------------

function updateDragonAI(item, dt, t) {
  if (!item.ai) item.ai = { idle: 0 };
  item.ai.idle += dt;
  const parts = item.root.userData.parts;
  if (parts) {
    if (parts.wingL && parts.wingR) {
      const flap = Math.sin(item.ai.idle * 1.5) * 0.18;
      parts.wingL.rotation.z = 0.08 + flap;
      parts.wingR.rotation.z = -0.08 - flap;
    }
    if (parts.head) {
      parts.head.rotation.y = Math.sin(item.ai.idle * 0.45) * 0.18;
    }
  }
}

// =============================================================================
// Starfield
// =============================================================================

function buildStarfield(count, innerR, outerR) {
  const positions = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    if (v.lengthSq() < 0.0001) v.set(1, 0, 0);
    v.normalize().multiplyScalar(innerR + Math.random() * (outerR - innerR));
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2.5,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    fog: false,
  });
  return new THREE.Points(geo, mat);
}
scene.add(buildStarfield(STARFIELD_COUNT, STARFIELD_INNER, STARFIELD_OUTER));

// =============================================================================
// Input — keyboard, on-screen D-pad, mouse-look with pointer lock
// =============================================================================

const input = { fwd: false, back: false, left: false, right: false };
let camPitch = 0;
let pointerLocked = false;

const KEY_MAP = {
  KeyW: 'fwd', ArrowUp: 'fwd',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    triggerJump();
    return;
  }
  const action = KEY_MAP[e.code];
  if (!action) return;
  e.preventDefault();
  input[action] = true;
});
window.addEventListener('keyup', (e) => {
  const action = KEY_MAP[e.code];
  if (!action) return;
  e.preventDefault();
  input[action] = false;
});

// Virtual joystick: pointerdown anywhere on the base captures the pointer,
// pointermove updates the knob position. inputX/inputY are normalized to
// [-1, 1] with magnitude clamped to 1. inputY > 0 = forward in camera frame.
const joystick = {
  active: false,
  pointerId: null,
  centerX: 0,
  centerY: 0,
  radius: 1,
  inputX: 0,
  inputY: 0,
};
const joystickBase = document.querySelector('.joystick');
const joystickKnob = document.querySelector('.joystick-knob');

function resetJoystick() {
  joystick.active = false;
  joystick.pointerId = null;
  joystick.inputX = 0;
  joystick.inputY = 0;
  if (joystickKnob) joystickKnob.style.transform = 'translate(0px, 0px)';
  if (joystickBase) joystickBase.classList.remove('is-active');
}

function joystickUpdate(clientX, clientY) {
  let dx = clientX - joystick.centerX;
  let dy = clientY - joystick.centerY;
  const maxR = joystick.radius * 0.6;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > maxR) {
    dx = (dx / dist) * maxR;
    dy = (dy / dist) * maxR;
  }
  if (joystickKnob) joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  joystick.inputX = dx / maxR;
  joystick.inputY = -dy / maxR; // invert: screen-up is forward
}

if (joystickBase) {
  joystickBase.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    joystick.active = true;
    joystick.pointerId = e.pointerId;
    const rect = joystickBase.getBoundingClientRect();
    joystick.centerX = rect.left + rect.width / 2;
    joystick.centerY = rect.top + rect.height / 2;
    joystick.radius = rect.width / 2;
    joystickBase.classList.add('is-active');
    joystickBase.setPointerCapture?.(e.pointerId);
    joystickUpdate(e.clientX, e.clientY);
  });
  joystickBase.addEventListener('pointermove', (e) => {
    if (!joystick.active || e.pointerId !== joystick.pointerId) return;
    joystickUpdate(e.clientX, e.clientY);
  });
  const release = (e) => {
    if (e.pointerId !== joystick.pointerId) return;
    joystickBase.releasePointerCapture?.(e.pointerId);
    resetJoystick();
  };
  joystickBase.addEventListener('pointerup', release);
  joystickBase.addEventListener('pointercancel', release);
  joystickBase.addEventListener('pointerleave', release);
}

function triggerJump() {
  if (!star.airborne) {
    star.verticalVel = STAR_JUMP_VEL;
    star.airborne = true;
  }
}

const jumpBtn = document.querySelector('.jump-btn');
if (jumpBtn) {
  jumpBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    triggerJump();
    jumpBtn.classList.add('is-pressed');
    jumpBtn.setPointerCapture?.(e.pointerId);
  });
  const release = () => jumpBtn.classList.remove('is-pressed');
  jumpBtn.addEventListener('pointerup', release);
  jumpBtn.addEventListener('pointercancel', release);
  jumpBtn.addEventListener('pointerleave', release);
}

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  document.body.classList.toggle('is-locked', pointerLocked);
});

const _mouseUp = new THREE.Vector3();

// Yaw + pitch from any input source (mouse-lock or touch drag).
function applyLookDelta(dx, dy, sens) {
  // Rotate the camera frame, NOT the character. This lets the camera orbit
  // around Star so she can face the camera when the player pulls the stick
  // toward themselves.
  _mouseUp.copy(star.position).normalize();
  camForward.applyAxisAngle(_mouseUp, -dx * sens);
  camForward.projectOnPlane(_mouseUp).normalize();

  camPitch -= dy * sens;
  if (camPitch < CAM_PITCH_MIN) camPitch = CAM_PITCH_MIN;
  if (camPitch > CAM_PITCH_MAX) camPitch = CAM_PITCH_MAX;
}

const TOUCH_LOOK_SENS = 0.004; // a bit hotter than mouse since swipes are bigger

document.addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  applyLookDelta(e.movementX || 0, e.movementY || 0, MOUSE_SENS);
});

// =============================================================================
// Editor mode — sidebar, placement, selection
// =============================================================================

let editMode = false;
let activeTool = null;
let selectedItem = null;
let selectionHelper = null;

const raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _itemLocal = new THREE.Vector3();

function setEditMode(on) {
  editMode = on;
  document.body.classList.toggle('edit-mode', on);
  document.querySelector('.sidebar')?.classList.toggle('is-open', on);
  document.querySelector('.edit-toggle')?.classList.toggle('is-active', on);
  if (on && pointerLocked) document.exitPointerLock?.();
  if (!on) {
    setActiveTool(null);
    setSelectedItem(null);
  }
}

function setActiveTool(toolKey) {
  activeTool = toolKey;
  document.querySelectorAll('.sidebar-item').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.tool === toolKey);
  });
  document.body.classList.toggle('placing', !!toolKey);
  const banner = document.querySelector('.placement-banner');
  if (banner) {
    if (toolKey) {
      banner.textContent = `Click on the planet to place a ${ITEM_TYPES[toolKey].label.toLowerCase()}. Click an existing item to edit it. Esc to cancel.`;
      banner.classList.add('is-visible');
    } else {
      banner.classList.remove('is-visible');
    }
  }
}

const handleMat = new THREE.MeshStandardMaterial({
  color: 0xfff04d,
  emissive: 0xfff04d,
  emissiveIntensity: 0.85,
  roughness: 0.3,
  metalness: 0.15,
});
const handleGeo = new THREE.SphereGeometry(0.03, 10, 8);

function showWaterHandles(item) {
  if (!item.edgePoints) return;
  const handles = new THREE.Group();
  for (let i = 0; i < item.edgePoints.length; i++) {
    const ep = item.edgePoints[i];
    const curveY = waterEdgeCurveY(item, ep.x, ep.z);
    const h = new THREE.Mesh(handleGeo, handleMat);
    h.position.set(ep.x, 0.04 + curveY, ep.z);
    h.userData.isHandle = true;
    h.userData.waterItem = item;
    h.userData.handleIndex = i;
    handles.add(h);
  }
  item.root.add(handles);
  item.handlesGroup = handles;
}

function hideWaterHandles(item) {
  if (item.handlesGroup) {
    item.root.remove(item.handlesGroup);
    // geometry/material are shared; nothing to dispose
    item.handlesGroup = null;
  }
}

function setSelectedItem(item) {
  // Clear handles from previous selection
  if (selectedItem && selectedItem.type === 'water') hideWaterHandles(selectedItem);

  selectedItem = item;
  if (selectionHelper) {
    selectionHelper.parent?.remove(selectionHelper);
    selectionHelper.geometry?.dispose();
    selectionHelper = null;
  }
  const panel = document.querySelector('.action-panel');
  if (item) {
    selectionHelper = new THREE.BoxHelper(item.root, 0xfff04d);
    selectionHelper.material.depthTest = false;
    selectionHelper.material.transparent = true;
    selectionHelper.material.opacity = 0.95;
    item.root.parent.add(selectionHelper);
    if (panel) {
      panel.classList.add('is-visible');
      panel.querySelector('.item-name').textContent = ITEM_TYPES[item.type].label;
    }
    if (item.type === 'water') showWaterHandles(item);
  } else if (panel) {
    panel.classList.remove('is-visible');
  }
}

function updateWaterHandlePositions(item) {
  if (!item.handlesGroup || !item.edgePoints) return;
  const children = item.handlesGroup.children;
  for (let i = 0; i < item.edgePoints.length && i < children.length; i++) {
    const ep = item.edgePoints[i];
    children[i].position.set(ep.x, 0.04 + waterEdgeCurveY(item, ep.x, ep.z), ep.z);
  }
}

function moveWaterEdgePoint(item, idx, x, z) {
  item.edgePoints[idx].x = x;
  item.edgePoints[idx].z = z;
  updateWaterMaxRadius(item);
  if (item.handlesGroup) {
    item.handlesGroup.children[idx]?.position.set(x, 0.04 + waterEdgeCurveY(item, x, z), z);
  }
}

function updateSelectionIndicator() {
  if (selectionHelper && selectedItem) selectionHelper.update();
}

function getMouseNDC(e, out) {
  const rect = canvas.getBoundingClientRect();
  out.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  out.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

let _toastEl = null;
let _toastTimer = null;
function showToast(message) {
  if (!_toastEl) {
    _toastEl = document.createElement('div');
    _toastEl.className = 'toast';
    document.body.appendChild(_toastEl);
  }
  _toastEl.textContent = message;
  _toastEl.classList.add('is-visible');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    _toastEl.classList.remove('is-visible');
  }, 2600);
}

function findWaterContaining(planetLocalPoint) {
  for (const item of placedItems) {
    if (item.type !== 'water' || !item.edgePoints) continue;
    if (pointInWater(item, planetLocalPoint)) return item;
  }
  return null;
}

function pickAtMouse(e) {
  getMouseNDC(e, _ndc);
  raycaster.setFromCamera(_ndc, camera);

  const itemHits = raycaster.intersectObject(itemsGroup, true);
  if (itemHits.length > 0) {
    let n = itemHits[0].object;
    while (n) {
      if (n.userData?.isHandle) return { type: 'handle', handle: n, hit: itemHits[0] };
      if (n.userData?.isPlacedItem) return { type: 'item', item: n.userData.item, hit: itemHits[0] };
      n = n.parent;
    }
  }

  const planetHits = raycaster.intersectObject(planet, false);
  if (planetHits.length > 0) {
    return { type: 'planet', hit: planetHits[0] };
  }
  return null;
}

// Pointer event flow:
// - pointerdown captures intent. If editing and an item is under the cursor,
//   we set selection and start a potential drag. Otherwise we record where
//   the gesture started.
// - pointermove: if dragging, raycast to the planet under the cursor and
//   re-place the item there (yaw preserved, terrain orientation updated).
// - pointerup: if not dragging, this was a click — perform place / deselect /
//   pointer-lock based on edit mode and active tool.
let dragging = null;
let pointerDownInfo = null;
const DRAG_THRESHOLD_SQ = 16; // ~4px movement before it's a drag

function handleCanvasPointerDown(e) {
  if (e.button !== undefined && e.button !== 0) return;

  ensureAudio();

  pointerDownInfo = {
    x: e.clientX,
    y: e.clientY,
    pointerId: e.pointerId,
    pointerType: e.pointerType,
    moved: false,
    itemPicked: null,
    touchLook: false,
  };

  if (editMode) {
    const pick = pickAtMouse(e);
    if (pick) {
      if (pick.type === 'handle') {
        pointerDownInfo.handlePicked = pick.handle;
        dragging = { type: 'handle', handle: pick.handle };
        canvas.setPointerCapture?.(e.pointerId);
      } else if (pick.type === 'item') {
        // Clicking an existing item ALWAYS selects it — even if a placement
        // tool was active. The active tool gets implicitly cancelled so the
        // user can immediately drag handles, resize, etc.
        if (activeTool) setActiveTool(null);
        pointerDownInfo.itemPicked = pick.item;
        setSelectedItem(pick.item);
        dragging = { type: 'item', item: pick.item };
        canvas.setPointerCapture?.(e.pointerId);
      }
    }
    // In edit mode with no item hit, pointerup will deselect / place.
  } else if (e.pointerType !== 'mouse') {
    // Walk mode + touch/pen: drag the screen to look around (pointer-lock
    // is mouse-only, so we use a delta-driven path instead).
    pointerDownInfo.touchLook = true;
    canvas.setPointerCapture?.(e.pointerId);
  }
  // Walk mode + mouse: pointerup will request pointer lock if the click
  // didn't drift far enough to count as a drag.
}

const _hdLocalX = new THREE.Vector3();
const _hdLocalZ = new THREE.Vector3();
const _hdTerrainUp = new THREE.Vector3();
const _hdFromCenter = new THREE.Vector3();

function handleCanvasPointerMove(e) {
  if (!pointerDownInfo) return;

  const dx = e.clientX - pointerDownInfo.x;
  const dy = e.clientY - pointerDownInfo.y;
  if (dx * dx + dy * dy > DRAG_THRESHOLD_SQ) pointerDownInfo.moved = true;

  if (pointerDownInfo.touchLook && e.pointerId === pointerDownInfo.pointerId) {
    const ddx = e.clientX - pointerDownInfo.x;
    const ddy = e.clientY - pointerDownInfo.y;
    pointerDownInfo.x = e.clientX;
    pointerDownInfo.y = e.clientY;
    applyLookDelta(ddx, ddy, TOUCH_LOOK_SENS);
    return;
  }

  if (!dragging) return;

  getMouseNDC(e, _ndc);
  raycaster.setFromCamera(_ndc, camera);
  const hits = raycaster.intersectObject(planet, false);
  if (hits.length === 0) return;

  _itemLocal.copy(hits[0].point);
  planet.worldToLocal(_itemLocal);

  if (dragging.type === 'item') {
    const newDir = _itemLocal.clone().normalize();
    const def = ITEM_TYPES[dragging.item.type];
    if (def.behavior === 'aquatic') {
      const waterItem = findWaterContaining(_itemLocal);
      if (!waterItem) return; // ignore drags outside any pond
      dragging.item.waterItem = waterItem;
    }
    moveItem(dragging.item, newDir, true);
    if (selectionHelper) selectionHelper.update();
  } else if (dragging.type === 'handle') {
    const handle = dragging.handle;
    const waterItem = handle.userData.waterItem;
    const idx = handle.userData.handleIndex;
    computeWaterLocalBasis(waterItem, _hdLocalX, _hdLocalZ, _hdTerrainUp);
    _hdFromCenter.copy(_itemLocal).sub(waterItem.pos).projectOnPlane(_hdTerrainUp);
    const x = _hdFromCenter.dot(_hdLocalX) / waterItem.scale;
    const z = _hdFromCenter.dot(_hdLocalZ) / waterItem.scale;
    moveWaterEdgePoint(waterItem, idx, x, z);
    if (selectionHelper) selectionHelper.update();
  }
}

function handleCanvasPointerUp(e) {
  if (!pointerDownInfo) return;

  if (pointerDownInfo.touchLook) {
    canvas.releasePointerCapture?.(e.pointerId);
    pointerDownInfo = null;
    return;
  }

  if (dragging) {
    dragging = null;
    canvas.releasePointerCapture?.(e.pointerId);
    pointerDownInfo = null;
    return;
  }

  if (!pointerDownInfo.moved) {
    if (editMode) {
      if (activeTool) {
        const pick = pickAtMouse(e);
        if (pick && pick.type === 'planet') {
          _itemLocal.copy(pick.hit.point);
          planet.worldToLocal(_itemLocal);
          const dir = _itemLocal.clone().normalize();
          const def = ITEM_TYPES[activeTool];
          if (def.behavior === 'aquatic') {
            const waterItem = findWaterContaining(_itemLocal);
            if (!waterItem) {
              showToast(`${def.label}s need water — add a pond first!`);
            } else {
              const newItem = addItem(activeTool, dir);
              if (newItem) newItem.waterItem = waterItem;
            }
          } else {
            addItem(activeTool, dir);
          }
        }
      } else if (!pointerDownInfo.itemPicked) {
        // Clicked empty space (planet or background) with no tool — deselect
        setSelectedItem(null);
      }
    } else if (pointerDownInfo.pointerType === 'mouse') {
      if (!pointerLocked) canvas.requestPointerLock?.();
    }
  }

  pointerDownInfo = null;
}

canvas.addEventListener('pointerdown', handleCanvasPointerDown);
canvas.addEventListener('pointermove', handleCanvasPointerMove);
canvas.addEventListener('pointerup', handleCanvasPointerUp);
canvas.addEventListener('pointercancel', handleCanvasPointerUp);

document.querySelector('.edit-toggle')?.addEventListener('click', () => {
  setEditMode(!editMode);
});

document.querySelectorAll('.sidebar-item').forEach((el) => {
  el.addEventListener('click', () => {
    const equip = el.dataset.equip;
    if (equip === 'flashlight') {
      if (equipment.flashlight.equipped) {
        unequipFlashlight();
        el.classList.remove('is-equipped');
      } else {
        equipFlashlight();
        el.classList.add('is-equipped');
      }
      return;
    }
    const tool = el.dataset.tool;
    if (!tool) return;
    setActiveTool(activeTool === tool ? null : tool);
    setSelectedItem(null);
  });
});

document.querySelector('[data-action="bigger"]')?.addEventListener('click', () => {
  if (selectedItem) {
    resizeItem(selectedItem, 1.25);
    if (selectionHelper) selectionHelper.update();
  }
});
document.querySelector('[data-action="smaller"]')?.addEventListener('click', () => {
  if (selectedItem) {
    resizeItem(selectedItem, 1 / 1.25);
    if (selectionHelper) selectionHelper.update();
  }
});
document.querySelector('[data-action="duplicate"]')?.addEventListener('click', () => {
  if (selectedItem) {
    const newItem = duplicateItem(selectedItem);
    if (newItem) setSelectedItem(newItem);
  }
});
document.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
  if (selectedItem) {
    removeItem(selectedItem);
    setSelectedItem(null);
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (activeTool) setActiveTool(null);
    else if (selectedItem) setSelectedItem(null);
  }
});

// =============================================================================
// Camera follow with pitch
// =============================================================================

const _upWorld = new THREE.Vector3();
const _fwdWorld = new THREE.Vector3();
const _rightWorld = new THREE.Vector3();
const _starWorld = new THREE.Vector3();
const _pivot = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _lookDir = new THREE.Vector3();

function updateCamera() {
  planet.updateMatrixWorld();
  starTheFox.getWorldPosition(_starWorld);

  // Re-project camForward onto Star's current tangent plane (the planet
  // surface direction under her position) before transforming to world.
  const _upL = _settleDir.copy(star.position).normalize();
  camForward.projectOnPlane(_upL).normalize();

  _upWorld.copy(star.position).normalize().transformDirection(planet.matrixWorld).normalize();
  _fwdWorld.copy(camForward).transformDirection(planet.matrixWorld).normalize();
  _rightWorld.crossVectors(_upWorld, _fwdWorld).normalize();

  _pivot.copy(_starWorld).addScaledVector(_upWorld, CAM_LOOK_RAISE);

  _offset.set(0, 0, 0)
    .addScaledVector(_fwdWorld, -CAM_BACK)
    .addScaledVector(_upWorld, CAM_HEIGHT - CAM_LOOK_RAISE);
  _offset.applyAxisAngle(_rightWorld, -camPitch);

  camera.position.copy(_pivot).add(_offset);
  camera.up.copy(_upWorld);

  _lookDir.copy(_fwdWorld).applyAxisAngle(_rightWorld, -camPitch);
  camera.lookAt(camera.position.x + _lookDir.x, camera.position.y + _lookDir.y, camera.position.z + _lookDir.z);
}
updateCamera();

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
window.addEventListener('resize', onResize);
onResize();

// =============================================================================
// Animate loop
// =============================================================================

const _up = new THREE.Vector3();
const _moveAxis = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _camFwdTangent = new THREE.Vector3();
const _camRightTangent = new THREE.Vector3();
const _turnAxis = new THREE.Vector3();
const _intendedPos = new THREE.Vector3();
const _intendedDir = new THREE.Vector3();
const clock = new THREE.Clock();

const RETICLE_PHASE_TWO = Math.PI;

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // Combine joystick + keyboard into a single 2D input vector in camera frame.
  // x = strafe (left/right), y = forward/back.
  let inputX = joystick.inputX;
  let inputY = joystick.inputY;
  if (input.fwd)   inputY += 1;
  if (input.back)  inputY -= 1;
  if (input.right) inputX += 1;
  if (input.left)  inputX -= 1;
  const inputMagRaw = Math.sqrt(inputX * inputX + inputY * inputY);
  if (inputMagRaw > 1) {
    inputX /= inputMagRaw;
    inputY /= inputMagRaw;
  }
  const inputMag = Math.min(1, inputMagRaw);

  _up.copy(star.position).normalize();

  // Camera-tangent frame at Star's position
  _camFwdTangent.copy(camForward).projectOnPlane(_up).normalize();
  _camRightTangent.crossVectors(_up, _camFwdTangent).normalize();

  if (inputMag > 0.05) {
    // moveDir = camFwd * inputY + camRight * inputX (relative to camera frame)
    _moveDir.set(0, 0, 0)
      .addScaledVector(_camFwdTangent, inputY)
      .addScaledVector(_camRightTangent, inputX)
      .normalize();

    // Star wants to face the direction she's moving (Roblox-style)
    star.targetForward.copy(_moveDir);

    _moveAxis.crossVectors(_up, _moveDir).normalize();
    const angle = WALK_SPEED * dt * inputMag;

    _intendedPos.copy(star.position).applyAxisAngle(_moveAxis, angle);
    _intendedDir.copy(_intendedPos).normalize();
    _intendedPos.setLength(surfaceHeightAt(_intendedDir));

    resolveCollisions(_intendedPos);

    star.position.copy(_intendedPos);
  }

  // Smoothly rotate star.forward toward star.targetForward (capped per frame).
  star.forward.projectOnPlane(_up).normalize();
  star.targetForward.projectOnPlane(_up).normalize();
  const cosAng = Math.max(-1, Math.min(1, star.forward.dot(star.targetForward)));
  const ang = Math.acos(cosAng);
  if (ang > 0.001) {
    const stepFrac = Math.min(1, (STAR_TURN_RATE * dt) / ang);
    const stepAngle = stepFrac * ang;
    _turnAxis.crossVectors(star.forward, star.targetForward);
    if (_turnAxis.lengthSq() < 1e-6) {
      _turnAxis.copy(_up); // 180° flip — pick local up as the axis
    } else {
      _turnAxis.normalize();
    }
    star.forward.applyAxisAngle(_turnAxis, stepAngle);
    star.forward.projectOnPlane(_up).normalize();
  }

  // Water current (gentle drift while inside any pond)
  applyWaterPush(dt);

  // Glue Star to the surface (sinking into water if she's standing on it)
  settleStarOnSurface(star.position);

  // Jump physics — integrated radial velocity, gravity pulls back to ground
  if (star.airborne) {
    star.airHeight += star.verticalVel * dt;
    star.verticalVel -= STAR_GRAVITY * dt;
    if (star.airHeight <= 0) {
      star.airHeight = 0;
      star.verticalVel = 0;
      star.airborne = false;
    }
  }

  // -------- Fox animation --------
  const fx = starTheFox.userData;
  const moving = inputMag > 0.05;
  const walkAmt = moving ? inputMag : 0;

  // Right arm has a "holding" pose when something's equipped — pose is added
  // on top of the walk swing so the equipped item stays oriented forward.
  const holdingItem = equipment.flashlight.equipped;
  const armHoldR = holdingItem ? -1.15 : 0; // raise forward when holding
  const armHoldL = 0;

  if (star.inWater) {
    // Bipedal swim: arms paddle forward + back, legs kick alternately.
    star.walkPhase += dt * 6;
    const swim = Math.sin(star.walkPhase);
    // Front limbs (arms) paddle, anti-phase
    fx.arms.l.rotation.x = -1.0 + swim * 0.5;
    fx.arms.r.rotation.x = (holdingItem ? armHoldR : -1.0) - swim * 0.5;
    // Legs kick, opposite phase
    fx.legs.l.rotation.x = 0.55 - swim * 0.4;
    fx.legs.r.rotation.x = 0.55 + swim * 0.4;
    fx.tailRoot.rotation.y = Math.sin(star.walkPhase * 0.6) * 0.4;
    fx.bodyGroup.rotation.z = 0;
    fx.bodyGroup.position.y = 0.05;
    fx.bodyGroup.scale.set(1, 1, 1);
  } else {
    if (moving) {
      star.walkPhase += dt * WALK_CYCLE_FREQ * Math.PI * 2;
    }
    const swing = Math.sin(star.walkPhase) * 0.55 * walkAmt;

    // Two-legged walk: legs alternate; arms counter-swing for natural gait.
    fx.legs.l.rotation.x = swing;
    fx.legs.r.rotation.x = -swing;
    fx.arms.l.rotation.x = armHoldL + (-swing) * 0.7;
    // Right arm sways less when holding so the item doesn't whip around
    fx.arms.r.rotation.x = armHoldR + swing * (holdingItem ? 0.18 : 0.7);

    // Body sway: roll side to side, twice per stride
    fx.bodyGroup.rotation.z = Math.sin(star.walkPhase * 2) * 0.045 * walkAmt;
    // Subtle vertical bob
    fx.bodyGroup.position.y = 0.05 + Math.sin(star.walkPhase * 2 + RETICLE_PHASE_TWO) * 0.008 * walkAmt;

    // Tail: swish when walking, gentle drift when idle
    fx.tailRoot.rotation.y = moving
      ? Math.sin(star.walkPhase) * 0.5
      : Math.sin(t * 1.2) * 0.08;

    // Idle breathing: gentle scale-Y oscillation, only when not walking
    if (moving) {
      fx.bodyGroup.scale.set(1, 1, 1);
    } else {
      const breath = 1 + Math.sin(t * IDLE_BREATH_FREQ * Math.PI * 2) * 0.03;
      fx.bodyGroup.scale.set(1, breath, 1);
    }
  }

  updateCreatures(dt);
  animateWater(t);
  updateDayNight(t);

  applyStarTransform();
  updateCamera();
  updateSpeechBubbles();
  updateSelectionIndicator();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
