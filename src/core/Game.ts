import * as THREE from 'three';
import { createGameState, type GameState, type SoldierData } from './state/GameState';
import { randomSoldierPosition } from './systems/TrackSystem';
import { updateSpawn } from './systems/SpawnSystem';
import { updateMonsterMovement, updateCombat, updateSoldierMovement } from './systems/CombatSystem';
import { updateProjectiles } from './systems/ProjectileSystem';
import { EntityRenderer } from '../character/EntityRenderer';
import { EffectsRenderer } from '../effects/EffectsRenderer';
import { loadAllMonsterTemplates } from '../character/MonsterRegistry';
import { loadAllTemplates, randomSoldierType, getCharacterDef, getAttackTiming, type SoldierTemplateStore } from '../character/CharacterRegistry';
import { throwDelaySeconds } from '../character/SoldierTypes';
import { rollGrade, getGradeDef, getGradeLabel } from './systems/GradeDefs';
import { upgradeCost, UPGRADE_MAX_LEVEL, type Trait } from './systems/UpgradeDefs';
import { createRenderer } from './RendererFactory';
import { buildScene } from '../Map/MapBuilder';
import { CameraController } from '../camera/CameraController';
import { InputController } from '../input/InputController';
import { CommandHandler } from '../input/CommandHandler';
import { HUD } from '../ui/HUD';
import { PortraitRenderer } from '../character/PortraitRenderer';
import { SelectionPanel } from '../ui/SelectionPanel';

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
  private portraitRenderer!: PortraitRenderer;
  private selectionPanel!: SelectionPanel;
  private soldierTemplates!: SoldierTemplateStore;
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
    this.cameraCtrl.updateCamera(this.camera, 0);

    this.input = new InputController();
    this.input.register(canvas, cmd.onSelectionRect, cmd.onClick, cmd.onDeselect);

    const [monsterTemplates, soldierTemplates] = await Promise.all([
      loadAllMonsterTemplates(),
      loadAllTemplates(),
    ]);
    this.soldierTemplates = soldierTemplates;
    this.entityRenderer  = new EntityRenderer(this.scene, monsterTemplates, soldierTemplates);
    // 투사체로 던질 모델 전달 (원거리=돌, 폭발=창)
    const projectileModels: Record<string, THREE.Object3D> = {};
    const rockModel  = soldierTemplates.resolve('archer', 'normal').weapon?.scene;
    const spearModel = soldierTemplates.resolve('ninja',  'normal').weapon?.scene;
    if (rockModel)  projectileModels.rock  = rockModel;
    if (spearModel) projectileModels.spear = spearModel;
    this.effectsRenderer = new EffectsRenderer(this.scene, projectileModels);
    cmd.onMoveIssued = (pt) => this.effectsRenderer.spawnMoveEffect(pt);
    cmd.registerDebugKeys(() => this.entityRenderer.toggleRangeRings());

    this.hud = new HUD();
    this.hud.onSpawnSoldier(() => this.trySpawnSoldier());
    this.hud.onUpgrade((trait) => this.tryUpgrade(trait));

    this.portraitRenderer = new PortraitRenderer(soldierTemplates.baseMap());
    this.selectionPanel   = new SelectionPanel(this.portraitRenderer);
    this.selectionPanel.onFocusSoldier((id) => {
      for (const s of this.state.soldiers) s.selected = s.id === id;
    });

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
    this.cameraCtrl.updateCamera(this.camera, delta);
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

    const { deadIds, attackStarts, throws, cancels } = updateCombat(this.state, delta);
    const proj = updateProjectiles(this.state, delta);
    for (const id of deadIds)      this.entityRenderer.removeMonster(id);
    for (const id of proj.deadIds) this.entityRenderer.removeMonster(id);

    this.entityRenderer.updateMonsters(this.state.monsters);
    this.entityRenderer.updateSoldierVisuals(this.state.soldiers, delta);
    this.entityRenderer.updateSoldiers(attackStarts, delta);
    this.entityRenderer.applyThrows(throws);
    this.entityRenderer.applyCancels(cancels);
    this.effectsRenderer.showThrows(throws);
    this.effectsRenderer.syncProjectiles(this.state.projectiles, delta);
    this.effectsRenderer.showHits(proj.hits);
    this.effectsRenderer.tickParticles(delta);
    this.effectsRenderer.tickMoveEffects(delta);
    this.entityRenderer.tickAnimations(delta);

    this.hud.update(this.state);
    this.portraitRenderer.tick(delta);
    this.selectionPanel.update(this.state.soldiers, this.state.upgrades);
  }

  // ── Upgrade ───────────────────────────────────────────────────────────────

  private tryUpgrade(trait: Trait): void {
    const currentLevel = this.state.upgrades[trait];
    if (currentLevel >= UPGRADE_MAX_LEVEL) return;
    const cost = upgradeCost(currentLevel);
    if (this.state.gold < cost) return;
    this.state.gold -= cost;
    this.state.upgrades[trait]++;
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

    // 발동 시점: 애니 비율(getAttackTiming) → 실제 초로 환산 (공격속도 반영, 프레임 고정)
    const attackSpeed = def.stats.attackSpeed * m.attackSpeed;
    const template = this.soldierTemplates.resolve(soldierType, grade);
    const attackHitDelay = throwDelaySeconds(template, attackSpeed, getAttackTiming(soldierType));

    const soldier: SoldierData = {
      id: this.state.nextSoldierId++,
      soldierType,
      grade,
      trait:          def.trait,
      weaponType:     def.weaponType,
      attackDamage:   def.stats.attackDamage  * m.attackDamage,
      attackRange:    def.stats.attackRange   * m.attackRange,
      attackCooldown: 0,
      attackSpeed,
      attackHitDelay,
      position:       pos,
      moveTarget:     null,
      moveSpeed:      def.stats.moveSpeed     * m.moveSpeed,
      selected:       false,
      targetId:       null,
    };
    this.state.soldiers.push(soldier);
    this.entityRenderer.addSoldier(soldier);
    this.hud.showSpawnNotification(def.label, getGradeLabel(grade, def.trait), gradeDef.color);
  }
}
