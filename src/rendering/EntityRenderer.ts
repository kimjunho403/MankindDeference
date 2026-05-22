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
}

interface AttackLine {
  line: THREE.Line;
  ttl: number;
}

// ── EntityRenderer ─────────────────────────────────────────────────────────────

export class EntityRenderer {
  private monsters = new Map<number, MonsterMeshData>();
  private soldiers = new Map<number, SoldierMeshData>();
  private attackLines: AttackLine[] = [];

  constructor(
    private scene: THREE.Scene,
    private monsterTemplate: MonsterTemplate,
    private archerTemplate: ArcherTemplate,
  ) {}

  // ── Monster ───────────────────────────────────────────────────────────────

  addMonster(monster: MonsterData): void {
    const group = new THREE.Group();

    const { model, mixer } = createMonsterInstance(this.monsterTemplate);
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
    group.add(instance.model);

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
      const points = [
        new THREE.Vector3(ev.soldierPos.x, 0.3, ev.soldierPos.z),
        new THREE.Vector3(ev.monsterPos.x, 0.8, ev.monsterPos.z),
      ];
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: 0xffee44 }),
      );
      this.scene.add(line);
      this.attackLines.push({ line, ttl: 0.1 });
    }
  }

  tickAttackLines(delta: number): void {
    for (let i = this.attackLines.length - 1; i >= 0; i--) {
      this.attackLines[i].ttl -= delta;
      if (this.attackLines[i].ttl <= 0) {
        const { line } = this.attackLines[i];
        this.scene.remove(line);
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
        this.attackLines.splice(i, 1);
      }
    }
  }
}
