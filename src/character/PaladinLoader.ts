import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { makeInPlace, convertToBasic, computeScale } from './gltfUtils';
import type { SoldierTemplate } from './SoldierTypes';

export async function loadPaladinTemplate(): Promise<SoldierTemplate> {
  const loader = new GLTFLoader();

  const [modelGltf, idleGltf, attackGltf, walkGltf] = await Promise.all([
    loader.loadAsync('/Paladin/Paladin.glb'),
    loader.loadAsync('/Paladin/PaladinIdle.glb'),
    loader.loadAsync('/Paladin/PaladinAttck.glb'),
    loader.loadAsync('/Paladin/PaladinWalk.glb'),  // 전진 모션 → makeInPlace 필수
  ]);

  const scale = computeScale(modelGltf.scene);
  convertToBasic(modelGltf.scene);

  const rawIdle   = idleGltf.animations[0]   ?? modelGltf.animations[0];
  const rawAttack = attackGltf.animations[0]  ?? modelGltf.animations[0];
  const rawWalk   = walkGltf.animations[0]    ?? modelGltf.animations[0];

  const idleClip   = rawIdle   ? makeInPlace(rawIdle)   : new THREE.AnimationClip('idle',   0, []);
  const attackClip = rawAttack ? makeInPlace(rawAttack)  : new THREE.AnimationClip('attack', 0, []);
  const walkClip   = rawWalk   ? makeInPlace(rawWalk)    : new THREE.AnimationClip('walk',   0, []);

  return { scene: modelGltf.scene, idleClip, attackClip, walkClip, scale, attackTimeScale: 2.0 };
}
