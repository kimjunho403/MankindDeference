import * as THREE from 'three';
import { TRACK_RADIUS } from '../systems/TrackSystem';

/** Build all static scene geometry and lighting. */
export function buildScene(scene: THREE.Scene): void {
  addLights(scene);
  addGround(scene);
  addTrack(scene);
  addDirectionArrows(scene);
  addSpawnMarker(scene);
}

// ── Lights ────────────────────────────────────────────────────────────────────

function addLights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xddeeff, 0x553322, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(6, 12, 8);
  scene.add(sun);
}

// ── Ground ────────────────────────────────────────────────────────────────────

function addGround(scene: THREE.Scene): void {
  const outerGround = new THREE.Mesh(
    new THREE.CircleGeometry(18, 64),
    new THREE.MeshBasicMaterial({ color: 0x1a2a12 }),
  );
  outerGround.rotation.x = -Math.PI / 2;
  scene.add(outerGround);

  const innerZone = new THREE.Mesh(
    new THREE.CircleGeometry(TRACK_RADIUS - 0.5, 64),
    new THREE.MeshBasicMaterial({ color: 0x1e3517 }),
  );
  innerZone.rotation.x = -Math.PI / 2;
  innerZone.position.y = 0.005;
  scene.add(innerZone);
}

// ── Track ─────────────────────────────────────────────────────────────────────

function addTrack(scene: THREE.Scene): void {
  const track = new THREE.Mesh(
    new THREE.RingGeometry(TRACK_RADIUS - 0.5, TRACK_RADIUS + 0.5, 64),
    new THREE.MeshBasicMaterial({ color: 0x7a5a18, side: THREE.DoubleSide }),
  );
  track.rotation.x = -Math.PI / 2;
  track.position.y = 0.01;
  scene.add(track);
}

// ── Direction arrows ──────────────────────────────────────────────────────────

function addDirectionArrows(scene: THREE.Scene): void {
  const COUNT = 8;
  for (let i = 0; i < COUNT; i++) {
    const angle = (i / COUNT) * Math.PI * 2;
    const arrow = new THREE.Mesh(
      new THREE.CircleGeometry(0.15, 3),
      new THREE.MeshBasicMaterial({ color: 0xffcc44, side: THREE.DoubleSide }),
    );
    arrow.rotation.x = -Math.PI / 2;
    arrow.rotation.z = -angle - Math.PI / 2;
    arrow.position.set(
      TRACK_RADIUS * Math.cos(angle), 0.02,
      TRACK_RADIUS * Math.sin(angle),
    );
    scene.add(arrow);
  }
}

// ── Spawn marker ──────────────────────────────────────────────────────────────

function addSpawnMarker(scene: THREE.Scene): void {
  const spawnMarker = new THREE.Mesh(
    new THREE.CircleGeometry(0.35, 20),
    new THREE.MeshBasicMaterial({ color: 0xff6600 }),
  );
  spawnMarker.rotation.x = -Math.PI / 2;
  spawnMarker.position.set(TRACK_RADIUS, 0.02, 0);
  scene.add(spawnMarker);
}
