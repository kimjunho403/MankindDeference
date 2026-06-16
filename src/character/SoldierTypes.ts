import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { floorModel } from './gltfUtils';
import { registerWeapon, type WeaponParams } from './weaponMount';

const FADE_IDLE_WALK   = 0.25;
const FADE_TO_ATTACK   = 0.1;
const FADE_FROM_ATTACK = 0.25;
const FADE_CANCEL      = 0.12;  // 공격 취소 시 빠르게 idle로 끊기
const ATTACK_FIT_MARGIN = 1.15;  // 공격 애니가 쿨다운보다 살짝 빨리 끝나도록 (끊김 방지)

// 손 본에 붙는 무기(도끼 등). 스키닝 없이 본에 강체로 부착되어 안 찌그러진다.
export interface WeaponMount {
  key: string;             // 무기 종류 ('axe', 'spear') — 튜너 독립 조정 단위
  scene: THREE.Object3D;
  bone: string;            // 부착할 본 이름 (예: 'RightHand')
  params: WeaponParams;    // 위치/회전/크기 (튜너와 공유)
  throwable: boolean;      // true면 던질 때 손에서 숨겼다 모션 끝나면 복원
}

export interface SoldierTemplate {
  scene: THREE.Object3D;
  idleClip: THREE.AnimationClip;
  attackClip: THREE.AnimationClip;
  walkClip: THREE.AnimationClip;
  scale: number;
  attackTimeScale?: number;  // 공격 애니메이션 재생 속도 (기본값 1.0)
  weapon?: WeaponMount;      // 손에 부착할 무기 (없으면 미부착)
  displayName?: string;      // 표시용 이름 (모델 파일명 기반, 에디터 등)
}

export interface SoldierInstance {
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  idleAction: THREE.AnimationAction;
  attackAction: THREE.AnimationAction;
  walkAction: THREE.AnimationAction;
  currentAction: THREE.AnimationAction;
  weaponMesh?: THREE.Object3D;   // 부착된 무기 메쉬 (던지기 숨김용)
  weaponThrowable: boolean;      // 무기를 던지는 캐릭터인지
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

function attachWeapon(model: THREE.Object3D, weapon: WeaponMount): THREE.Object3D | undefined {
  const bone = model.getObjectByName(weapon.bone);
  if (!bone) { console.warn(`Weapon bone not found: ${weapon.bone}`); return undefined; }

  model.updateMatrixWorld(true);
  const boneScale = bone.getWorldScale(new THREE.Vector3()).x || 1;

  const mesh = weapon.scene.clone(true);
  const size = new THREE.Vector3();
  new THREE.Box3().setFromObject(mesh).getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;

  bone.add(mesh);
  // 등록 시 변환 적용 (튜너 활성 시 live 값 우선) — boneScale 보정은 weaponMount가 처리
  registerWeapon({ key: weapon.key, mesh, maxDim, boneScale }, weapon.params);
  return mesh;
}

// attackSpeed에 맞춰 공격 애니가 쿨다운(1/attackSpeed) 안에 끝나도록 timeScale 계산
export function attackTimeScale(template: SoldierTemplate, attackSpeed: number): number {
  const base = template.attackTimeScale ?? 1;
  const dur = template.attackClip.duration;
  if (dur <= 0) return base;
  return Math.max(base, dur * attackSpeed * ATTACK_FIT_MARGIN);
}

// 공격 애니의 fraction(0~1) 지점이 재생되는 실제 시각(초). 속도 무관하게 같은 프레임에서 발동.
export function throwDelaySeconds(template: SoldierTemplate, attackSpeed: number, fraction: number): number {
  const dur = template.attackClip.duration;
  if (dur <= 0) return 0;
  return fraction * dur / attackTimeScale(template, attackSpeed);
}

export function createSoldierInstance(template: SoldierTemplate, attackSpeed = 1): SoldierInstance {
  const model = skeletonClone(template.scene) as THREE.Object3D;
  model.scale.setScalar(template.scale);
  floorModel(model);
  const weaponMesh = template.weapon ? attachWeapon(model, template.weapon) : undefined;

  const mixer       = new THREE.AnimationMixer(model);
  const idleAction  = mixer.clipAction(template.idleClip);
  const attackAction = mixer.clipAction(template.attackClip);
  const walkAction  = mixer.clipAction(template.walkClip);

  attackAction.setLoop(THREE.LoopOnce, 1);
  attackAction.clampWhenFinished = true;
  attackAction.timeScale = attackTimeScale(template, attackSpeed);
  walkAction.setLoop(THREE.LoopRepeat, Infinity);
  idleAction.play();

  const instance: SoldierInstance = {
    model, mixer, idleAction, attackAction, walkAction,
    currentAction: idleAction,
    weaponMesh,
    weaponThrowable: template.weapon?.throwable ?? false,
  };

  mixer.addEventListener('finished', (e) => {
    const ev = e as THREE.Event & { action: THREE.AnimationAction };
    if (ev.action !== attackAction) return;
    // 이미 취소(cancelAttack)로 idle 전환됐으면 중복 크로스페이드 방지
    if (instance.currentAction === attackAction) {
      crossFade(attackAction, idleAction, FADE_FROM_ATTACK);
      instance.currentAction = idleAction;
    }
    // 공격 모션 끝 → 던졌던 무기 복원
    if (instance.weaponThrowable && instance.weaponMesh) instance.weaponMesh.visible = true;
  });

  return instance;
}

// 던지는 순간 호출: 손의 무기를 숨김 (공격 모션 끝나면 finished에서 복원)
export function hideThrownWeapon(instance: SoldierInstance): void {
  if (instance.weaponThrowable && instance.weaponMesh) instance.weaponMesh.visible = false;
}

// 공격 취소: 재생 중인 공격 모션을 즉시 idle로 끊음 (무기도 손에 복원)
export function cancelAttack(instance: SoldierInstance): void {
  if (instance.currentAction !== instance.attackAction) return;
  crossFade(instance.attackAction, instance.idleAction, FADE_CANCEL);
  instance.currentAction = instance.idleAction;
  if (instance.weaponThrowable && instance.weaponMesh) instance.weaponMesh.visible = true;
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
