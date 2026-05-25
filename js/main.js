import * as THREE from 'three';

const canvas = document.getElementById('game-canvas');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0.6, 4.5);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);

const ambient = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff1d6, 1.1);
sun.position.set(4, 5, 3);
scene.add(sun);

const rimLight = new THREE.DirectionalLight(0x88a0ff, 0.25);
rimLight.position.set(-4, -2, -3);
scene.add(rimLight);

const planetGeometry = new THREE.SphereGeometry(1.2, 48, 48);
const planetMaterial = new THREE.MeshStandardMaterial({
  color: 0x8a7a4a,
  roughness: 0.85,
  metalness: 0.05,
  flatShading: false,
});
const planet = new THREE.Mesh(planetGeometry, planetMaterial);
scene.add(planet);

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
  planet.rotation.y += delta * 0.25;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
