import type { SoldierType } from '../state/GameState';

// 업그레이드 패널 표시용: 유닛 타입(=특성)별 라벨/아이콘
export interface TraitDef {
  soldierType: SoldierType;
  label: string;
  icon: string;
}

export const TRAIT_DEFS: TraitDef[] = [
  { soldierType: 'ranged',    label: '원거리', icon: '🏹' },
  { soldierType: 'explosive', label: '폭발',   icon: '💣' },
  { soldierType: 'melee',     label: '근접',   icon: '⚔️' },
];

export const UPGRADE_MAX_LEVEL = 100;

export function upgradeCost(currentLevel: number): number {
  return 100 + currentLevel * 50;  // 0→1: 100골드, 1→2: 150골드, ...
}
