import * as THREE from 'three';
import type { MonsterData, SoldierData } from '../state/GameState';
import { progressToPosition } from '../systems/TrackSystem';
import type { AttackEvent } from '../systems/CombatSystem';
import type { MonsterTemplate } from './MonsterLoader';
import { createMonsterInstance } from './MonsterLoader';
import type { ArcherTemplate, ArcherInstance } from './ArcherLoader';
import { createArcherInstance, playShot } from './ArcherLoader';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MonsterMeshData {
  /** Outer group — positioned at track location */
  group: THREE.Group;
  /** Cloned model — rotated to face movement direction */
  model: THREE.Object3D;
  hpFill: THREE.Mesh;
  mixer: THREE.AnimationMixer;
}

interface SoldierMeshData {
  group: THREE.Group;
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  idleAction: THREE.AnimationAction;
  shotAction: THREE.AnimationAction;
  selectionMesh?: THREE.Mesh;
  walkAction: THREE.AnimationAction;
}

interface Projectile {
  mesh: THREE.Group;
  from: THREE.Vector3;
  to: THREE.Vector3;
  progress: number;
  duration: number;
  arcHeight: number;
  weaponType: string;
}

interface HitParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface WeaponEffectHandler {
  createProjectile(): THREE.Group;
  onHit(pos: THREE.Vector3): void;
}



function createArrowMesh(): THREE.Group {
  const arrow = new THREE.Group();

  // Shaft: thin brown cylinder aligned along +Z
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.38, 6),
    new THREE.MeshBasicMaterial({ color: 0xb8864e }),
  );
  shaft.rotation.x = -Math.PI / 2;
  arrow.add(shaft);

  // Tip: dark metal cone — apex points +Z
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.16, 6),
    new THREE.MeshBasicMaterial({ color: 0x555555 }),
  );
  tip.rotation.x = -Math.PI / 2;
  tip.position.z = 0.19 + 0.08; // shaft_half + cone_half
  arrow.add(tip);

  return arrow;
}

// ── EntityRenderer ─────────────────────────────────────────────────────────────

export class EntityRenderer {
  private monsters = new Map<number, MonsterMeshData>();
  private soldiers = new Map<number, SoldierMeshData>();
  private projectiles: Projectile[] = [];
  private hitParticles: HitParticle[] = [];
  private readonly weaponHandlers = new Map<string, WeaponEffectHandler>();

  constructor(
    private scene: THREE.Scene,
    private monsterTemplate: MonsterTemplate,
    private archerTemplate: ArcherTemplate,
  ) {
    this.weaponHandlers.set('arrow', {
      createProjectile: createArrowMesh,
      onHit: (pos) => this.spawnBloodSplash(pos),
    });
  }

  // ── Monster ───────────────────────────────────────────────────────────────

  addMonster(monster: MonsterData): void {
    const group = new THREE.Group();

    const { model, mixer } = createMonsterInstance(this.monsterTemplate);
    model.traverse(obj => { if (obj instanceof THREE.Mesh) obj.castShadow = true; });
    group.add(model);

    const HP_BAR_W = 1.0;
    const HP_BAR_H = 0.1;
    const HP_Y = 2.2;

    const hpBg = new THREE.Mesh(
      new THREE.PlaneGeometry(HP_BAR_W, HP_BAR_H),
      new THREE.MeshBasicMaterial({ color: 0x222222 }),
    );
    hpBg.rotation.x = -Math.PI / 2;
    hpBg.position.set(0, HP_Y, 0);
    group.add(hpBg);

    const hpFill = new THREE.Mesh(
      new THREE.PlaneGeometry(HP_BAR_W, HP_BAR_H),
      new THREE.MeshBasicMaterial({ color: 0x44ee44 }),
    );
    hpFill.rotation.x = -Math.PI / 2;
    hpFill.position.set(0, HP_Y + 0.01, 0);
    group.add(hpFill);

    const pos = progressToPosition(monster.progress);
    group.position.set(pos.x, 0, pos.z);

    this.scene.add(group);
    this.monsters.set(monster.id, { group, model, hpFill, mixer });
  }

  // Update soldier group positions, selection visuals, rotation and walk/idle animation
  updateSoldierVisuals(soldiers: SoldierData[]): void {
    for (const s of soldiers) {
      const data = this.soldiers.get(s.id);
      if (!data) continue;
      data.group.position.set(s.position.x, 0, s.position.z);
      if (data.selectionMesh) data.selectionMesh.visible = !!s.selected;

      // Rotate model toward movement direction when moving
      if (s.moveTarget) {
        const dx = s.moveTarget.x - s.position.x;
        const dz = s.moveTarget.z - s.position.z;
        if (Math.hypot(dx, dz) > 1e-4) {
          data.model.rotation.y = Math.atan2(dx, dz);
        }
        // Play walk animation if available
        if (data.walkAction && !data.walkAction.isRunning()) {
          data.idleAction.stop();
          data.walkAction.reset().play();
        }
      } else {
        // Stop walk and return to idle
        if (data.walkAction && data.walkAction.isRunning()) {
          data.walkAction.stop();
          data.idleAction.reset().play();
        }
      }
    }
  }

  removeMonster(id: number): void {
    const data = this.monsters.get(id);
    if (!data) return;

    data.mixer.stopAllAction();
    this.scene.remove(data.group);
    data.group.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m: THREE.Material) => m.dispose());
      }
    });
    this.monsters.delete(id);
  }

  updateMonsters(monsters: MonsterData[]): void {
    for (const monster of monsters) {
      const data = this.monsters.get(monster.id);
      if (!data) continue;

      const pos = progressToPosition(monster.progress);
      data.group.position.set(pos.x, 0, pos.z);

      // Rotate model to face direction of movement (CCW circle tangent)
      const theta = monster.progress * Math.PI * 2;
      data.model.rotation.y = Math.atan2(-Math.sin(theta), Math.cos(theta));

      // HP bar color + scale
      const ratio = Math.max(0, monster.hp / monster.maxHp);
      data.hpFill.scale.x = ratio;
      data.hpFill.position.x = (ratio - 1) * 0.5;
      (data.hpFill.material as THREE.MeshBasicMaterial).color.setHSL(ratio * 0.33, 1, 0.5);
    }
  }

  // ── Soldier ───────────────────────────────────────────────────────────────

  addSoldier(soldier: SoldierData): void {
    const group = new THREE.Group();

    const instance: ArcherInstance = createArcherInstance(this.archerTemplate);
    instance.model.traverse(obj => { if (obj instanceof THREE.Mesh) obj.castShadow = true; });
    group.add(instance.model);

    // Selection indicator
    const sel = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.32, 24),
      new THREE.MeshBasicMaterial({ color: 0x88ccff }),
    );
    sel.rotation.x = -Math.PI / 2;
    sel.position.y = 0.02;
    sel.visible = false;
    group.add(sel);

    // Semi-transparent attack-range ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(soldier.attackRange - 0.05, soldier.attackRange, 48),
      new THREE.MeshBasicMaterial({
        color: 0x3377ff,
        opacity: 0.15,
        transparent: true,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring);

    group.position.set(soldier.position.x, 0, soldier.position.z);
    this.scene.add(group);

    this.soldiers.set(soldier.id, {
      group,
      model: instance.model,
      mixer: instance.mixer,
      idleAction: instance.idleAction,
      shotAction: instance.shotAction,
      selectionMesh: sel,
      walkAction: instance.walkAction,
    });
  }

  /**
   * Process attack events: rotate each archer toward its target and
   * trigger the shot animation.
   */
  updateSoldiers(attacks: AttackEvent[]): void {
    for (const attack of attacks) {
      const data = this.soldiers.get(attack.soldierId);
      if (!data) continue;

      // Rotate model to face the target (assumes +Z is default model forward)
      const dx = attack.monsterPos.x - attack.soldierPos.x;
      const dz = attack.monsterPos.z - attack.soldierPos.z;
      data.model.rotation.y = Math.atan2(dx, dz);

      playShot(data);
    }
  }

  // ── Animations ────────────────────────────────────────────────────────────

  /** Advance all AnimationMixers (monsters and soldiers) by delta seconds. */
  tickAnimations(delta: number): void {
    for (const data of this.monsters.values()) {
      data.mixer.update(delta);
    }
    for (const data of this.soldiers.values()) {
      data.mixer.update(delta);
    }
  }

  // ── Attack effects ────────────────────────────────────────────────────────

  showAttacks(events: AttackEvent[]): void {
    for (const ev of events) {
      const handler = this.weaponHandlers.get(ev.weaponType);
      const from = new THREE.Vector3(ev.soldierPos.x, 1.2, ev.soldierPos.z);
      const to   = new THREE.Vector3(ev.monsterPos.x, 0.8, ev.monsterPos.z);
      const dist = from.distanceTo(to);
      const arcHeight = Math.max(0.8, dist * 0.2);
      const duration  = 0.1 + dist * 0.01;

      const mesh = handler ? handler.createProjectile() : createArrowMesh();
      mesh.position.copy(from);
      this.scene.add(mesh);
      this.projectiles.push({ mesh, from, to, progress: 0, duration, arcHeight, weaponType: ev.weaponType });
    }
  }

  tickArrows(delta: number): void {
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
    }
  }

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
