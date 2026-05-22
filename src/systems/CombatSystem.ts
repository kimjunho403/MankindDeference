import type { GameState } from '../state/GameState';
import { progressToPosition, distance2D } from './TrackSystem';

export interface AttackEvent {
  soldierId: number;
  soldierPos: { x: number; z: number };
  monsterPos: { x: number; z: number };
}

export interface CombatResult {
  deadIds: number[];
  attacks: AttackEvent[];
}

export function updateMonsterMovement(state: GameState, delta: number): void {
  for (const monster of state.monsters) {
    monster.progress += monster.speed * delta;
    if (monster.progress >= 1) monster.progress -= 1;
  }
}

export function updateCombat(state: GameState, delta: number): CombatResult {
  const attacks: AttackEvent[] = [];
  const deadIds: number[] = [];

  for (const soldier of state.soldiers) {
    // Drop invalid target (dead or out of range)
    if (soldier.targetId !== null) {
      const target = state.monsters.find(m => m.id === soldier.targetId);
      if (!target || target.hp <= 0) {
        soldier.targetId = null;
      } else {
        const mPos = progressToPosition(target.progress);
        if (distance2D(soldier.position, mPos) > soldier.attackRange) {
          soldier.targetId = null;
        }
      }
    }

    // Acquire nearest monster in range
    if (soldier.targetId === null) {
      let nearestDist = Infinity;
      for (const monster of state.monsters) {
        if (monster.hp <= 0) continue;
        const mPos = progressToPosition(monster.progress);
        const dist = distance2D(soldier.position, mPos);
        if (dist <= soldier.attackRange && dist < nearestDist) {
          nearestDist = dist;
          soldier.targetId = monster.id;
        }
      }
    }

    // Attack on cooldown
    soldier.attackCooldown = Math.max(0, soldier.attackCooldown - delta);

    if (soldier.targetId !== null && soldier.attackCooldown === 0) {
      const target = state.monsters.find(m => m.id === soldier.targetId);
      if (target) {
        const mPos = progressToPosition(target.progress);
        soldier.attackCooldown = 1 / soldier.attackSpeed;
        target.hp -= soldier.attackDamage;
        attacks.push({ soldierId: soldier.id, soldierPos: soldier.position, monsterPos: mPos });

        if (target.hp <= 0) {
          deadIds.push(target.id);
          state.gold += 10;
          soldier.targetId = null;
        }
      }
    }
  }

  // Remove dead monsters from state
  if (deadIds.length > 0) {
    state.monsters = state.monsters.filter(m => !deadIds.includes(m.id));
  }

  return { deadIds, attacks };
}
