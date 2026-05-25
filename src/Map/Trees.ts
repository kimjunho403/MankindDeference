import * as THREE from 'three';
import { TRACK_RADIUS } from '../core/systems/TrackSystem';
import { seededRng } from './mapUtils';

export function addTrees(scene: THREE.Scene): void {
  const rng = seededRng(21);
  const COUNT = 14;

  for (let i = 0; i < COUNT; i++) {
    const baseAngle = (i / COUNT) * Math.PI * 2;
    const angle = baseAngle + (rng() - 0.5) * (Math.PI / COUNT) * 0.8;
    const r = (TRACK_RADIUS + 2.5) + rng() * 3.5;
    const scale = 0.65 + rng() * 0.65;
    addTree(scene, r * Math.cos(angle), r * Math.sin(angle), scale);
  }
}

function addTree(scene: THREE.Scene, x: number, z: number, scale: number): void {
  const group = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1 * scale, 0.15 * scale, 0.75 * scale, 6),
    new THREE.MeshBasicMaterial({ color: 0x5c3d1e }),
  );
  trunk.position.y = 0.375 * scale;
  trunk.castShadow = true;
  group.add(trunk);

  // Three layered cones — bottom to top, each slightly smaller and darker
  const layers: [number, number, number, number][] = [
    [0.72, 0.95, 0, 0x1a3d0e],
    [0.56, 0.80, 0.6, 0x1e4510],
    [0.38, 0.60, 1.1, 0x163508],
  ];

  for (const [r, h, yOff, color] of layers) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(r * scale, h * scale, 7),
      new THREE.MeshBasicMaterial({ color }),
    );
    cone.position.y = (0.75 + 0.475 + yOff) * scale;
    cone.castShadow = true;
    group.add(cone);
  }

  group.position.set(x, 0, z);
  scene.add(group);
}
