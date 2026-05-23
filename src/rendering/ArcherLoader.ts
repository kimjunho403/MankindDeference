import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { makeInPlace, convertToBasic, computeScale } from './gltfUtils';
import type { SoldierTemplate } from './SoldierTypes';

export async function loadArcherTemplate(): Promise<SoldierTemplate> {
  const loader = new GLTFLoader();

  const [modelGltf, idleGltf, attackGltf] = await Promise.all([
    loader.loadAsync('/Archer/Archer.glb'),
    loader.loadAsync('/Archer/ArcherIdle.glb'),
    loader.loadAsync('/Archer/ArcherShot.glb'),
  ]);

  const scale = computeScale(modelGltf.scene);
  convertToBasic(modelGltf.scene);

  const rawIdle   = idleGltf.animations[0]   ?? modelGltf.animations[0];
  const rawAttack = attackGltf.animations[0]  ?? modelGltf.animations[0];
  let rawWalk = modelGltf.animations[0];
  try {
    const walkGltf = await loader.loadAsync('/Archer/ArcherWalk.glb');
    rawWalk = walkGltf.animations[0] ?? rawWalk;
  } catch {
    // walk clip is optional; fall back to model animation
  }

  const idleClip   = rawIdle   ? makeInPlace(rawIdle)   : new THREE.AnimationClip('idle',   0, []);
  const attackClip = rawAttack ? makeInPlace(rawAttack)  : new THREE.AnimationClip('attack', 0, []);
  const walkClip   = rawWalk   ? makeInPlace(rawWalk)    : new THREE.AnimationClip('walk',   0, []);

  return { scene: modelGltf.scene, idleClip, attackClip, walkClip, scale };
}
