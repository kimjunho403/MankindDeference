import * as THREE from 'three';
import { createGameState, type GameState, type SoldierData } from './state/GameState';
import { randomSoldierPosition } from './systems/TrackSystem';
import { updateSpawn } from './systems/SpawnSystem';
import { updateMonsterMovement, updateCombat, updateSoldierMovement } from './systems/CombatSystem';
import { EntityRenderer } from './rendering/EntityRenderer';
import { loadMonsterTemplate } from './rendering/MonsterLoader';
import { loadAllTemplates, randomSoldierType, getCharacterDef } from './rendering/CharacterRegistry';
import { createRenderer } from './rendering/RendererFactory';
import { buildScene } from './Map/MapBuilder';
import { InputController } from './input/InputController';
import { CommandHandler } from './input/CommandHandler';
import { HUD } from './ui/HUD';

const SOLDIER_COST = 20;

export class Game {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderer!: any;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private state!: GameState;
  private entityRenderer!: EntityRenderer;
  private input!: InputController;
  private hud!: HUD;
  private lastTime = 0;

  // ── Init ──────────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    this.state = createGameState();

    const bundle = await createRenderer();
    this.renderer = bundle.renderer;
    this.scene    = bundle.scene;
    this.camera   = bundle.camera;

    buildScene(this.scene);

    const canvas = this.renderer.domElement as HTMLCanvasElement;
    const cmd    = new CommandHandler(canvas, this.state, () => this.camera);

    this.input = new InputController();
    this.input.register(
      canvas,
      (aspect, w, h) => {
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
      },
      cmd.onSelectionRect,
      cmd.onClick,
      cmd.onDeselect,
    );
    this.input.updateCamera(this.camera);

    const [monsterTemplate, soldierTemplates] = await Promise.all([
      loadMonsterTemplate(),
      loadAllTemplates(),
    ]);
    this.entityRenderer = new EntityRenderer(this.scene, monsterTemplate, soldierTemplates);
    cmd.registerDebugKeys(() => this.entityRenderer.toggleRangeRings());

    this.hud = new HUD();
    this.hud.onSpawnSoldier(() => this.trySpawnSoldier());

    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'none';
  }

  // ── Loop ──────────────────────────────────────────────────────────────────

  start(): void {
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  private loop = (time: number): void => {
    const delta = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    this.input.updateCamera(this.camera);
    if (!this.state.gameOver) this.update(delta);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.loop);
  };

  // ── Update ────────────────────────────────────────────────────────────────

  private update(delta: number): void {
    this.state.gold += this.state.goldPerSecond * delta;

    const newMonster = updateSpawn(this.state, delta);
    if (newMonster) this.entityRenderer.addMonster(newMonster);

    updateMonsterMovement(this.state, delta);
    updateSoldierMovement(this.state, delta);

    if (this.state.monsters.length >= 100) this.state.gameOver = true;

    const { deadIds, attacks } = updateCombat(this.state, delta);
    for (const id of deadIds) this.entityRenderer.removeMonster(id);

    this.entityRenderer.updateMonsters(this.state.monsters);
    this.entityRenderer.updateSoldierVisuals(this.state.soldiers);
    this.entityRenderer.updateSoldiers(attacks);
    this.entityRenderer.showAttacks(attacks);
    this.entityRenderer.tickArrows(delta);
    this.entityRenderer.tickParticles(delta);
    this.entityRenderer.tickAnimations(delta);

    this.hud.update(this.state);
  }

  // ── Soldier spawn ─────────────────────────────────────────────────────────

  private trySpawnSoldier(): void {
    if (this.state.gold < SOLDIER_COST || this.state.gameOver) return;
    this.state.gold -= SOLDIER_COST;

    const soldierType = randomSoldierType();
    const def = getCharacterDef(soldierType);
    const pos = randomSoldierPosition();

    const soldier: SoldierData = {
      id: this.state.nextSoldierId++,
      soldierType,
      weaponType:    def.weaponType,
      attackDamage:  def.stats.attackDamage,
      attackRange:   def.stats.attackRange,
      attackCooldown: 0,
      attackSpeed:   def.stats.attackSpeed,
      position:      pos,
      moveTarget:    null,
      moveSpeed:     def.stats.moveSpeed,
      selected:      false,
      targetId:      null,
    };
    this.state.soldiers.push(soldier);
    this.entityRenderer.addSoldier(soldier);
  }
}
