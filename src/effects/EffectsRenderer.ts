import * as THREE from 'three';
import type { ThrowEvent } from '../core/systems/CombatSystem';
import type { ProjectileHit } from '../core/systems/ProjectileSystem';
import type { ProjectileData } from '../core/state/GameState';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProjectileMesh {
  group: THREE.Group;
  last: THREE.Vector3;   // 직전 위치 (진행 방향 계산용)
  spinSpeed: number;
  disposable: boolean;   // false면 공유 모델이라 geometry/material 해제 안 함
}

interface HitParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface MoveEffect {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
}

interface WeaponEffectHandler {
  createProjectile(): THREE.Group;
  spinSpeed: number;
  disposable?: boolean; // false면 공유 모델 클론이라 해제 안 함 (기본 true)
  instant?: boolean;    // true면 투사체 없음 (근접) — 즉시 타격 이펙트
}

// ── Projectile mesh factories ─────────────────────────────────────────────────

function createArrowMesh(): THREE.Group {
  const arrow = new THREE.Group();

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.38, 6),
    new THREE.MeshBasicMaterial({ color: 0xb8864e }),
  );
  shaft.rotation.x = -Math.PI / 2;
  arrow.add(shaft);

  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.16, 6),
    new THREE.MeshBasicMaterial({ color: 0x555555 }),
  );
  tip.rotation.x = -Math.PI / 2;
  tip.position.z = 0.19 + 0.08;
  arrow.add(tip);

  return arrow;
}

function createShurikenMesh(): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xaaaacc, side: THREE.DoubleSide });

  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 3), mat);
    blade.rotation.z = (i / 4) * Math.PI * 2;
    blade.position.x = Math.sin((i / 4) * Math.PI * 2) * 0.07;
    blade.position.y = Math.cos((i / 4) * Math.PI * 2) * 0.07;
    group.add(blade);
  }

  group.add(new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.03, 8),
    new THREE.MeshBasicMaterial({ color: 0x888899 }),
  ));

  return group;
}

// 로드된 GLB 모델을 투사체로 던지는 팩토리 (돌/창 등). 모델 geometry는 공유(클론).
// orientLong=true면 모델을 중앙 정렬하고 가장 긴 축을 비행 방향(+Z)에 맞춤 (창처럼 길쭉한 무기용).
function modelProjectileFactory(
  source: THREE.Object3D,
  targetSize: number,
  orientLong = false,
): () => THREE.Group {
  const box = new THREE.Box3().setFromObject(source);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = targetSize / (Math.max(size.x, size.y, size.z) || 1);

  return () => {
    const group = new THREE.Group();
    const mesh = source.clone(true);
    mesh.scale.setScalar(scale);

    if (orientLong) {
      // 모델을 자기 중심으로 이동(inner 원점에 정렬) 후 가장 긴 축을 +Z로 회전
      mesh.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
      const inner = new THREE.Group();
      inner.add(mesh);
      if (size.y >= size.x && size.y >= size.z)      inner.rotation.x = -Math.PI / 2; // Y축이 길면 Y→Z
      else if (size.x >= size.y && size.x >= size.z) inner.rotation.y = -Math.PI / 2; // X축이 길면 X→Z
      group.add(inner);
    } else {
      group.add(mesh);
    }
    return group;
  };
}

// ── EffectsRenderer ───────────────────────────────────────────────────────────

export class EffectsRenderer {
  private projectileMeshes = new Map<number, ProjectileMesh>();
  private hitParticles: HitParticle[] = [];
  private moveEffects: MoveEffect[] = [];
  private readonly weaponHandlers = new Map<string, WeaponEffectHandler>();

  // projectileModels: weaponType별 던질 GLB 모델 (예: { rock: 돌.glb scene })
  constructor(
    private readonly scene: THREE.Scene,
    projectileModels: Record<string, THREE.Object3D> = {},
  ) {
    this.weaponHandlers.set('arrow',    { createProjectile: createArrowMesh,    spinSpeed: 0 });
    this.weaponHandlers.set('shuriken', { createProjectile: createShurikenMesh, spinSpeed: 18 });
    this.weaponHandlers.set('melee',    { createProjectile: () => new THREE.Group(), spinSpeed: 0, instant: true });

    // 돌 던지기 (원거리 원시인) — 회전 텀블링
    if (projectileModels.rock) {
      this.weaponHandlers.set('rock', {
        createProjectile: modelProjectileFactory(projectileModels.rock, 0.18),
        spinSpeed: 12, disposable: false,
      });
    }
    // 창 던지기 (폭발형 원시인) — 길쭉하니 비행 방향으로 정렬, 회전 없음
    if (projectileModels.spear) {
      this.weaponHandlers.set('spear', {
        createProjectile: modelProjectileFactory(projectileModels.spear, 1.0, true),
        spinSpeed: 0, disposable: false,
      });
    }
  }

  // ── 투사체 ────────────────────────────────────────────────────────────────

  // 근접(instant) 공격의 타격 이펙트. 원거리 투사체는 state 기반으로 syncProjectiles가 렌더.
  showThrows(throws: ThrowEvent[]): void {
    for (const ev of throws) {
      if (this.weaponHandlers.get(ev.weaponType)?.instant) {
        this.spawnBloodSplash(new THREE.Vector3(ev.targetPos.x, 0.8, ev.targetPos.z));
      }
    }
  }

  // 투사체 명중 이펙트 (ProjectileSystem이 명중 판정 → 위치 전달)
  showHits(hits: ProjectileHit[]): void {
    for (const h of hits) this.spawnBloodSplash(new THREE.Vector3(h.x, h.y, h.z));
  }

  // 게임 상태의 투사체 목록과 메쉬를 동기화 (생성/이동/제거)
  syncProjectiles(projectiles: ProjectileData[], delta: number): void {
    const alive = new Set<number>();

    for (const p of projectiles) {
      alive.add(p.id);
      let pm = this.projectileMeshes.get(p.id);
      if (!pm) {
        const handler = this.weaponHandlers.get(p.weaponType) ?? this.weaponHandlers.get('arrow')!;
        const group = handler.createProjectile();
        group.position.set(p.x, p.y, p.z);
        this.scene.add(group);
        pm = { group, last: new THREE.Vector3(p.x, p.y, p.z), spinSpeed: handler.spinSpeed, disposable: handler.disposable ?? true };
        this.projectileMeshes.set(p.id, pm);
        continue;
      }
      const pos = new THREE.Vector3(p.x, p.y, p.z);
      const dir = pos.clone().sub(pm.last);
      if (dir.lengthSq() > 1e-8) pm.group.lookAt(pos.clone().add(dir)); // 진행 방향으로 정렬
      pm.group.position.copy(pos);
      if (pm.spinSpeed > 0) pm.group.rotateZ(pm.spinSpeed * delta);
      pm.last.copy(pos);
    }

    // state에서 사라진 투사체의 메쉬 제거
    for (const [id, pm] of this.projectileMeshes) {
      if (alive.has(id)) continue;
      this.scene.remove(pm.group);
      if (pm.disposable) {
        pm.group.traverse((obj: THREE.Object3D) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            (obj.material as THREE.Material).dispose();
          }
        });
      }
      this.projectileMeshes.delete(id);
    }
  }

  // ── 이동 명령 이펙트 ──────────────────────────────────────────────────────

  spawnMoveEffect(point: THREE.Vector3): void {
    const y = 0.025;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.36, 32),
      new THREE.MeshBasicMaterial({ color: 0x44ffaa, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(point.x, y, point.z);
    ring.scale.setScalar(0.3);
    this.scene.add(ring);
    this.moveEffects.push({ mesh: ring, life: 0.5, maxLife: 0.5, startScale: 0.3, endScale: 1.6 });

    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.15, 16),
      new THREE.MeshBasicMaterial({ color: 0x44ffaa, transparent: true, opacity: 0.6 }),
    );
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(point.x, y, point.z);
    this.scene.add(dot);
    this.moveEffects.push({ mesh: dot, life: 0.2, maxLife: 0.2, startScale: 1, endScale: 1 });
  }

  tickMoveEffects(delta: number): void {
    for (let i = this.moveEffects.length - 1; i >= 0; i--) {
      const e = this.moveEffects[i];
      e.life -= delta;
      if (e.life <= 0) {
        this.scene.remove(e.mesh);
        e.mesh.geometry.dispose();
        (e.mesh.material as THREE.Material).dispose();
        this.moveEffects.splice(i, 1);
        continue;
      }
      const t = 1 - e.life / e.maxLife;
      e.mesh.scale.setScalar(e.startScale + (e.endScale - e.startScale) * t);
      (e.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * (e.startScale === 1 ? 0.6 : 0.9);
    }
  }

  // ── 히트 파티클 ───────────────────────────────────────────────────────────

  tickParticles(delta: number): void {
    for (let i = this.hitParticles.length - 1; i >= 0; i--) {
      const p = this.hitParticles[i];
      p.velocity.y -= 9.8 * delta;
      p.mesh.position.addScaledVector(p.velocity, delta);
      p.life -= delta;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.hitParticles.splice(i, 1);
      }
    }
  }

  private spawnBloodSplash(pos: THREE.Vector3): void {
    const COUNT = 7;
    for (let i = 0; i < COUNT; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xcc1111, transparent: true, opacity: 1 }),
      );
      mesh.position.copy(pos);
      this.scene.add(mesh);

      const angle = (i / COUNT) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 1.5 + Math.random() * 2;
      const maxLife = 0.3 + Math.random() * 0.1;
      this.hitParticles.push({
        mesh,
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          1.5 + Math.random() * 2,
          Math.sin(angle) * speed,
        ),
        life: maxLife,
        maxLife,
      });
    }
  }
}
