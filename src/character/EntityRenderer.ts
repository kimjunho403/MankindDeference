import * as THREE from 'three';
import type { MonsterData, SoldierData, SoldierType, MonsterType } from '../core/state/GameState';
import { progressToPosition } from '../core/systems/TrackSystem';
import type { AttackEvent } from '../core/systems/CombatSystem';
import type { MonsterTemplate } from './MonsterLoader';
import { createMonsterInstance } from './MonsterLoader';
import type { SoldierTemplate, SoldierInstance } from './SoldierTypes';
import { createSoldierInstance, playAttack, playWalk, playIdle } from './SoldierTypes';

const ROTATE_SPEED = 8; // rad/s

function lerpAngle(current: number, target: number, speed: number, delta: number): number {
  let diff = target - current;
  while (diff >  Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const maxStep = speed * delta;
  return Math.abs(diff) <= maxStep ? target : current + Math.sign(diff) * maxStep;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface MonsterMeshData {
  group: THREE.Group;
  model: THREE.Object3D;
  hpFill: THREE.Mesh;
  mixer: THREE.AnimationMixer;
}

interface SoldierMeshData {
  group: THREE.Group;
  instance: SoldierInstance;
  selectionMesh?: THREE.Mesh;
  rangeRing: THREE.Mesh;
  targetAngle: number;
}

// ── EntityRenderer ────────────────────────────────────────────────────────────

export class EntityRenderer {
  private monsters = new Map<number, MonsterMeshData>();
  private soldiers = new Map<number, SoldierMeshData>();
  private showRangeRings = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly monsterTemplates: Map<MonsterType, MonsterTemplate>,
    private readonly soldierTemplates: Map<SoldierType, SoldierTemplate>,
  ) {}

  // ── Monster ───────────────────────────────────────────────────────────────

  addMonster(monster: MonsterData): void {
    const group = new THREE.Group();

    const template = this.monsterTemplates.get(monster.monsterType);
    if (!template) { console.warn(`No template for monster: ${monster.monsterType}`); return; }
    const { model, mixer } = createMonsterInstance(template);
    model.traverse(obj => { if (obj instanceof THREE.Mesh) obj.castShadow = true; });
    group.add(model);

    const HP_BAR_W = 1.0;
    const HP_BAR_H = 0.1;
    const HP_Y     = 2.2;

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

      const theta = monster.progress * Math.PI * 2;
      data.model.rotation.y = Math.atan2(-Math.sin(theta), Math.cos(theta));

      const ratio = Math.max(0, monster.hp / monster.maxHp);
      data.hpFill.scale.x = ratio;
      data.hpFill.position.x = (ratio - 1) * 0.5;
      (data.hpFill.material as THREE.MeshBasicMaterial).color.setHSL(ratio * 0.33, 1, 0.5);
    }
  }

  // ── Soldier ───────────────────────────────────────────────────────────────

  addSoldier(soldier: SoldierData): void {
    const template = this.soldierTemplates.get(soldier.soldierType);
    if (!template) {
      console.warn(`No template for soldierType: ${soldier.soldierType}`);
      return;
    }

    const group = new THREE.Group();
    const instance = createSoldierInstance(template);
    instance.model.traverse(obj => { if (obj instanceof THREE.Mesh) obj.castShadow = true; });
    group.add(instance.model);

    const sel = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.32, 24),
      new THREE.MeshBasicMaterial({ color: 0x88ccff }),
    );
    sel.rotation.x = -Math.PI / 2;
    sel.position.y = 0.02;
    sel.visible = false;
    group.add(sel);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(soldier.attackRange - 0.05, soldier.attackRange, 48),
      new THREE.MeshBasicMaterial({ color: 0x3377ff, opacity: 0.15, transparent: true, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    ring.visible = this.showRangeRings;
    group.add(ring);

    group.position.set(soldier.position.x, 0, soldier.position.z);
    this.scene.add(group);

    this.soldiers.set(soldier.id, { group, instance, selectionMesh: sel, rangeRing: ring, targetAngle: 0 });
  }

  updateSoldierVisuals(soldiers: SoldierData[], delta: number): void {
    for (const s of soldiers) {
      const data = this.soldiers.get(s.id);
      if (!data) continue;
      const { instance } = data;

      data.group.position.set(s.position.x, 0, s.position.z);
      if (data.selectionMesh) data.selectionMesh.visible = !!s.selected;

      if (s.moveTarget) {
        const dx = s.moveTarget.x - s.position.x;
        const dz = s.moveTarget.z - s.position.z;
        if (Math.hypot(dx, dz) > 1e-4) data.targetAngle = Math.atan2(dx, dz);
        playWalk(instance);
      } else {
        playIdle(instance);
      }

      instance.model.rotation.y = lerpAngle(instance.model.rotation.y, data.targetAngle, ROTATE_SPEED, delta);
    }
  }

  updateSoldiers(attacks: AttackEvent[], delta: number): void {
    for (const attack of attacks) {
      const data = this.soldiers.get(attack.soldierId);
      if (!data) continue;

      const dx = attack.monsterPos.x - attack.soldierPos.x;
      const dz = attack.monsterPos.z - attack.soldierPos.z;
      data.targetAngle = Math.atan2(dx, dz);
      data.instance.model.rotation.y = lerpAngle(data.instance.model.rotation.y, data.targetAngle, ROTATE_SPEED, delta);
      playAttack(data.instance);
    }
  }

  toggleRangeRings(): void {
    this.showRangeRings = !this.showRangeRings;
    for (const data of this.soldiers.values()) {
      data.rangeRing.visible = this.showRangeRings;
    }
  }

  // ── Animations ────────────────────────────────────────────────────────────

  tickAnimations(delta: number): void {
    for (const data of this.monsters.values()) data.mixer.update(delta);
    for (const data of this.soldiers.values()) data.instance.mixer.update(delta);
  }
}
