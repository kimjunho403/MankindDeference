import type { MonsterType } from '../systems/StageDefs';
import { STAGES } from '../systems/StageDefs';
import type { Grade } from '../systems/GradeDefs';
export type { Grade };

export type { MonsterType };
export type SoldierType = 'ranged' | 'explosive' | 'melee';
export type WeaponType  = 'arrow' | 'shuriken' | 'melee' | 'rock' | 'spear';

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
  soldierType: SoldierType;  // 유닛 타입 = 특성(업그레이드 분류). ranged/explosive/melee
  grade: Grade;
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

// 선딜레이(windup) 중인 공격. timer 만료 시 사정거리 재확인 후 발동/취소.
export interface PendingAttack {
  soldierId: number;
  targetId: number;
  timer: number;        // 던지기/타격까지 남은 시간 (초)
  damage: number;
  weaponType: WeaponType;
  attackRange: number;
}

// 비행 중인 유도 투사체. 타겟을 추적하다 명중 시 피해 적용.
export interface ProjectileData {
  id: number;
  weaponType: WeaponType;
  damage: number;
  targetId: number;     // 추적 대상 몬스터
  x: number; y: number; z: number;  // 현재 위치
  speed: number;        // 비행 속도 (units/sec)
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
  pendingAttacks: PendingAttack[];
  projectiles: ProjectileData[];
  nextProjectileId: number;
  upgrades: Record<SoldierType, number>;  // 특성(유닛 타입)별 업그레이드 레벨 (0~100)
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
    pendingAttacks: [],
    projectiles: [],
    nextProjectileId: 1,
    upgrades: { ranged: 0, explosive: 0, melee: 0 },
    gameOver: false,
    won: false,
  };
}
