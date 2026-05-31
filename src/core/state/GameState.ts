import type { MonsterType } from '../systems/StageDefs';
import { STAGES } from '../systems/StageDefs';
import type { Grade } from '../systems/GradeDefs';
import type { Trait } from '../systems/UpgradeDefs';
export type { Grade };
export type { Trait };

export type { MonsterType };
export type SoldierType = 'archer' | 'ninja' | 'paladin';
export type WeaponType  = 'arrow' | 'shuriken' | 'melee';

export interface MonsterData {
  id: number;
  monsterType: MonsterType;
  hp: number;
  maxHp: number;
  speed: number;
  progress: number;
}

export interface SoldierData {
  id: number;
  soldierType: SoldierType;
  grade: Grade;
  trait: Trait;
  attackDamage: number;
  attackRange: number;
  attackCooldown: number;
  attackSpeed: number;
  attackHitDelay: number;  // 공격 시작 후 실제 데미지 적용까지의 딜레이 (초). 0이면 즉시
  position: { x: number; z: number };
  moveTarget: { x: number; z: number } | null;
  moveSpeed: number;
  selected: boolean;
  targetId: number | null;
  weaponType: WeaponType;
}

export interface PendingDamage {
  timer: number;
  monsterId: number;
  damage: number;
}

export interface GameState {
  gold: number;
  goldPerSecond: number;
  monsters: MonsterData[];
  soldiers: SoldierData[];
  nextMonsterId: number;
  nextSoldierId: number;
  stage: number;
  stageTimeRemaining: number;
  spawnTimers: Record<MonsterType, number>;
  spawnedCounts: Record<MonsterType, number>;
  pendingDamages: PendingDamage[];
  upgrades: Record<Trait, number>;  // 특성별 업그레이드 레벨 (0~100)
  gameOver: boolean;
  won: boolean;
}

export function createGameState(): GameState {
  return {
    gold: 100000,
    goldPerSecond: 3,
    monsters: [],
    soldiers: [],
    nextMonsterId: 1,
    nextSoldierId: 1,
    stage: 1,
    stageTimeRemaining: STAGES[0].duration,
    spawnTimers:   { warrok: 0, jery: 0, mutent: 0 },
    spawnedCounts: { warrok: 0, jery: 0, mutent: 0 },
    pendingDamages: [],
    upgrades: { ranged: 0, explosive: 0, melee: 0 },
    gameOver: false,
    won: false,
  };
}
