import type { SoldierType } from '../state/GameState';

// 내부 등급 키는 유지(가중치/배율 로직 보존). 표기만 시대/신으로 노출한다.
export type Grade =
  'normal' | 'rare' | 'epic' | 'unique' |
  'legendary' | 'mythic' | 'transcendent' | 'eternal';

// 상위 3등급은 trait별 "신"으로 표기된다.
export type GodTier = 'mythic' | 'transcendent' | 'eternal';

export interface GradeMultipliers {
  attackDamage: number;
  attackRange:  number;
  attackSpeed:  number;
  moveSpeed:    number;
}

export interface GradeDef {
  grade: Grade;
  label: string;    // 시대명(시대 등급) 또는 신 카테고리명(신 등급의 폴백)
  isGod: boolean;   // true면 trait별 신 이름으로 표기 (getGradeLabel 참조)
  color: number;    // 고리 색상 (0xRRGGBB)
  weight: number;   // 뽑기 가중치 — 이 값만 바꾸면 확률 조정됨
  multipliers: GradeMultipliers;
}

// ★ 확률 조정: weight 값만 변경하면 됨 (합산 대비 비율로 계산)
export const GRADE_DEFS: GradeDef[] = [
  { grade: 'normal',       label: '구석기', isGod: false, color: 0xffffff, weight: 450, multipliers: { attackDamage: 1.0,  attackRange: 1.0,  attackSpeed: 1.0,  moveSpeed: 1.0  } },
  { grade: 'rare',         label: '중세',   isGod: false, color: 0x4499ff, weight: 300,  multipliers: { attackDamage: 1.5,  attackRange: 1.1,  attackSpeed: 1.1,  moveSpeed: 1.05 } },
  { grade: 'epic',         label: '근대',   isGod: false, color: 0xaa44ff, weight: 100,  multipliers: { attackDamage: 2.0,  attackRange: 1.2,  attackSpeed: 1.2,  moveSpeed: 1.1  } },
  { grade: 'unique',       label: '현대',   isGod: false, color: 0xff8800, weight: 30,   multipliers: { attackDamage: 3.0,  attackRange: 1.4,  attackSpeed: 1.4,  moveSpeed: 1.15 } },
  { grade: 'legendary',    label: '미래',   isGod: false, color: 0xffcc00, weight: 10,   multipliers: { attackDamage: 4.5,  attackRange: 1.6,  attackSpeed: 1.6,  moveSpeed: 1.2  } },
  { grade: 'mythic',       label: '신화',   isGod: true,  color: 0xff3333, weight: 3,    multipliers: { attackDamage: 6.5,  attackRange: 1.8,  attackSpeed: 1.8,  moveSpeed: 1.3  } },
  { grade: 'transcendent', label: '초월',   isGod: true,  color: 0x00ffee, weight: 1,    multipliers: { attackDamage: 8.0,  attackRange: 2.0,  attackSpeed: 2.0,  moveSpeed: 1.5  } },
  { grade: 'eternal',      label: '영원',   isGod: true,  color: 0xffd700, weight: 0.2,  multipliers: { attackDamage: 10.0, attackRange: 2.5,  attackSpeed: 2.5,  moveSpeed: 2.0  } },
];

// 유닛 타입별 신 이름 (mythic / transcendent / eternal)
// 근접=전쟁신 · 원거리=사냥/궁술신 · 폭발=천둥/불의 신
export const GOD_NAMES: Record<SoldierType, Record<GodTier, string>> = {
  melee:     { mythic: '아레스',       transcendent: '아테나', eternal: '오딘' },
  ranged:    { mythic: '아르테미스',   transcendent: '아폴론', eternal: '후예' },
  explosive: { mythic: '헤파이스토스', transcendent: '라이진', eternal: '제우스' },
};

const TOTAL_WEIGHT = GRADE_DEFS.reduce((sum, d) => sum + d.weight, 0);

export function rollGrade(): Grade {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const def of GRADE_DEFS) {
    r -= def.weight;
    if (r <= 0) return def.grade;
  }
  return 'normal';
}

export function getGradeDef(grade: Grade): GradeDef {
  return GRADE_DEFS.find(d => d.grade === grade)!;
}

// 화면 표기용 라벨: 시대 등급은 시대명, 신 등급은 유닛 타입별 신 이름
export function getGradeLabel(grade: Grade, type: SoldierType): string {
  const def = getGradeDef(grade);
  return def.isGod ? GOD_NAMES[type][grade as GodTier] : def.label;
}
