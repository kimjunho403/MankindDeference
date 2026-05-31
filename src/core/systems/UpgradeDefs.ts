export type Trait = 'ranged' | 'explosive' | 'melee';

export interface TraitDef {
  trait: Trait;
  label: string;
  icon: string;
}

export const TRAIT_DEFS: TraitDef[] = [
  { trait: 'ranged',    label: '원거리', icon: '🏹' },
  { trait: 'explosive', label: '폭발',   icon: '💣' },
  { trait: 'melee',     label: '근접',   icon: '⚔️' },
];

export const UPGRADE_PER_LEVEL = 0.05;  // 레벨당 공격력 +5%
export const UPGRADE_MAX_LEVEL = 100;

export function upgradeCost(currentLevel: number): number {
  return 100 + currentLevel * 50;  // 0→1: 100골드, 1→2: 150골드, ...
}

export function damageMultiplier(level: number): number {
  return 1 + level * UPGRADE_PER_LEVEL;
}
