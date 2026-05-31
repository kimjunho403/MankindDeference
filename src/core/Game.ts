import * as THREE from 'three';
import { createGameState, type GameState, type SoldierData } from './state/GameState';
import { randomSoldierPosition } from './systems/TrackSystem';
import { updateSpawn } from './systems/SpawnSystem';
import { updateMonsterMovement, updateCombat, updateSoldierMovement } from './systems/CombatSystem';
import { EntityRenderer } from '../character/EntityRenderer';
import { EffectsRenderer } from '../effects/EffectsRenderer';
import { loadAllMonsterTemplates } from '../character/MonsterRegistry';
import { loadAllTemplates, randomSoldierType, getCharacterDef } from '../character/CharacterRegistry';
import { rollGrade, getGradeDef } from './systems/GradeDefs';
import { createRenderer } from './RendererFactory';
import { buildScene } from '../Map/MapBuilder';
import { CameraController } from '../camera/CameraController';
import { InputController } from '../input/InputController';
import { CommandHandler } from '../input/CommandHandler';
import { HUD } from '../ui/HUD';

const SOLDIER_COST = 20;

export class Game {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderer!: any;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private state!: GameState;
  private entityRenderer!: EntityRenderer;
  private effectsRenderer!: EffectsRenderer;
  private cameraCtrl!: CameraController;
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

    this.cameraCtrl = new CameraController();
    this.cameraCtrl.register((aspect, w, h) => {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
    this.cameraCtrl.updateCamera(this.camera);

    this.input = new InputController();
    this.input.register(canvas, cmd.onSelectionRect, cmd.onClick, cmd.onDeselect);

    const [monsterTemplates, soldierTemplates] = await Promise.all([
      loadAllMonsterTemplates(),
      loadAllTemplates(),
    ]);
    this.entityRenderer  = new EntityRenderer(this.scene, monsterTemplates, soldierTemplates);
    this.effectsRenderer = new EffectsRenderer(this.scene);
    cmd.onMoveIssued = (pt) => this.effectsRenderer.spawnMoveEffect(pt);
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
    this.cameraCtrl.updateCamera(this.camera);
    if (!this.state.gameOver && !this.state.won) this.update(delta);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.loop);
  };

  // ── Update ────────────────────────────────────────────────────────────────

  private update(delta: number): void {
    this.state.gold += this.state.goldPerSecond * delta;

    const newMonsters = updateSpawn(this.state, delta);
    for (const m of newMonsters) this.entityRenderer.addMonster(m);

    updateMonsterMovement(this.state, delta);
    updateSoldierMovement(this.state, delta);

    if (this.state.monsters.length >= 100) this.state.gameOver = true;

    const { deadIds, attacks } = updateCombat(this.state, delta);
    for (const id of deadIds) this.entityRenderer.removeMonster(id);

    this.entityRenderer.updateMonsters(this.state.monsters);
    this.entityRenderer.updateSoldierVisuals(this.state.soldiers, delta);
    this.entityRenderer.updateSoldiers(attacks, delta);
    this.effectsRenderer.showAttacks(attacks);
    this.effectsRenderer.tickProjectiles(delta);
    this.effectsRenderer.tickPendingHits(delta);
    this.effectsRenderer.tickParticles(delta);
    this.effectsRenderer.tickMoveEffects(delta);
    this.entityRenderer.tickAnimations(delta);

    this.hud.update(this.state);
  }

  // ── Soldier spawn ─────────────────────────────────────────────────────────

  private trySpawnSoldier(): void {
    if (this.state.gold < SOLDIER_COST || this.state.gameOver) return;
    this.state.gold -= SOLDIER_COST;

    const soldierType = randomSoldierType();
    const def = getCharacterDef(soldierType);
    const grade = rollGrade();
    const gradeDef = getGradeDef(grade);
    const m = gradeDef.multipliers;
    const pos = randomSoldierPosition();

    const soldier: SoldierData = {
      id: this.state.nextSoldierId++,
      soldierType,
      grade,
      weaponType:     def.weaponType,
      attackDamage:   def.stats.attackDamage  * m.attackDamage,
      attackRange:    def.stats.attackRange   * m.attackRange,
      attackCooldown: 0,
      attackSpeed:    def.stats.attackSpeed   * m.attackSpeed,
      attackHitDelay: def.attackHitDelay ?? 0,
      position:       pos,
      moveTarget:     null,
      moveSpeed:      def.stats.moveSpeed     * m.moveSpeed,
      selected:       false,
      targetId:       null,
    };
    this.state.soldiers.push(soldier);
    this.entityRenderer.addSoldier(soldier);
    this.hud.showSpawnNotification(def.label, gradeDef.label, gradeDef.color);
  }
}
