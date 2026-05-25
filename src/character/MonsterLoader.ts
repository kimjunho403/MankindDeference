import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { makeInPlace, convertToBasic, computeScale } from './gltfUtils';

export interface MonsterTemplate {
  scene: THREE.Object3D;
  walkClip: THREE.AnimationClip;
  scaleY: number;
}

export interface MonsterInstance {
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
}

export async function loadMonsterTemplate(): Promise<MonsterTemplate> {
  const loader = new GLTFLoader();

  const [modelGltf, walkGltf] = await Promise.all([
    loader.loadAsync('/warrok/Warrok.glb'),
    loader.loadAsync('/warrok/WarrokWalking.glb'),
  ]);

  const scaleY = computeScale(modelGltf.scene);
  const rawClips = walkGltf.animations.length > 0 ? walkGltf.animations : modelGltf.animations;
  if (rawClips.length === 0) console.warn('[MonsterLoader] No animation clips found');

  const walkClip = rawClips.length > 0
    ? makeInPlace(rawClips[0])
    : new THREE.AnimationClip('idle', 0, []);

  convertToBasic(modelGltf.scene);
  return { scene: modelGltf.scene, walkClip, scaleY };
}

export function createMonsterInstance(template: MonsterTemplate): MonsterInstance {
  const model = skeletonClone(template.scene) as THREE.Object3D;
  model.scale.setScalar(template.scaleY);
  const mixer = new THREE.AnimationMixer(model);
  if (template.walkClip.tracks.length > 0) mixer.clipAction(template.walkClip).play();
  return { model, mixer };
}
