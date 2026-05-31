export type Grade =
  'normal' | 'rare' | 'epic' | 'unique' |
  'legendary' | 'mythic' | 'transcendent' | 'eternal';

export interface GradeMultipliers {
  attackDamage: number;
  attackRange:  number;
  attackSpeed:  number;
  moveSpeed:    number;
}

export interface GradeDef {
  grade: Grade;
  label: string;    // 한글 표기
  color: number;    // 고리 색상 (0xRRGGBB)
  weight: number;   // 뽑기 가중치 — 이 값만 바꾸면 확률 조정됨
  multipliers: GradeMultipliers;
}

// ★ 확률 조정: weight 값만 변경하면 됨 (합산 대비 비율로 계산)
export const GRADE_DEFS: GradeDef[] = [
  { grade: 'normal',       label: '일반',   color: 0xffffff, weight: 450, multipliers: { attackDamage: 1.0,  attackRange: 1.0,  attackSpeed: 1.0,  moveSpeed: 1.0  } },
  { grade: 'rare',         label: '레어',   color: 0x4499ff, weight: 300,  multipliers: { attackDamage: 1.5,  attackRange: 1.1,  attackSpeed: 1.1,  moveSpeed: 1.05 } },
  { grade: 'epic',         label: '에픽',   color: 0xaa44ff, weight: 100,  multipliers: { attackDamage: 2.0,  attackRange: 1.2,  attackSpeed: 1.2,  moveSpeed: 1.1  } },
  { grade: 'unique',       label: '유니크', color: 0xff8800, weight: 30,   multipliers: { attackDamage: 3.0,  attackRange: 1.4,  attackSpeed: 1.4,  moveSpeed: 1.15 } },
  { grade: 'legendary',    label: '전설',   color: 0xffcc00, weight: 10,   multipliers: { attackDamage: 4.5,  attackRange: 1.6,  attackSpeed: 1.6,  moveSpeed: 1.2  } },
  { grade: 'mythic',       label: '신화',   color: 0xff3333, weight: 3,    multipliers: { attackDamage: 6.5,  attackRange: 1.8,  attackSpeed: 1.8,  moveSpeed: 1.3  } },
  { grade: 'transcendent', label: '초월',   color: 0x00ffee, weight: 1,    multipliers: { attackDamage: 8.0,  attackRange: 2.0,  attackSpeed: 2.0,  moveSpeed: 1.5  } },
  { grade: 'eternal',      label: '영원',   color: 0xffd700, weight: 0.2,  multipliers: { attackDamage: 10.0, attackRange: 2.5,  attackSpeed: 2.5,  moveSpeed: 2.0  } },
];

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
