import * as THREE from 'three';
import { TRACK_RADIUS } from '../core/systems/TrackSystem';
import { seededRng } from './mapUtils';

export function addTrack(scene: THREE.Scene): void {
  addTrackBase(scene);
  addTrackEdges(scene);
  addCenterDashes(scene);
  addWornPatches(scene);
  addDirectionArrows(scene);
  addSpawnMarker(scene);
}

function addTrackBase(scene: THREE.Scene): void {
  const track = new THREE.Mesh(
    new THREE.RingGeometry(TRACK_RADIUS - 0.5, TRACK_RADIUS + 0.5, 64),
    new THREE.MeshBasicMaterial({ color: 0x7a5a18, side: THREE.DoubleSide }),
  );
  track.rotation.x = -Math.PI / 2;
  track.position.y = 0.01;
  scene.add(track);
}

function addTrackEdges(scene: THREE.Scene): void {
  const mat = new THREE.MeshBasicMaterial({ color: 0x9a7828, side: THREE.DoubleSide });

  const inner = new THREE.Mesh(
    new THREE.RingGeometry(TRACK_RADIUS - 0.52, TRACK_RADIUS - 0.40, 64),
    mat,
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.012;
  scene.add(inner);

  const outer = new THREE.Mesh(
    new THREE.RingGeometry(TRACK_RADIUS + 0.40, TRACK_RADIUS + 0.52, 64),
    mat.clone(),
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = 0.012;
  scene.add(outer);
}

function addCenterDashes(scene: THREE.Scene): void {
  const COUNT = 20;
  const mat = new THREE.MeshBasicMaterial({ color: 0xb89030, side: THREE.DoubleSide });
  for (let i = 0; i < COUNT; i++) {
    const angle = (i / COUNT) * Math.PI * 2;
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.32), mat.clone());
    dash.rotation.x = -Math.PI / 2;
    dash.rotation.z = -angle;
    dash.position.set(TRACK_RADIUS * Math.cos(angle), 0.013, TRACK_RADIUS * Math.sin(angle));
    scene.add(dash);
  }
}

function addWornPatches(scene: THREE.Scene): void {
  const rng = seededRng(99);
  for (let i = 0; i < 12; i++) {
    const angle = rng() * Math.PI * 2;
    const r = TRACK_RADIUS - 0.35 + rng() * 0.7;
    const worn = new THREE.Mesh(
      new THREE.CircleGeometry(0.1 + rng() * 0.2, 6),
      new THREE.MeshBasicMaterial({ color: 0x5a4010 }),
    );
    worn.rotation.x = -Math.PI / 2;
    worn.position.set(r * Math.cos(angle), 0.011, r * Math.sin(angle));
    scene.add(worn);
  }
}

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
    arrow.position.set(TRACK_RADIUS * Math.cos(angle), 0.02, TRACK_RADIUS * Math.sin(angle));
    scene.add(arrow);
  }
}

function addSpawnMarker(scene: THREE.Scene): void {
  const marker = new THREE.Mesh(
    new THREE.CircleGeometry(0.35, 20),
    new THREE.MeshBasicMaterial({ color: 0xff6600 }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.set(TRACK_RADIUS, 0.02, 0);
  scene.add(marker);
}
