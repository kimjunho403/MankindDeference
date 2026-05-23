import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { floorModel } from './gltfUtils';

export interface SoldierTemplate {
  scene: THREE.Object3D;
  idleClip: THREE.AnimationClip;
  attackClip: THREE.AnimationClip;
  walkClip: THREE.AnimationClip;
  scale: number;
}

export interface SoldierInstance {
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  idleAction: THREE.AnimationAction;
  attackAction: THREE.AnimationAction;
  walkAction: THREE.AnimationAction;
}

export function createSoldierInstance(template: SoldierTemplate): SoldierInstance {
  const model = skeletonClone(template.scene) as THREE.Object3D;
  model.scale.setScalar(template.scale);
  floorModel(model);

  const mixer = new THREE.AnimationMixer(model);

  const idleAction = mixer.clipAction(template.idleClip);
  idleAction.play();

  const attackAction = mixer.clipAction(template.attackClip);
  attackAction.setLoop(THREE.LoopOnce, 1);
  attackAction.clampWhenFinished = true;

  const walkAction = mixer.clipAction(template.walkClip);
  walkAction.setLoop(THREE.LoopRepeat, Infinity);

  mixer.addEventListener('finished', (e) => {
    const ev = e as THREE.Event & { action: THREE.AnimationAction };
    if (ev.action !== attackAction) return;
    attackAction.stop();
    idleAction.reset().play();
  });

  return { model, mixer, idleAction, attackAction, walkAction };
}

export function playAttack(instance: SoldierInstance): void {
  instance.walkAction.stop();
  instance.idleAction.stop();
  instance.attackAction.reset().play();
}

export function playIdle(instance: SoldierInstance): void {
  instance.attackAction.stop();
  instance.walkAction.stop();
  instance.idleAction.reset().play();
}
