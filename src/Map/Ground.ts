import * as THREE from 'three';
import { TRACK_RADIUS } from '../systems/TrackSystem';
import { seededRng } from './mapUtils';

export function addGround(scene: THREE.Scene): void {
  addBaseLayers(scene);
  addGrassPatches(scene);
  addRocks(scene);
  addShadowOverlay(scene);
}

function addBaseLayers(scene: THREE.Scene): void {
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

function addGrassPatches(scene: THREE.Scene): void {
  const rng = seededRng(7);
  const colors = [0x243318, 0x162510, 0x1b3014, 0x283c1a, 0x132210];

  const place = (r: number, maxR: number, count: number): void => {
    for (let i = 0; i < count; i++) {
      const radius = r + rng() * maxR;
      const angle = rng() * Math.PI * 2;
      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(0.3 + rng() * 0.7, 7),
        new THREE.MeshBasicMaterial({ color: colors[Math.floor(rng() * colors.length)] }),
      );
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(radius * Math.cos(angle), 0.009, radius * Math.sin(angle));
      scene.add(patch);
    }
  };

  place(TRACK_RADIUS + 1.0, 7.5, 25);           // outer area
}

function addRocks(scene: THREE.Scene): void {
  const rng = seededRng(13);
  const colors = [0x3a3a2e, 0x484838, 0x555548, 0x404035];

  for (let i = 0; i < 16; i++) {
    const r = TRACK_RADIUS + 1.2 + rng() * 6.5;
    const angle = rng() * Math.PI * 2;
    const w = 0.15 + rng() * 0.28;
    const rock = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.07 + rng() * 0.1, w * (0.6 + rng() * 0.7)),
      new THREE.MeshBasicMaterial({ color: colors[Math.floor(rng() * colors.length)] }),
    );
    rock.rotation.y = rng() * Math.PI;
    rock.position.set(r * Math.cos(angle), 0.04, r * Math.sin(angle));
    rock.castShadow = true;
    scene.add(rock);
  }
}

function addShadowOverlay(scene: THREE.Scene): void {
  const overlay = new THREE.Mesh(
    new THREE.CircleGeometry(18, 64),
    new THREE.ShadowMaterial({ opacity: 0.5 }),
  );
  overlay.rotation.x = -Math.PI / 2;
  overlay.position.y = 0.016;
  overlay.receiveShadow = true;
  scene.add(overlay);
}
