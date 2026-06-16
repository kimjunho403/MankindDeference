import * as THREE from 'three';

// 무기 부착 파라미터 (설정/튜너가 공유하는 단일 형태)
export interface WeaponParams {
  offset: [number, number, number];      // 본 기준 위치 (월드 단위)
  rotationDeg: [number, number, number]; // 본 기준 회전 (도)
  targetLength: number;                  // 무기 최대 변 길이를 맞출 월드 길이
}

// 부착된 무기 메쉬 1개 + 스케일 계산 컨텍스트 (+ 무기 종류 key)
export interface TunableWeapon {
  key: string;        // 무기 종류 ('axe', 'spear' 등) — 튜너에서 독립 조정 단위
  mesh: THREE.Object3D;
  maxDim: number;     // 무기 원본 최대 치수
  boneScale: number;  // 부착 본의 월드 스케일
}

const registry: TunableWeapon[] = [];
const configByKey = new Map<string, WeaponParams>(); // 설정 기본값
const liveByKey   = new Map<string, WeaponParams>(); // 튜너 오버라이드 (우선)

const DEFAULT: WeaponParams = { offset: [0, 0, 0], rotationDeg: [0, 0, 0], targetLength: 0.9 };

export function applyWeaponTransform(w: TunableWeapon, p: WeaponParams): void {
  w.mesh.scale.setScalar(p.targetLength / w.maxDim / w.boneScale);
  w.mesh.position.set(p.offset[0], p.offset[1], p.offset[2]).divideScalar(w.boneScale);
  w.mesh.rotation.set(
    THREE.MathUtils.degToRad(p.rotationDeg[0]),
    THREE.MathUtils.degToRad(p.rotationDeg[1]),
    THREE.MathUtils.degToRad(p.rotationDeg[2]),
  );
}

// 부착 시 호출: 레지스트리 등록 + (live 우선) 변환 적용
export function registerWeapon(w: TunableWeapon, configParams: WeaponParams): void {
  registry.push(w);
  configByKey.set(w.key, configParams);
  applyWeaponTransform(w, liveByKey.get(w.key) ?? configParams);
}

// 튜너가 특정 무기 key 값 변경 시: 해당 key 무기 전체에 즉시 반영
export function setLiveWeaponParams(key: string, p: WeaponParams): void {
  liveByKey.set(key, p);
  for (const w of registry) if (w.key === key) applyWeaponTransform(w, p);
}

// 튜너용: 현재 등록된 무기 종류 목록
export function listWeaponKeys(): string[] {
  return [...new Set(registry.map(w => w.key))];
}

// 튜너용: 특정 key의 현재 파라미터 (live > config > default)
export function getWeaponParams(key: string): WeaponParams {
  const p = liveByKey.get(key) ?? configByKey.get(key) ?? DEFAULT;
  return { offset: [...p.offset], rotationDeg: [...p.rotationDeg], targetLength: p.targetLength };
}

// 에디터에서 캐릭터 전환 시 호출: 부착 메쉬 목록만 비움 (튜닝값 config/live는 유지)
export function clearWeaponRegistry(): void {
  registry.length = 0;
}
