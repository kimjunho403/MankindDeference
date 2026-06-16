import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { makeInPlace, convertToBasic, computeScale, stripBonePrefix, stripClipBonePrefix } from './gltfUtils';
import type { SoldierType } from '../core/state/GameState';
import type { SoldierTemplate, WeaponMount } from './SoldierTypes';
import type { WeaponParams } from './weaponMount';
import WEAPON_PARAMS from './weaponParams.json';  // 무기 위치/회전/크기 (에디터 💾로 저장됨)

// 손 본에 붙일 무기 설정 (오프셋/회전은 시각적으로 튜닝)
export interface WeaponConfig {
  url: string;
  key?: string;                      // 무기 종류 ('axe','spear'), 기본은 파일명
  bone?: string;                     // 기본 'RightHand'
  throwable?: boolean;               // true면 던질 때 손에서 숨김 (돌/창 등)
  offset?: [number, number, number]; // 월드 단위, 기본 [0,0,0]
  rotationDeg?: [number, number, number]; // 도(degree), 기본 [0,0,0]
  targetLength?: number;             // 무기 길이를 맞출 월드 길이, 기본 0.9
}

// 한 캐릭터(또는 등급 모델)를 구성하는 GLB 경로 묶음.
// AI 생성 모델은 Mixamo 스켈레톤을 공유하므로, 모델만 교체하고
// 애니메이션(idle/attack/walk)은 같은 trait의 base 클립을 재사용한다.
export interface SoldierAssetUrls {
  model:  string;
  idle:   string;
  attack: string;
  walk?:  string;
  attackTimeScale?: number;
  weapon?: WeaponConfig;
}

// ── trait(=soldierType)별 base 에셋 경로 (애니메이션 공유 원본) ────────────────
// 구석기(normal) 시대 모델을 trait별 base로 사용. 각 모델은 자체 Mixamo 리그라
// 자기 폴더의 애니메이션을 사용한다. (중세 등 추가 시 GRADE_MODEL_DEFS에 등록)
export const BASE_ASSETS: Record<SoldierType, SoldierAssetUrls> = {
  archer: {
    model:  '/구석기원거리/구석기원거리.glb',
    idle:   '/구석기원거리/구석기원거리Idle.glb',
    attack: '/구석기원거리/구석기원거리Attck.glb',
    walk:   '/구석기원거리/구석기원거리Walk.glb',
    weapon: { url: '/구석기원거리/돌.glb', key: 'rock', bone: 'RightHand', throwable: true },
  },
  ninja: {
    model:  '/구석기폭발형/구석기폭발형.glb',
    idle:   '/구석기폭발형/구석기폭발형Idle.glb',
    attack: '/구석기폭발형/구석기폭발형Attck.glb',
    walk:   '/구석기폭발형/구석기폭발형Walk.glb',
    weapon: { url: '/구석기폭발형/창.glb', key: 'spear', bone: 'RightHand', throwable: true },
  },
  paladin: {
    model:  '/구석기근접형/구석기근접형.glb',
    idle:   '/구석기근접형/구석기근접형Idle.glb',
    attack: '/구석기근접형/구석기근접형Attck.glb',
    walk:   '/구석기근접형/구석기근접형Walk.glb',
    attackTimeScale: 2.0,
    weapon: { url: '/구석기근접형/axe.glb', key: 'axe', bone: 'RightHand' },
  },
};

const loader = new GLTFLoader();

// 공통 로더: 모델 + idle/attack(+walk) 애니메이션을 SoldierTemplate으로 조립.
// 한글 등 비ASCII 경로 대응 (이미 인코딩된 ASCII 경로는 그대로 유지)
const u = (path: string): string => encodeURI(path);

export async function loadSoldierTemplate(urls: SoldierAssetUrls): Promise<SoldierTemplate> {
  const [modelGltf, idleGltf, attackGltf] = await Promise.all([
    loader.loadAsync(u(urls.model)),
    loader.loadAsync(u(urls.idle)),
    loader.loadAsync(u(urls.attack)),
  ]);

  const scale = computeScale(modelGltf.scene);
  convertToBasic(modelGltf.scene);
  stripBonePrefix(modelGltf.scene);  // 모델 본 이름 정규화 (mixamorig: 제거)

  const rawIdle   = idleGltf.animations[0]   ?? modelGltf.animations[0];
  const rawAttack = attackGltf.animations[0] ?? modelGltf.animations[0];

  let rawWalk = modelGltf.animations[0];
  if (urls.walk) {
    try {
      const walkGltf = await loader.loadAsync(u(urls.walk));
      rawWalk = walkGltf.animations[0] ?? rawWalk;
    } catch { /* walk clip optional */ }
  }

  // makeInPlace(루트 모션 제거) + 클립 본 이름 정규화 → 모델 본과 바인딩 일치 보장
  const prep = (raw: THREE.AnimationClip | undefined, name: string): THREE.AnimationClip =>
    raw ? stripClipBonePrefix(makeInPlace(raw)) : new THREE.AnimationClip(name, 0, []);

  const idleClip   = prep(rawIdle,   'idle');
  const attackClip = prep(rawAttack, 'attack');
  const walkClip   = prep(rawWalk,   'walk');

  const weapon = urls.weapon ? await loadWeapon(urls.weapon) : undefined;
  const displayName = urls.model.split('/').pop()?.replace(/\.glb$/i, '');

  return { scene: modelGltf.scene, idleClip, attackClip, walkClip, scale, attackTimeScale: urls.attackTimeScale, weapon, displayName };
}

async function loadWeapon(cfg: WeaponConfig): Promise<WeaponMount> {
  const gltf = await loader.loadAsync(u(cfg.url));
  convertToBasic(gltf.scene);
  // key 기본값: 파일명(확장자 제외)
  const key = cfg.key ?? cfg.url.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'weapon';
  // 위치/회전/크기는 weaponParams.json이 우선 (에디터 💾로 저장), 없으면 cfg 폴백
  const saved = (WEAPON_PARAMS as unknown as Record<string, WeaponParams | undefined>)[key];
  const params: WeaponParams = saved ?? {
    offset:       cfg.offset      ?? [0, 0, 0],
    rotationDeg:  cfg.rotationDeg ?? [0, 0, 0],
    targetLength: cfg.targetLength ?? 0.9,
  };
  return { key, scene: gltf.scene, bone: cfg.bone ?? 'RightHand', throwable: cfg.throwable ?? false, params };
}

// 등급 모델 로더 팩토리: 모델 GLB만 교체하고 애니메이션은 trait base 클립을 재사용.
// 사용 예) GRADE_MODEL_DEFS.archer.eternal = gradeModel('archer', '/units/archer/eternal.glb')
export function gradeModel(
  type: SoldierType,
  modelUrl: string,
  overrides: Partial<Omit<SoldierAssetUrls, 'model'>> = {},
): () => Promise<SoldierTemplate> {
  return () => loadSoldierTemplate({ ...BASE_ASSETS[type], ...overrides, model: modelUrl });
}
