import type { MonsterType } from '../systems/StageDefs';
import { STAGES } from '../systems/StageDefs';

export type { MonsterType };
export type SoldierType = 'archer' | 'ninja';
export type WeaponType  = 'arrow' | 'shuriken';

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
  attackDamage: number;
  attackRange: number;
  attackCooldown: number;
  attackSpeed: number;
  position: { x: number; z: number };
  moveTarget: { x: number; z: number } | null;
  moveSpeed: number;
  selected: boolean;
  targetId: number | null;
  weaponType: WeaponType;
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
  gameOver: boolean;
  won: boolean;
}

export function createGameState(): GameState {
  return {
    gold: 100,
    goldPerSecond: 3,
    monsters: [],
    soldiers: [],
    nextMonsterId: 1,
    nextSoldierId: 1,
    stage: 1,
    stageTimeRemaining: STAGES[0].duration,
    spawnTimers:   { warrok: 0, jery: 0, mutent: 0 },
    spawnedCounts: { warrok: 0, jery: 0, mutent: 0 },
    gameOver: false,
    won: false,
  };
}
