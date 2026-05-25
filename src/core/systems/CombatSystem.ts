import type { GameState, WeaponType } from '../state/GameState';
import { progressToPosition, distance2D } from './TrackSystem';

export interface AttackEvent {
  soldierId: number;
  soldierPos: { x: number; z: number };
  monsterPos: { x: number; z: number };
  weaponType: WeaponType;
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

export function updateSoldierMovement(state: GameState, delta: number): void {
  for (const soldier of state.soldiers) {
    if (!soldier.moveTarget) continue;
    const dx = soldier.moveTarget.x - soldier.position.x;
    const dz = soldier.moveTarget.z - soldier.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1e-3) { soldier.moveTarget = null; continue; }
    const maxStep = soldier.moveSpeed * delta;
    if (dist <= maxStep) {
      soldier.position.x = soldier.moveTarget.x;
      soldier.position.z = soldier.moveTarget.z;
      soldier.moveTarget = null;
    } else {
      soldier.position.x += (dx / dist) * maxStep;
      soldier.position.z += (dz / dist) * maxStep;
    }
  }

  const minDist = 0.6;
  for (let i = 0; i < state.soldiers.length; i++) {
    for (let j = i + 1; j < state.soldiers.length; j++) {
      const a = state.soldiers[i];
      const b = state.soldiers[j];
      const dx = b.position.x - a.position.x;
      const dz = b.position.z - a.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0 && d < minDist) {
        const overlap = (minDist - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        a.position.x -= nx * overlap;
        a.position.z -= nz * overlap;
        b.position.x += nx * overlap;
        b.position.z += nz * overlap;
        if (a.moveTarget && Math.hypot(a.moveTarget.x - a.position.x, a.moveTarget.z - a.position.z) < 1e-3) a.moveTarget = null;
        if (b.moveTarget && Math.hypot(b.moveTarget.x - b.position.x, b.moveTarget.z - b.position.z) < 1e-3) b.moveTarget = null;
      }
    }
  }
}

export function updateCombat(state: GameState, delta: number): CombatResult {
  const attacks: AttackEvent[] = [];
  const deadIds: number[] = [];

  for (const soldier of state.soldiers) {
    if (soldier.moveTarget) continue;

    if (soldier.targetId !== null) {
      const target = state.monsters.find(m => m.id === soldier.targetId);
      if (!target || target.hp <= 0) {
        soldier.targetId = null;
      } else {
        const mPos = progressToPosition(target.progress);
        if (distance2D(soldier.position, mPos) > soldier.attackRange) soldier.targetId = null;
      }
    }

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

    soldier.attackCooldown = Math.max(0, soldier.attackCooldown - delta);

    if (soldier.targetId !== null && soldier.attackCooldown === 0) {
      const target = state.monsters.find(m => m.id === soldier.targetId);
      if (target) {
        const mPos = progressToPosition(target.progress);
        soldier.attackCooldown = 1 / soldier.attackSpeed;
        target.hp -= soldier.attackDamage;
        attacks.push({ soldierId: soldier.id, soldierPos: soldier.position, monsterPos: mPos, weaponType: soldier.weaponType });
        if (target.hp <= 0) {
          deadIds.push(target.id);
          state.gold += 10;
          soldier.targetId = null;
        }
      }
    }
  }

  if (deadIds.length > 0) state.monsters = state.monsters.filter(m => !deadIds.includes(m.id));

  return { deadIds, attacks };
}
