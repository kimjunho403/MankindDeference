import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeInPlace, convertToBasic, computeScale } from './gltfUtils';
import type { MonsterTemplate } from './MonsterLoader';

export async function loadJeryTemplate(): Promise<MonsterTemplate> {
  const loader = new GLTFLoader();

  const [modelGltf, walkGltf] = await Promise.all([
    loader.loadAsync('/Jery/Jery.glb'),
    loader.loadAsync('/Jery/JerryWalk.glb'),
  ]);

  const scaleY = computeScale(modelGltf.scene);
  const rawClips = walkGltf.animations.length > 0 ? walkGltf.animations : modelGltf.animations;
  const walkClip = rawClips.length > 0
    ? makeInPlace(rawClips[0])
    : new THREE.AnimationClip('idle', 0, []);

  convertToBasic(modelGltf.scene);
  return { scene: modelGltf.scene, walkClip, scaleY };
}
