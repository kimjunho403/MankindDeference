import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { makeInPlace, convertToBasic, computeScale, floorModel } from './gltfUtils';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ArcherTemplate {
  scene: THREE.Object3D;
  idleClip: THREE.AnimationClip;
  shotClip: THREE.AnimationClip;
  walkClip: THREE.AnimationClip;
  scale: number;
}

export interface ArcherInstance {
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  idleAction: THREE.AnimationAction;
  shotAction: THREE.AnimationAction;
  walkAction: THREE.AnimationAction;
}

// ── Loader ────────────────────────────────────────────────────────────────────

export async function loadArcherTemplate(): Promise<ArcherTemplate> {
  const loader = new GLTFLoader();

  const [modelGltf, idleGltf, shotGltf] = await Promise.all([
    loader.loadAsync('/Archer/Archer.glb'),
    loader.loadAsync('/Archer/ArcherIdle.glb'),
    loader.loadAsync('/Archer/ArcherShot.glb'),
  ]);

  const scale = computeScale(modelGltf.scene);
  convertToBasic(modelGltf.scene);

  const rawIdle = idleGltf.animations[0] ?? modelGltf.animations[0];
  const rawShot = shotGltf.animations[0] ?? modelGltf.animations[0];
  let rawWalk = modelGltf.animations[0];
  try {
    const walkGltf = await loader.loadAsync('/Archer/ArcherWalk.glb');
    rawWalk = walkGltf.animations[0] ?? rawWalk;
  } catch (e) {
    // walk clip is optional; fall back to model animation
  }

  const idleClip = rawIdle
    ? makeInPlace(rawIdle)
    : new THREE.AnimationClip('idle', 0, []);

  const shotClip = rawShot
    ? makeInPlace(rawShot)
    : new THREE.AnimationClip('shot', 0, []);

  const walkClip = rawWalk
    ? makeInPlace(rawWalk)
    : new THREE.AnimationClip('walk', 0, []);

  return { scene: modelGltf.scene, idleClip, shotClip, walkClip, scale };
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createArcherInstance(template: ArcherTemplate): ArcherInstance {
  const model = skeletonClone(template.scene) as THREE.Object3D;
  model.scale.setScalar(template.scale);

  // Lift bottom of bounding box to Y = 0 (pivot may not be at foot level)
  floorModel(model);
  // Slightly raise the model so the legs do not clip below the ground.

  const mixer = new THREE.AnimationMixer(model);

  const idleAction = mixer.clipAction(template.idleClip);
  idleAction.play();

  const shotAction = mixer.clipAction(template.shotClip);
  shotAction.setLoop(THREE.LoopOnce, 1);
  shotAction.clampWhenFinished = true;

  const walkAction = mixer.clipAction(template.walkClip);
  walkAction.setLoop(THREE.LoopRepeat, Infinity);

  // Return to idle after the shot animation finishes
  mixer.addEventListener('finished', (e) => {
    const ev = e as THREE.Event & { action: THREE.AnimationAction };
    if (ev.action !== shotAction) return;
    shotAction.stop();
    idleAction.reset().play();
  });

  return { model, mixer, idleAction, shotAction, walkAction };
}

// ── Animation helpers ─────────────────────────────────────────────────────────

/** Trigger the shot animation; returns to idle automatically when done. */
export function playShot(instance: ArcherInstance): void {
  if ((instance as any).walkAction) (instance as any).walkAction.stop();
  instance.idleAction.stop();
  instance.shotAction.reset().play();
}

/** Force-return to idle (e.g. target lost mid-shot). */
export function playIdle(instance: ArcherInstance): void {
  instance.shotAction.stop();
  if ((instance as any).walkAction) (instance as any).walkAction.stop();
  instance.idleAction.reset().play();
}
