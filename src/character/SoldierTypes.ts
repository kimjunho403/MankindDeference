import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { floorModel } from './gltfUtils';

const FADE_IDLE_WALK   = 0.25;
const FADE_TO_ATTACK   = 0.1;
const FADE_FROM_ATTACK = 0.25;

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
  currentAction: THREE.AnimationAction;
}

function crossFade(
  from: THREE.AnimationAction,
  to: THREE.AnimationAction,
  duration: number,
): void {
  if (from === to) { to.reset(); return; }
  to.reset();
  to.play();
  from.crossFadeTo(to, duration, false);
}

export function createSoldierInstance(template: SoldierTemplate): SoldierInstance {
  const model = skeletonClone(template.scene) as THREE.Object3D;
  model.scale.setScalar(template.scale);
  floorModel(model);

  const mixer       = new THREE.AnimationMixer(model);
  const idleAction  = mixer.clipAction(template.idleClip);
  const attackAction = mixer.clipAction(template.attackClip);
  const walkAction  = mixer.clipAction(template.walkClip);

  attackAction.setLoop(THREE.LoopOnce, 1);
  attackAction.clampWhenFinished = true;
  walkAction.setLoop(THREE.LoopRepeat, Infinity);
  idleAction.play();

  const instance: SoldierInstance = {
    model, mixer, idleAction, attackAction, walkAction,
    currentAction: idleAction,
  };

  mixer.addEventListener('finished', (e) => {
    const ev = e as THREE.Event & { action: THREE.AnimationAction };
    if (ev.action !== attackAction) return;
    crossFade(attackAction, idleAction, FADE_FROM_ATTACK);
    instance.currentAction = idleAction;
  });

  return instance;
}

export function playAttack(instance: SoldierInstance): void {
  crossFade(instance.currentAction, instance.attackAction, FADE_TO_ATTACK);
  instance.currentAction = instance.attackAction;
}

export function playWalk(instance: SoldierInstance): void {
  if (instance.currentAction === instance.walkAction) return;
  if (instance.currentAction === instance.attackAction) return;
  crossFade(instance.currentAction, instance.walkAction, FADE_IDLE_WALK);
  instance.currentAction = instance.walkAction;
}

export function playIdle(instance: SoldierInstance): void {
  if (instance.currentAction === instance.idleAction) return;
  if (instance.currentAction === instance.attackAction) return;
  crossFade(instance.currentAction, instance.idleAction, FADE_IDLE_WALK);
  instance.currentAction = instance.idleAction;
}
