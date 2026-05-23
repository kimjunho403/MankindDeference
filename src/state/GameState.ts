export type SoldierType = 'archer' | 'ninja';
export type WeaponType  = 'arrow' | 'shuriken';

export interface MonsterData {
  id: number;
  hp: number;
  maxHp: number;
  speed: number;   // track laps per second
  progress: number; // 0 ~ 1 (position on circular track)
}

export interface SoldierData {
  id: number;
  attackDamage: number;
  attackRange: number;
  attackCooldown: number;
  attackSpeed: number; // attacks per second
  position: { x: number; z: number };
  moveTarget: { x: number; z: number } | null;
  moveSpeed: number;
  selected: boolean;
  targetId: number | null;
  soldierType: SoldierType;
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
  spawnInterval: number; // seconds between monster spawns
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
