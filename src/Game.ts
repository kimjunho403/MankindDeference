import * as THREE from 'three';
import { createGameState, type GameState, type SoldierData } from './state/GameState';
import { randomSoldierPosition } from './systems/TrackSystem';
import { updateSpawn } from './systems/SpawnSystem';
import { updateMonsterMovement, updateCombat } from './systems/CombatSystem';
import { EntityRenderer } from './rendering/EntityRenderer';
import { loadMonsterTemplate } from './rendering/MonsterLoader';
import { loadArcherTemplate } from './rendering/ArcherLoader';
import { buildScene } from './scene/SceneBuilder';
import { InputController } from './input/InputController';
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

    const { WebGPURenderer } = await import('three/webgpu');
    this.renderer = new WebGPURenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(this.renderer.domElement);
    await this.renderer.init();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x141420);

    this.camera = new THREE.PerspectiveCamera(
      55, window.innerWidth / window.innerHeight, 0.1, 200,
    );

    buildScene(this.scene);

    this.input = new InputController();
    this.input.register(
      this.renderer.domElement as HTMLCanvasElement,
      (aspect, w, h) => {
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
      },
    );
    this.input.updateCamera(this.camera); // set initial camera position

    const [monsterTemplate, archerTemplate] = await Promise.all([
      loadMonsterTemplate(),
      loadArcherTemplate(),
    ]);
    this.entityRenderer = new EntityRenderer(this.scene, monsterTemplate, archerTemplate);

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

    // Defeat: too many monsters alive simultaneously
    if (this.state.monsters.length >= 100) this.state.gameOver = true;

    const { deadIds, attacks } = updateCombat(this.state, delta);
    for (const id of deadIds) this.entityRenderer.removeMonster(id);

    this.entityRenderer.updateMonsters(this.state.monsters);
    this.entityRenderer.updateSoldiers(attacks);
    this.entityRenderer.showAttacks(attacks);
    this.entityRenderer.tickAttackLines(delta);
    this.entityRenderer.tickAnimations(delta);

    this.hud.update(this.state);
  }

  // ── Soldier spawn ─────────────────────────────────────────────────────────

  private trySpawnSoldier(): void {
    if (this.state.gold < SOLDIER_COST || this.state.gameOver) return;
    this.state.gold -= SOLDIER_COST;

    const pos = randomSoldierPosition();
    const soldier: SoldierData = {
      id: this.state.nextSoldierId++,
      attackDamage: 10,
      attackRange: 4,
      attackCooldown: 0,
      attackSpeed: 1,
      position: pos,
      targetId: null,
    };
    this.state.soldiers.push(soldier);
    this.entityRenderer.addSoldier(soldier);
  }
}
