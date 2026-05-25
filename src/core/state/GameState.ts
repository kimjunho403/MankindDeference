export type SoldierType = 'archer' | 'ninja';
export type WeaponType  = 'arrow' | 'shuriken';

export interface MonsterData {
  id: number;
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
  spawnTimer: number;
  spawnInterval: number;
  gameOver: boolean;
}

export function createGameState(): GameState {
  return {
    gold: 100,
    goldPerSecond: 3,
    monsters: [],
    soldiers: [],
    nextMonsterId: 1,
    nextSoldierId: 1,
    spawnTimer: 0,
    spawnInterval: 3,
    gameOver: false,
  };
}
