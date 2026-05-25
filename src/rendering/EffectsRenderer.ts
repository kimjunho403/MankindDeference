import * as THREE from 'three';
import type { AttackEvent } from '../systems/CombatSystem';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Projectile {
  mesh: THREE.Group;
  from: THREE.Vector3;
  to: THREE.Vector3;
  progress: number;
  duration: number;
  arcHeight: number;
  weaponType: string;
  spinSpeed: number;
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
  arcHeight(dist: number): number;
  flightDuration(dist: number): number;
  spinSpeed: number;
  onHit(pos: THREE.Vector3): void;
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

// ── EffectsRenderer ───────────────────────────────────────────────────────────

export class EffectsRenderer {
  private projectiles: Projectile[] = [];
  private hitParticles: HitParticle[] = [];
  private moveEffects: MoveEffect[] = [];
  private readonly weaponHandlers = new Map<string, WeaponEffectHandler>();

  constructor(private readonly scene: THREE.Scene) {
    this.weaponHandlers.set('arrow', {
      createProjectile: createArrowMesh,
      arcHeight: (dist) => Math.max(0.8, dist * 0.2),
      flightDuration: (dist) => 0.1 + dist * 0.01,
      spinSpeed: 0,
      onHit: (pos) => this.spawnBloodSplash(pos),
    });

    this.weaponHandlers.set('shuriken', {
      createProjectile: createShurikenMesh,
      arcHeight: (dist) => Math.max(0.3, dist * 0.08),
      flightDuration: (dist) => 0.08 + dist * 0.008,
      spinSpeed: 18,
      onHit: (pos) => this.spawnBloodSplash(pos),
    });
  }

  // ── 투사체 ────────────────────────────────────────────────────────────────

  showAttacks(events: AttackEvent[]): void {
    for (const ev of events) {
      const handler = this.weaponHandlers.get(ev.weaponType) ?? this.weaponHandlers.get('arrow')!;
      const from = new THREE.Vector3(ev.soldierPos.x, 1.2, ev.soldierPos.z);
      const to   = new THREE.Vector3(ev.monsterPos.x, 0.8, ev.monsterPos.z);
      const dist = from.distanceTo(to);

      const mesh = handler.createProjectile();
      mesh.position.copy(from);
      this.scene.add(mesh);

      this.projectiles.push({
        mesh, from, to, progress: 0,
        duration: handler.flightDuration(dist),
        arcHeight: handler.arcHeight(dist),
        weaponType: ev.weaponType,
        spinSpeed: handler.spinSpeed,
      });
    }
  }

  tickProjectiles(delta: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.progress += delta / p.duration;

      if (p.progress >= 1) {
        this.scene.remove(p.mesh);
        p.mesh.traverse((obj: THREE.Object3D) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            (obj.material as THREE.Material).dispose();
          }
        });
        this.projectiles.splice(i, 1);
        this.weaponHandlers.get(p.weaponType)?.onHit(p.to);
        continue;
      }

      const t = p.progress;
      const pos = new THREE.Vector3().lerpVectors(p.from, p.to, t);
      pos.y += 4 * p.arcHeight * t * (1 - t);

      const tAhead = Math.min(t + 0.05, 0.99);
      const ahead = new THREE.Vector3().lerpVectors(p.from, p.to, tAhead);
      ahead.y += 4 * p.arcHeight * tAhead * (1 - tAhead);

      p.mesh.position.copy(pos);
      if (ahead.distanceTo(pos) > 1e-4) p.mesh.lookAt(ahead);
      if (p.spinSpeed > 0) p.mesh.rotateZ(p.spinSpeed * delta);
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
