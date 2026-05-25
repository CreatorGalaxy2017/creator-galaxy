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
starTheFox.position.set(0, PLANET_RADIUS + PLANET_AMPLITUDE + 0.02, 0);
planet.add(starTheFox);

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
window.addEventListener('resize', onResize);
onResize();

const clock = new THREE.Clock();
function animate() {
  const delta = clock.getDelta();
  planet.rotation.y += delta * 0.2;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
