import type { SoldierType, WeaponType } from '../core/state/GameState';
import type { Grade } from '../core/systems/GradeDefs';
import type { SoldierTemplate } from './SoldierTypes';
import { loadSoldierTemplate, BASE_ASSETS } from './loadSoldierTemplate';
import ATTACK_TIMING from './attackTiming.json';  // 공격 발동 시점 (애니 0~1 비율) — 에디터 💾로 저장
export { gradeModel } from './loadSoldierTemplate';

export interface CharacterDef {
  soldierType: SoldierType;  // = 특성(업그레이드 분류)
  label: string;  // 한글 표기명
  weaponType: WeaponType;
  stats: {
    attackDamage: number;
    attackRange: number;
    attackSpeed: number;
    moveSpeed: number;
  };
  load(): Promise<SoldierTemplate>;
}

// 공격 애니의 발동(던지기/타격) 시점 — 애니 길이 대비 0~1 비율 (weapon-editor에서 조정)
export function getAttackTiming(type: SoldierType): number {
  return (ATTACK_TIMING as Record<string, number | undefined>)[type] ?? 0.1;
}

export const CHARACTER_DEFS: CharacterDef[] = [
  {
    soldierType: 'ranged',
    label: '돌팔매꾼',
    weaponType: 'rock',
    stats: { attackDamage: 10, attackRange: 4, attackSpeed: 1, moveSpeed: 3 },
    load: () => loadSoldierTemplate(BASE_ASSETS.ranged),
  },
  {
    soldierType: 'explosive',
    label: '투창병',
    weaponType: 'spear',
    stats: { attackDamage: 10, attackRange: 4, attackSpeed: 1, moveSpeed: 3 },
    load: () => loadSoldierTemplate(BASE_ASSETS.explosive),
  },
  {
    soldierType: 'melee',
    label: '돌도끼 전사',
    weaponType: 'melee',
    stats: { attackDamage: 25, attackRange: 1.5, attackSpeed: 1.5, moveSpeed: 2.5 },
    load: () => loadSoldierTemplate(BASE_ASSETS.melee),
  },
];

// ── 등급별 모델 오버라이드 ──────────────────────────────────────────────────
// (soldierType, grade) 조합별 전용 모델. 비어있는 칸은 base 모델로 폴백된다.
//
// 새 시대/신 모델 추가 = GLB 파일을 asset/units/{type}/ 에 넣고 여기 한 줄 추가:
//   ranged: {
//     legendary: gradeModel('ranged', '/units/ranged/future.glb'),   // 미래 원거리
//     eternal:   gradeModel('ranged', '/units/ranged/houyi.glb'),    // 후예(신)
//   }
// gradeModel은 모델만 교체하고 idle/attack/walk 애니는 trait base를 재사용한다.
// 등급 키: normal=구석기 rare=중세 epic=근대 unique=현대 legendary=미래
//          mythic/transcendent/eternal = 신 (GOD_NAMES 참조)
type GradeModelLoaders = Partial<Record<Grade, () => Promise<SoldierTemplate>>>;

export const GRADE_MODEL_DEFS: Record<SoldierType, GradeModelLoaders> = {
  ranged:    {},
  explosive: {},
  melee:     {},
};

// (soldierType, grade) → SoldierTemplate 조회 + 폴백을 담당하는 저장소
export interface TemplateEntry {
  type: SoldierType;
  grade: string;            // 'base' 또는 등급 키
  template: SoldierTemplate;
}
export interface SoldierTemplateStore {
  resolve(type: SoldierType, grade: Grade): SoldierTemplate;
  baseMap(): Map<SoldierType, SoldierTemplate>;
  entries(): TemplateEntry[];  // base + 모든 등급 오버라이드 (에디터용)
}

export async function loadAllTemplates(): Promise<SoldierTemplateStore> {
  // 1) trait별 base 모델 로드
  const base = new Map<SoldierType, SoldierTemplate>(
    await Promise.all(
      CHARACTER_DEFS.map(async (def) => [def.soldierType, await def.load()] as const),
    ),
  );

  // 2) 등록된 등급별 오버라이드 모델 로드
  const overrides = new Map<string, SoldierTemplate>();
  await Promise.all(
    (Object.keys(GRADE_MODEL_DEFS) as SoldierType[]).flatMap((type) =>
      (Object.keys(GRADE_MODEL_DEFS[type]) as Grade[]).map(async (grade) => {
        overrides.set(`${type}:${grade}`, await GRADE_MODEL_DEFS[type][grade]!());
      }),
    ),
  );

  return {
    resolve: (type, grade) => overrides.get(`${type}:${grade}`) ?? base.get(type)!,
    baseMap: () => base,
    entries: () => {
      const list: TemplateEntry[] = [];
      for (const [type, template] of base) list.push({ type, grade: 'base', template });
      for (const [key, template] of overrides) {
        const [type, grade] = key.split(':') as [SoldierType, string];
        list.push({ type, grade, template });
      }
      return list;
    },
  };
}

export function randomSoldierType(): SoldierType {
  const idx = Math.floor(Math.random() * CHARACTER_DEFS.length);
  return CHARACTER_DEFS[idx].soldierType;
}

export function getCharacterDef(soldierType: SoldierType): CharacterDef {
  const def = CHARACTER_DEFS.find(d => d.soldierType === soldierType);
  if (!def) throw new Error(`Unknown soldierType: ${soldierType}`);
  return def;
}
