import * as THREE from 'three';

const canvas = document.getElementById('game-canvas');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0.5, 4.2);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);

const ambient = new THREE.AmbientLight(0xb8c8ff, 0.55);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff1d6, 1.2);
sun.position.set(4, 5, 3);
scene.add(sun);

const rimLight = new THREE.DirectionalLight(0x88a0ff, 0.35);
rimLight.position.set(-4, -2, -3);
scene.add(rimLight);

function noise3D(x, y, z) {
  return (
    Math.sin(x * 1.7 + y * 0.3 + z * 2.1) * 0.5 +
    Math.sin(x * 3.1 - y * 2.3 + z * 0.5) * 0.25 +
    Math.sin(x * 5.9 + y * 4.1 - z * 1.7) * 0.125
  );
}

function buildMountainPlanet({ radius = 1.2, detail = 4, amplitude = 0.2 } = {}) {
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

const PLANET_RADIUS = 1.2;
const PLANET_AMPLITUDE = 0.2;
const planet = buildMountainPlanet({ radius: PLANET_RADIUS, detail: 4, amplitude: PLANET_AMPLITUDE });
planet.rotation.x = 0.35;
scene.add(planet);

function createStarTheFox() {
  const fox = new THREE.Group();

  const FUR_ORANGE = 0xe8732c;
  const FUR_WHITE = 0xfaf2e6;
  const SUIT_WHITE = 0xdce4f0;
  const SUIT_ACCENT = 0xff9a3c;
  const EYE_BLACK = 0x121212;
  const HELMET_TINT = 0xaaccff;

  const furOrange = new THREE.MeshStandardMaterial({ color: FUR_ORANGE, flatShading: true, roughness: 0.85 });
  const furWhite = new THREE.MeshStandardMaterial({ color: FUR_WHITE, flatShading: true, roughness: 0.85 });
  const suit = new THREE.MeshStandardMaterial({ color: SUIT_WHITE, flatShading: true, roughness: 0.65 });

  const bodyGeo = new THREE.SphereGeometry(0.09, 12, 10);
  bodyGeo.scale(1, 1.25, 0.85);
  const body = new THREE.Mesh(bodyGeo, suit);
  body.position.y = 0.11;
  fox.add(body);

  const chest = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.04, 0.02),
    new THREE.MeshStandardMaterial({ color: SUIT_ACCENT, flatShading: true })
  );
  chest.position.set(0, 0.13, 0.075);
  fox.add(chest);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 1), furOrange);
  head.position.y = 0.255;
  fox.add(head);

  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 6), furWhite);
  snout.position.set(0, 0.24, 0.085);
  snout.rotation.x = Math.PI / 2;
  fox.add(snout);

  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6),
    new THREE.MeshStandardMaterial({ color: EYE_BLACK }));
  noseTip.position.set(0, 0.24, 0.125);
  fox.add(noseTip);

  const earGeo = new THREE.ConeGeometry(0.032, 0.07, 4);
  const earL = new THREE.Mesh(earGeo, furOrange);
  const earR = new THREE.Mesh(earGeo, furOrange);
  earL.position.set(-0.055, 0.335, -0.01);
  earR.position.set(0.055, 0.335, -0.01);
  earL.rotation.z = 0.22;
  earR.rotation.z = -0.22;
  fox.add(earL, earR);

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
  fox.add(starMark);

  const eyeMat = new THREE.MeshStandardMaterial({ color: EYE_BLACK });
  const eyeGeo = new THREE.SphereGeometry(0.012, 8, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.04, 0.27, 0.082);
  eyeR.position.set(0.04, 0.27, 0.088);
  fox.add(eyeL, eyeR);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 6), furOrange);
  tail.position.set(0, 0.12, -0.105);
  tail.rotation.x = -0.55;
  fox.add(tail);

  const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), furWhite);
  tailTip.position.set(0, 0.04, -0.17);
  fox.add(tailTip);

  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.1, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xc8d2e0, flatShading: true })
  );
  backpack.position.set(0, 0.13, -0.08);
  fox.add(backpack);

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
  fox.add(helmet);

  return fox;
}

const starTheFox = createStarTheFox();
planet.add(starTheFox);

function scatterTrees(count = 80) {
  const trunkGeo = new THREE.CylinderGeometry(0.013, 0.018, 0.08, 5);
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

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const canopyLower = new THREE.InstancedMesh(canopyLowerGeo, canopyMat, count);
  const canopyUpper = new THREE.InstancedMesh(canopyUpperGeo, canopyMat, count);

  const matrix = new THREE.Matrix4();
  const scaleMat = new THREE.Matrix4();
  const dir = new THREE.Vector3();
  const up = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const ref = new THREE.Vector3();

  let placed = 0;
  const MAX_ATTEMPTS = count * 14;

  for (let attempt = 0; attempt < MAX_ATTEMPTS && placed < count; attempt++) {
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const sinPhi = Math.sqrt(Math.max(0, 1 - u * u));
    dir.set(sinPhi * Math.cos(theta), u, sinPhi * Math.sin(theta));

    if (dir.y > 0.92) continue;

    const h = noise3D(dir.x * 2.4, dir.y * 2.4, dir.z * 2.4);
    if (h < -0.05 || h > 0.28) continue;

    const r = PLANET_RADIUS + h * PLANET_AMPLITUDE;

    up.copy(dir);
    ref.set(0, 1, 0);
    if (Math.abs(up.y) > 0.95) ref.set(1, 0, 0);
    fwd.crossVectors(up, ref).normalize().applyAxisAngle(up, Math.random() * Math.PI * 2);
    right.crossVectors(up, fwd).normalize();

    matrix.makeBasis(right, up, fwd);
    matrix.setPosition(dir.x * r, dir.y * r, dir.z * r);

    const s = 0.7 + Math.random() * 0.8;
    scaleMat.makeScale(s, s, s);
    matrix.multiply(scaleMat);

    trunks.setMatrixAt(placed, matrix);
    canopyLower.setMatrixAt(placed, matrix);
    canopyUpper.setMatrixAt(placed, matrix);
    placed++;
  }

  trunks.count = placed;
  canopyLower.count = placed;
  canopyUpper.count = placed;
  trunks.instanceMatrix.needsUpdate = true;
  canopyLower.instanceMatrix.needsUpdate = true;
  canopyUpper.instanceMatrix.needsUpdate = true;

  const group = new THREE.Group();
  group.add(trunks, canopyLower, canopyUpper);
  return group;
}

planet.add(scatterTrees(85));

const SURFACE_RADIUS = PLANET_RADIUS + PLANET_AMPLITUDE + 0.02;

const star = {
  position: new THREE.Vector3(0, SURFACE_RADIUS, 0),
  forward: new THREE.Vector3(0, 0, 1),
  walkSpeed: 0.75,
  turnSpeed: 1.9,
  walkPhase: 0,
};

const _right = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _bobAxis = new THREE.Vector3();

function applyStarTransform(bob = 0) {
  const up = star.position.clone().normalize();
  star.forward.projectOnPlane(up).normalize();
  _right.crossVectors(up, star.forward).normalize();
  _basis.makeBasis(_right, up, star.forward);
  starTheFox.quaternion.setFromRotationMatrix(_basis);

  _bobAxis.copy(up).multiplyScalar(bob);
  starTheFox.position.copy(star.position).add(_bobAxis);
}
applyStarTransform();

function buildStarfield(count = 900, innerR = 40, outerR = 70) {
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
    size: 0.25,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}
scene.add(buildStarfield());

const input = { fwd: false, back: false, left: false, right: false };

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

const _upWorld = new THREE.Vector3();
const _fwdWorld = new THREE.Vector3();
const _starWorld = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

const CAM_HEIGHT = 0.55;
const CAM_BACK = 1.05;
const CAM_LOOK_RAISE = 0.18;

function updateCamera() {
  planet.updateMatrixWorld();
  starTheFox.getWorldPosition(_starWorld);

  _upWorld.copy(star.position).normalize().transformDirection(planet.matrixWorld).normalize();
  _fwdWorld.copy(star.forward).transformDirection(planet.matrixWorld).normalize();

  _camDesired.copy(_starWorld)
    .addScaledVector(_upWorld, CAM_HEIGHT)
    .addScaledVector(_fwdWorld, -CAM_BACK);

  camera.position.copy(_camDesired);
  camera.up.copy(_upWorld);

  _lookTarget.copy(_starWorld).addScaledVector(_upWorld, CAM_LOOK_RAISE);
  camera.lookAt(_lookTarget);
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

const _up = new THREE.Vector3();
const _moveAxis = new THREE.Vector3();
const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);

  const turn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const move = (input.fwd ? 1 : 0) - (input.back ? 1 : 0);

  _up.copy(star.position).normalize();

  if (turn !== 0) {
    star.forward.applyAxisAngle(_up, turn * star.turnSpeed * dt);
  }
  star.forward.projectOnPlane(_up).normalize();

  if (move !== 0) {
    _moveAxis.crossVectors(star.forward, _up).normalize();
    const angle = move * star.walkSpeed * dt;
    star.position.applyAxisAngle(_moveAxis, angle).setLength(SURFACE_RADIUS);
    star.forward.applyAxisAngle(_moveAxis, angle);
  }

  let bob = 0;
  if (move !== 0) {
    star.walkPhase += dt * 9;
    bob = Math.sin(star.walkPhase) * 0.012;
  } else {
    star.walkPhase = 0;
  }

  applyStarTransform(bob);
  updateCamera();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
