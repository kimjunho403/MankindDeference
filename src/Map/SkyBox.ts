import * as THREE from 'three';

// Matches DirectionalLight sun position in MapBuilder
const SUN_DIR      = new THREE.Vector3(6, 12, 8).normalize();
const TOP_COLOR    = new THREE.Color(0x2a6bbf);
const HORIZON_COLOR = new THREE.Color(0x9dc8e8);
const DOME_RADIUS  = 400;

export function addSkyBox(scene: THREE.Scene): void {
  scene.background = HORIZON_COLOR;
  scene.add(createDome());
  scene.add(createSun());
}

function createDome(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(DOME_RADIUS, 32, 16);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i) / DOME_RADIUS); // 0=horizon, 1=zenith
    const c = HORIZON_COLOR.clone().lerp(TOP_COLOR, t * t);
    colors[i * 3]     = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  return new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }),
  );
}

function createSun(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(10, 16, 8),
    new THREE.MeshBasicMaterial({ color: 0xfffde0 }),
  );
  mesh.position.copy(SUN_DIR).multiplyScalar(DOME_RADIUS * 0.88);
  return mesh;
}
