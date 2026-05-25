import type { GameState, MonsterData } from '../state/GameState';
import { STAGES } from './StageDefs';
import { getMonsterDef } from '../../character/MonsterRegistry';

export function updateSpawn(state: GameState, delta: number): MonsterData[] {
  if (state.gameOver || state.won) return [];

  // ── 스테이지 타이머 ──────────────────────────────────────────────────────────
  state.stageTimeRemaining -= delta;
  if (state.stageTimeRemaining <= 0) {
    const nextStage = state.stage + 1;
    if (nextStage > STAGES.length) {
      state.won = true;
      return [];
    }
    state.stage = nextStage;
    state.stageTimeRemaining = STAGES[nextStage - 1].duration;
    state.spawnTimers   = { warrok: 0, jery: 0, mutent: 0 };
    state.spawnedCounts = { warrok: 0, jery: 0, mutent: 0 };
  }

  // ── 몬스터 스폰 ──────────────────────────────────────────────────────────────
  const stageDef = STAGES[state.stage - 1];
  const spawned: MonsterData[] = [];

  for (const cfg of stageDef.monsters) {
    state.spawnTimers[cfg.type] += delta;
    if (state.spawnTimers[cfg.type] < cfg.spawnInterval) continue;
    state.spawnTimers[cfg.type] -= cfg.spawnInterval;

    if (cfg.maxCount !== undefined && state.spawnedCounts[cfg.type] >= cfg.maxCount) continue;

    const def = getMonsterDef(cfg.type);
    const monster: MonsterData = {
      id: state.nextMonsterId++,
      monsterType: cfg.type,
      hp: def.hp,
      maxHp: def.hp,
      speed: def.speed,
      progress: 0,
    };
    state.monsters.push(monster);
    state.spawnedCounts[cfg.type]++;
    spawned.push(monster);
  }

  return spawned;
}
