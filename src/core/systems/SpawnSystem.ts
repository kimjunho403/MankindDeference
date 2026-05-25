import type { GameState, MonsterData } from '../state/GameState';

export function updateSpawn(state: GameState, delta: number): MonsterData | null {
  state.spawnTimer += delta;
  if (state.spawnTimer < state.spawnInterval) return null;
  state.spawnTimer -= state.spawnInterval;

  const hp = 30 + Math.floor(state.monsters.length * 2);
  const monster: MonsterData = {
    id: state.nextMonsterId++,
    hp,
    maxHp: hp,
    speed: 0.06,
    progress: 0,
  };
  state.monsters.push(monster);
  return monster;
}
