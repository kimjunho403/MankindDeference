import type { GameState, WeaponType } from '../state/GameState';
import { progressToPosition, distance2D } from './TrackSystem';

export interface AttackEvent {
  soldierId: number;
  soldierPos: { x: number; z: number };
  monsterPos: { x: number; z: number };
  weaponType: WeaponType;
  hitDelay: number;  // 데미지 판정까지의 딜레이 (초). 0이면 즉시
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

  // ── 1. 비행 중인 데미지 타이머 처리 (근접 타격 구간 진입 시 실제 피해 적용) ──
  for (let i = state.pendingDamages.length - 1; i >= 0; i--) {
    const pd = state.pendingDamages[i];
    pd.timer -= delta;
    if (pd.timer > 0) continue;
    state.pendingDamages.splice(i, 1);
    const target = state.monsters.find(m => m.id === pd.monsterId);
    if (!target || target.hp <= 0) continue;
    target.hp -= pd.damage;
    if (target.hp <= 0) {
      deadIds.push(target.id);
      state.gold += 10;
    }
  }

  // ── 2. 병사 공격 처리 ──────────────────────────────────────────────────────────
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
        const hitDelay = soldier.attackHitDelay;
        const damage = soldier.attackDamage * (1 + state.upgrades[soldier.trait]);

        if (hitDelay > 0) {
          // 선딜레이 후 타격 구간에서 피해 적용
          state.pendingDamages.push({ timer: hitDelay, monsterId: target.id, damage });
        } else {
          target.hp -= damage;
          if (target.hp <= 0) {
            deadIds.push(target.id);
            state.gold += 10;
            soldier.targetId = null;
          }
        }

        attacks.push({ soldierId: soldier.id, soldierPos: soldier.position, monsterPos: mPos, weaponType: soldier.weaponType, hitDelay });
      }
    }
  }

  if (deadIds.length > 0) state.monsters = state.monsters.filter(m => !deadIds.includes(m.id));

  return { deadIds, attacks };
}
