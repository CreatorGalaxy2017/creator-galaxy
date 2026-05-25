import * as THREE from 'three';

// =============================================================================
// World & feel constants
// =============================================================================

const PLANET_RADIUS = 80;
const PLANET_AMPLITUDE = 13;
const SURFACE_OFFSET = 0.05;
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

function createStarTheFox() {
  const fox = new THREE.Group();

  const FUR_ORANGE = 0xe8732c;
  const FUR_WHITE = 0xfaf2e6;
  const SUIT_WHITE = 0xdce4f0;
  const SUIT_ACCENT = 0xff9a3c;
  const LEG_ORANGE = 0xd66520;
  const EYE_BLACK = 0x121212;
  const HELMET_TINT = 0xaaccff;

  const furOrange = new THREE.MeshStandardMaterial({ color: FUR_ORANGE, flatShading: true, roughness: 0.85 });
  const furWhite = new THREE.MeshStandardMaterial({ color: FUR_WHITE, flatShading: true, roughness: 0.85 });
  const suit = new THREE.MeshStandardMaterial({ color: SUIT_WHITE, flatShading: true, roughness: 0.65 });
  const legMat = new THREE.MeshStandardMaterial({ color: LEG_ORANGE, flatShading: true, roughness: 0.85 });

  // Legs attach to fox root so they're not affected by body sway / breathing
  const legGeo = new THREE.CylinderGeometry(0.022, 0.016, 0.075, 6);
  legGeo.translate(0, -0.0375, 0);

  const HIP_Y = 0.085;
  const HIP_X = 0.045;
  const HIP_Z_FRONT = 0.05;
  const HIP_Z_BACK = -0.05;

  const legFL = new THREE.Mesh(legGeo, legMat);
  legFL.position.set(-HIP_X, HIP_Y, HIP_Z_FRONT);
  const legFR = new THREE.Mesh(legGeo, legMat);
  legFR.position.set(HIP_X, HIP_Y, HIP_Z_FRONT);
  const legBL = new THREE.Mesh(legGeo, legMat);
  legBL.position.set(-HIP_X, HIP_Y, HIP_Z_BACK);
  const legBR = new THREE.Mesh(legGeo, legMat);
  legBR.position.set(HIP_X, HIP_Y, HIP_Z_BACK);
  fox.add(legFL, legFR, legBL, legBR);

  // Everything above the legs lives in bodyGroup, which we sway & breathe
  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 0.05;
  fox.add(bodyGroup);

  const bodyGeo = new THREE.SphereGeometry(0.09, 12, 10);
  bodyGeo.scale(1, 1.25, 0.85);
  const body = new THREE.Mesh(bodyGeo, suit);
  body.position.y = 0.11;
  bodyGroup.add(body);

  const chest = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.04, 0.02),
    new THREE.MeshStandardMaterial({ color: SUIT_ACCENT, flatShading: true })
  );
  chest.position.set(0, 0.13, 0.075);
  bodyGroup.add(chest);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 1), furOrange);
  head.position.y = 0.255;
  bodyGroup.add(head);

  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 6), furWhite);
  snout.position.set(0, 0.24, 0.085);
  snout.rotation.x = Math.PI / 2;
  bodyGroup.add(snout);

  const noseTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 8, 6),
    new THREE.MeshStandardMaterial({ color: EYE_BLACK })
  );
  noseTip.position.set(0, 0.24, 0.125);
  bodyGroup.add(noseTip);

  const earGeo = new THREE.ConeGeometry(0.032, 0.07, 4);
  const earL = new THREE.Mesh(earGeo, furOrange);
  const earR = new THREE.Mesh(earGeo, furOrange);
  earL.position.set(-0.055, 0.335, -0.01);
  earR.position.set(0.055, 0.335, -0.01);
  earL.rotation.z = 0.22;
  earR.rotation.z = -0.22;
  bodyGroup.add(earL, earR);

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
  starMark.position.set(0.04, 0.27, 0.078);
  starMark.lookAt(0.04, 0.27, 1);
  bodyGroup.add(starMark);

  const eyeMat = new THREE.MeshStandardMaterial({ color: EYE_BLACK });
  const eyeGeo = new THREE.SphereGeometry(0.012, 8, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.04, 0.27, 0.082);
  eyeR.position.set(0.04, 0.27, 0.088);
  bodyGroup.add(eyeL, eyeR);

  // Tail rig: tailRoot does the swish (rotation.y); tailTilt holds the up-and-back tilt
  const tailRoot = new THREE.Group();
  tailRoot.position.set(0, 0.13, -0.09);
  bodyGroup.add(tailRoot);

  const tailTilt = new THREE.Group();
  tailTilt.rotation.x = -0.55;
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

  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.1, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xc8d2e0, flatShading: true })
  );
  backpack.position.set(0, 0.13, -0.08);
  bodyGroup.add(backpack);

  const helmet = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.125, 2),
    new THREE.MeshStandardMaterial({
      color: HELMET_TINT,
      transparent: true,
      opacity: 0.22,
      roughness: 0.1,
      metalness: 0.4,
    })
  );
  helmet.position.y = 0.265;
  helmet.renderOrder = 1;
  bodyGroup.add(helmet);

  fox.userData = {
    bodyGroup,
    legs: { fl: legFL, fr: legFR, bl: legBL, br: legBR },
    tailRoot,
  };
  return fox;
}

const starTheFox = createStarTheFox();
planet.add(starTheFox);

// =============================================================================
// Star state on planet
// =============================================================================

const star = {
  position: new THREE.Vector3(0, SURFACE_MAX_R, 0),
  forward: new THREE.Vector3(0, 0, 1),
  walkPhase: 0,
};

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
  starTheFox.position.copy(star.position);
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

const rockMat = new THREE.MeshStandardMaterial({
  color: 0x807a72, flatShading: true, roughness: 0.95,
});
const bushMat = new THREE.MeshStandardMaterial({
  color: 0x4a8035, flatShading: true, roughness: 0.85,
});
const mushroomCapMat = new THREE.MeshStandardMaterial({
  color: 0xc0392b, flatShading: true, roughness: 0.7,
});
const mushroomSpotMat = new THREE.MeshStandardMaterial({
  color: 0xfaf2e6, flatShading: true, roughness: 0.7,
});
const mushroomStemMat = new THREE.MeshStandardMaterial({
  color: 0xf2e3c4, flatShading: true, roughness: 0.8,
});

function jitterIco(geo, amount = 0.25) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.multiplyScalar(1 - amount * 0.5 + Math.random() * amount);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function createTreeItem() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(trunkGeo, trunkMat));
  g.add(new THREE.Mesh(canopyLowerGeo, canopyMat));
  g.add(new THREE.Mesh(canopyUpperGeo, canopyMat));
  return g;
}

function createRockItem() {
  const geo = jitterIco(new THREE.IcosahedronGeometry(0.07, 0).toNonIndexed(), 0.45);
  // Sit half-buried by translating up only slightly
  geo.translate(0, 0.04, 0);
  const rock = new THREE.Mesh(geo, rockMat);
  rock.rotation.y = Math.random() * Math.PI * 2;
  return rock;
}

function createBushItem() {
  const g = new THREE.Group();
  const main = new THREE.Mesh(
    jitterIco(new THREE.IcosahedronGeometry(0.07, 1).toNonIndexed(), 0.3),
    bushMat
  );
  main.position.y = 0.06;
  g.add(main);
  // A small secondary lump
  const lump = new THREE.Mesh(
    jitterIco(new THREE.IcosahedronGeometry(0.045, 1).toNonIndexed(), 0.3),
    bushMat
  );
  lump.position.set(0.05, 0.04, 0.02);
  g.add(lump);
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

const ITEM_TYPES = {
  tree:     { label: 'Tree',     build: createTreeItem,     defaultScale: 6,   collisionR: 0.15 },
  rock:     { label: 'Rock',     build: createRockItem,     defaultScale: 4,   collisionR: 0.18 },
  bush:     { label: 'Bush',     build: createBushItem,     defaultScale: 3,   collisionR: 0.14 },
  mushroom: { label: 'Mushroom', build: createMushroomItem, defaultScale: 2.5, collisionR: 0.06 },
};

// =============================================================================
// Placed items registry — anything the editor drops into the world
// =============================================================================

const placedItems = []; // { type, root, scale, dir, pos }
const itemsGroup = new THREE.Group();
planet.add(itemsGroup);

function orientItemOnSurface(root, dir) {
  const surfaceR = surfaceHeightAt(dir);
  const pos = dir.clone().multiplyScalar(surfaceR);

  const terrainUp = new THREE.Vector3();
  computeTerrainNormal(dir, terrainUp);

  const ref = Math.abs(terrainUp.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const fwd = new THREE.Vector3().crossVectors(terrainUp, ref).normalize();
  fwd.applyAxisAngle(terrainUp, Math.random() * Math.PI * 2);
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
  const pos = orientItemOnSurface(root, dir);
  itemsGroup.add(root);

  const item = { type, root, scale, dir: dir.clone(), pos: pos.clone() };
  root.userData.item = item;
  placedItems.push(item);
  return item;
}

function removeItem(item) {
  const idx = placedItems.indexOf(item);
  if (idx === -1) return;
  placedItems.splice(idx, 1);
  itemsGroup.remove(item.root);
  item.root.traverse((obj) => {
    if (obj.geometry && obj.geometry !== trunkGeo && obj.geometry !== canopyLowerGeo &&
        obj.geometry !== canopyUpperGeo) {
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
  }
  return newItem;
}

function resizeItem(item, factor) {
  item.scale = Math.max(0.5, Math.min(20, item.scale * factor));
  item.root.scale.setScalar(item.scale);
}

function resolveCollisions(targetPos) {
  for (const item of placedItems) {
    const dx = targetPos.x - item.pos.x;
    const dy = targetPos.y - item.pos.y;
    const dz = targetPos.z - item.pos.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq > 9) continue;
    const def = ITEM_TYPES[item.type];
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

document.querySelectorAll('.ctrl').forEach((btn) => {
  const action = btn.dataset.action;
  const press = (e) => {
    e.preventDefault();
    input[action] = true;
    btn.classList.add('is-pressed');
    btn.setPointerCapture?.(e.pointerId);
  };
  const release = () => {
    input[action] = false;
    btn.classList.remove('is-pressed');
  };
  btn.addEventListener('pointerdown', press);
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('pointerleave', release);
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  document.body.classList.toggle('is-locked', pointerLocked);
});

const _mouseUp = new THREE.Vector3();
document.addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  const dx = e.movementX || 0;
  const dy = e.movementY || 0;

  // Mouse-X turns Star (and the camera follows because it derives from Star.forward)
  _mouseUp.copy(star.position).normalize();
  star.forward.applyAxisAngle(_mouseUp, -dx * MOUSE_SENS);
  star.forward.projectOnPlane(_mouseUp).normalize();

  // Mouse-Y tilts the camera only
  camPitch -= dy * MOUSE_SENS;
  if (camPitch < CAM_PITCH_MIN) camPitch = CAM_PITCH_MIN;
  if (camPitch > CAM_PITCH_MAX) camPitch = CAM_PITCH_MAX;
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
      banner.textContent = `Click on the planet to place a ${ITEM_TYPES[toolKey].label.toLowerCase()}. Esc to cancel.`;
      banner.classList.add('is-visible');
    } else {
      banner.classList.remove('is-visible');
    }
  }
}

function setSelectedItem(item) {
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
  } else if (panel) {
    panel.classList.remove('is-visible');
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

function pickAtMouse(e) {
  getMouseNDC(e, _ndc);
  raycaster.setFromCamera(_ndc, camera);

  const itemHits = raycaster.intersectObject(itemsGroup, true);
  if (itemHits.length > 0) {
    let n = itemHits[0].object;
    while (n && !n.userData?.isPlacedItem) n = n.parent;
    if (n) return { type: 'item', item: n.userData.item, hit: itemHits[0] };
  }

  const planetHits = raycaster.intersectObject(planet, false);
  if (planetHits.length > 0) {
    return { type: 'planet', hit: planetHits[0] };
  }
  return null;
}

function handleCanvasClick(e) {
  if (e.button !== undefined && e.button !== 0) return;

  if (editMode) {
    const pick = pickAtMouse(e);
    if (!pick) {
      setSelectedItem(null);
      return;
    }
    if (activeTool) {
      if (pick.type === 'planet') {
        _itemLocal.copy(pick.hit.point);
        planet.worldToLocal(_itemLocal);
        const dir = _itemLocal.clone().normalize();
        addItem(activeTool, dir);
      }
    } else {
      if (pick.type === 'item') setSelectedItem(pick.item);
      else setSelectedItem(null);
    }
  } else {
    if (!pointerLocked) canvas.requestPointerLock?.();
  }
}

canvas.addEventListener('click', handleCanvasClick);

document.querySelector('.edit-toggle')?.addEventListener('click', () => {
  setEditMode(!editMode);
});

document.querySelectorAll('.sidebar-item').forEach((el) => {
  el.addEventListener('click', () => {
    const tool = el.dataset.tool;
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

  _upWorld.copy(star.position).normalize().transformDirection(planet.matrixWorld).normalize();
  _fwdWorld.copy(star.forward).transformDirection(planet.matrixWorld).normalize();
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
const _intendedPos = new THREE.Vector3();
const _intendedDir = new THREE.Vector3();
const clock = new THREE.Clock();

const RETICLE_PHASE_TWO = Math.PI;

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  const turn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const move = (input.fwd ? 1 : 0) - (input.back ? 1 : 0);

  _up.copy(star.position).normalize();

  if (turn !== 0) {
    star.forward.applyAxisAngle(_up, turn * TURN_SPEED * dt);
  }
  star.forward.projectOnPlane(_up).normalize();

  if (move !== 0) {
    _moveAxis.crossVectors(star.forward, _up).normalize();
    const angle = move * WALK_SPEED * dt;

    _intendedPos.copy(star.position).applyAxisAngle(_moveAxis, angle);
    _intendedDir.copy(_intendedPos).normalize();
    _intendedPos.setLength(surfaceHeightAt(_intendedDir));

    resolveCollisions(_intendedPos);
    _intendedDir.copy(_intendedPos).normalize();
    _intendedPos.setLength(surfaceHeightAt(_intendedDir));

    star.position.copy(_intendedPos);
    star.forward.applyAxisAngle(_moveAxis, angle);
  } else {
    // Keep Star glued to surface even when idle (if terrain noise is sampled differently)
    const dir = star.position.clone().normalize();
    star.position.setLength(surfaceHeightAt(dir));
  }

  // -------- Fox animation --------
  const fx = starTheFox.userData;
  const moving = move !== 0;
  const walkAmt = moving ? 1 : 0;

  if (moving) {
    star.walkPhase += dt * WALK_CYCLE_FREQ * Math.PI * 2;
  }

  const swing = Math.sin(star.walkPhase) * 0.55 * walkAmt;
  fx.legs.fl.rotation.x = swing;
  fx.legs.br.rotation.x = swing;
  fx.legs.fr.rotation.x = -swing;
  fx.legs.bl.rotation.x = -swing;

  // Body sway: roll side to side, twice per stride
  fx.bodyGroup.rotation.z = Math.sin(star.walkPhase * 2) * 0.045 * walkAmt;
  // Subtle vertical bob via slight body Y nudge
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

  applyStarTransform();
  updateCamera();
  updateSelectionIndicator();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
