import type { GameState, WeaponType } from '../state/GameState';
import { progressToPosition } from './TrackSystem';

const HIT_RADIUS = 0.35;        // 이 거리 안에 들어오면 명중
const TARGET_Y   = 0.8;         // 몬스터 피격 높이
const DEFAULT_SPEED = 12;

// weaponType별 비행 속도 (units/sec). 몬스터보다 빨라야 유도가 따라잡음.
const PROJECTILE_SPEED: Partial<Record<WeaponType, number>> = {
  arrow: 16, shuriken: 16, rock: 10, spear: 14,
};

export interface ProjectileHit {
  x: number; y: number; z: number;
  weaponType: WeaponType;
}

export function spawnProjectile(
  state: GameState,
  from: { x: number; y: number; z: number },
  targetId: number,
  damage: number,
  weaponType: WeaponType,
): void {
  state.projectiles.push({
    id: state.nextProjectileId++,
    weaponType, damage, targetId,
    x: from.x, y: from.y, z: from.z,
    speed: PROJECTILE_SPEED[weaponType] ?? DEFAULT_SPEED,
  });
}

// 매 프레임: 각 투사체를 타겟 현재 위치로 유도. 명중 시 피해, 타겟 소멸 시 투사체 제거.
export function updateProjectiles(state: GameState, delta: number): { deadIds: number[]; hits: ProjectileHit[] } {
  const deadIds: number[] = [];
  const hits: ProjectileHit[] = [];

  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    const target = state.monsters.find(m => m.id === p.targetId);
    if (!target || target.hp <= 0) {
      state.projectiles.splice(i, 1);  // 타겟 소멸 → 투사체도 사라짐
      continue;
    }

    const tp = progressToPosition(target.progress);
    const dx = tp.x - p.x;
    const dy = TARGET_Y - p.y;
    const dz = tp.z - p.z;
    const dist = Math.hypot(dx, dy, dz);
    const step = p.speed * delta;

    if (dist <= Math.max(step, HIT_RADIUS)) {
      // 명중
      target.hp -= p.damage;
      hits.push({ x: tp.x, y: TARGET_Y, z: tp.z, weaponType: p.weaponType });
      if (target.hp <= 0) {
        deadIds.push(target.id);
        state.gold += 10;
      }
      state.projectiles.splice(i, 1);
    } else {
      p.x += (dx / dist) * step;
      p.y += (dy / dist) * step;
      p.z += (dz / dist) * step;
    }
  }

  if (deadIds.length > 0) state.monsters = state.monsters.filter(m => !deadIds.includes(m.id));
  return { deadIds, hits };
}
