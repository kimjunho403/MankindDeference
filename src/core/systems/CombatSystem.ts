import type { GameState, WeaponType } from '../state/GameState';
import { progressToPosition, distance2D } from './TrackSystem';
import { spawnProjectile } from './ProjectileSystem';

// 공격 모션 시작 (애니메이션/조준용). 실제 발동은 ThrowEvent에서.
export interface AttackStartEvent {
  soldierId: number;
  soldierPos: { x: number; z: number };
  monsterPos: { x: number; z: number };
  weaponType: WeaponType;
}

// 실제 발동(던지기/타격) — 사정거리 확인을 통과한 경우에만 발생. 투사체/무기 숨김/피해.
export interface ThrowEvent {
  soldierId: number;
  soldierPos: { x: number; z: number };
  targetPos: { x: number; z: number };  // 발동 시점의 타겟 위치 (계속 추적됨)
  weaponType: WeaponType;
}

export interface CombatResult {
  deadIds: number[];
  attackStarts: AttackStartEvent[];
  throws: ThrowEvent[];
  cancels: number[];  // 발동 직전 사정거리 이탈로 취소된 soldierId (애니 중단용)
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
  const attackStarts: AttackStartEvent[] = [];
  const throws: ThrowEvent[] = [];
  const deadIds: number[] = [];
  const cancels: number[] = [];

  // 발동 처리: 사정거리 안에 타겟이 남아있으면 피해+ThrowEvent(true), 벗어났으면 취소(false)
  const resolveThrow = (
    soldierId: number, targetId: number, damage: number, weaponType: WeaponType, attackRange: number,
  ): boolean => {
    const soldier = state.soldiers.find(s => s.id === soldierId);
    if (!soldier) return false;
    const target = state.monsters.find(m => m.id === targetId);
    if (!target || target.hp <= 0) return false;                       // 타겟 사망 → 취소
    const mPos = progressToPosition(target.progress);
    if (distance2D(soldier.position, mPos) > attackRange) return false; // 사정거리 이탈 → 취소

    if (weaponType === 'melee') {
      // 근접: 즉시 피해
      target.hp -= damage;
      if (target.hp <= 0) {
        deadIds.push(target.id);
        state.gold += 10;
        if (soldier.targetId === target.id) soldier.targetId = null;
      }
    } else {
      // 원거리: 유도 투사체 생성 (피해는 명중 시 ProjectileSystem에서)
      spawnProjectile(state, { x: soldier.position.x, y: 1.2, z: soldier.position.z }, target.id, damage, weaponType);
    }
    throws.push({ soldierId, soldierPos: soldier.position, targetPos: mPos, weaponType });
    return true;
  };

  // ── 1. 선딜레이(windup) 진행 → 만료 시 발동/취소 ──
  for (let i = state.pendingAttacks.length - 1; i >= 0; i--) {
    const pa = state.pendingAttacks[i];
    pa.timer -= delta;
    if (pa.timer > 0) continue;
    state.pendingAttacks.splice(i, 1);
    if (!resolveThrow(pa.soldierId, pa.targetId, pa.damage, pa.weaponType, pa.attackRange)) {
      cancels.push(pa.soldierId);  // 발동 실패 → 애니 중단
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
        const damage = soldier.attackDamage * (1 + state.upgrades[soldier.soldierType]);

        // 공격 모션 시작 (애니/조준). 실제 발동은 hitDelay 후 사정거리 재확인.
        attackStarts.push({ soldierId: soldier.id, soldierPos: soldier.position, monsterPos: mPos, weaponType: soldier.weaponType });

        if (soldier.attackHitDelay > 0) {
          state.pendingAttacks.push({
            soldierId: soldier.id, targetId: target.id, timer: soldier.attackHitDelay,
            damage, weaponType: soldier.weaponType, attackRange: soldier.attackRange,
          });
        } else {
          resolveThrow(soldier.id, target.id, damage, soldier.weaponType, soldier.attackRange);
        }
      }
    }
  }

  if (deadIds.length > 0) state.monsters = state.monsters.filter(m => !deadIds.includes(m.id));

  return { deadIds, attackStarts, throws, cancels };
}
