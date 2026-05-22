import * as THREE from 'three';
import { createGameState, type GameState, type SoldierData } from './state/GameState';
import { randomSoldierPosition } from './systems/TrackSystem';
import { updateSpawn } from './systems/SpawnSystem';
import { updateMonsterMovement, updateCombat, updateSoldierMovement } from './systems/CombatSystem';
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
      (rect) => {
        // Selection rectangle: project soldier positions to screen and set selected
        const canvasRect = (this.renderer.domElement as HTMLCanvasElement).getBoundingClientRect();
        let count = 0;
        for (const s of this.state.soldiers) {
          const v = new THREE.Vector3(s.position.x, 0, s.position.z).project(this.camera);
          const sx = (v.x * 0.5 + 0.5) * canvasRect.width + canvasRect.left;
          const sy = (-v.y * 0.5 + 0.5) * canvasRect.height + canvasRect.top;
          const inside = sx >= rect.x1 && sx <= rect.x2 && sy >= rect.y1 && sy <= rect.y2;
          s.selected = inside;
          if (inside) count++;
        }
        // debug
        // eslint-disable-next-line no-console
        console.log('[Game] selected count', count);
      },
      (clientX, clientY, button, ctrl) => {
        // Right-click: issue move command. Left-click: toggle selection.
        if (button === 2) {
          const canvasRect = (this.renderer.domElement as HTMLCanvasElement).getBoundingClientRect();
          // Raycast to ground plane
          const ndcX = ((clientX - canvasRect.left) / canvasRect.width) * 2 - 1;
          const ndcY = -((clientY - canvasRect.top) / canvasRect.height) * 2 + 1;
          const ray = new THREE.Raycaster();
          ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
          const point = new THREE.Vector3();
          if (ray.ray.intersectPlane(plane, point)) {
            const selected = this.state.soldiers.filter(s => s.selected);
            const SPACING = 0.9;
            const cols = Math.ceil(Math.sqrt(selected.length));
            const rows = Math.ceil(selected.length / cols);
            selected.forEach((s, i) => {
              const col = i % cols;
              const row = Math.floor(i / cols);
              s.moveTarget = {
                x: point.x + (col - (cols - 1) / 2) * SPACING,
                z: point.z + (row - (rows - 1) / 2) * SPACING,
              };
            });
          }
          return;
        }

        // Single left-click: toggle soldier selection if clicked
        const canvasRect = (this.renderer.domElement as HTMLCanvasElement).getBoundingClientRect();
        const clickThreshold = 12; // pixels
        let clickedSoldier: number | null = null;
        for (const s of this.state.soldiers) {
          const v = new THREE.Vector3(s.position.x, 0, s.position.z).project(this.camera);
          const sx = (v.x * 0.5 + 0.5) * canvasRect.width + canvasRect.left;
          const sy = (-v.y * 0.5 + 0.5) * canvasRect.height + canvasRect.top;
          const d = Math.hypot(sx - clientX, sy - clientY);
          if (d <= clickThreshold) {
            clickedSoldier = s.id;
            break;
          }
        }
        if (clickedSoldier !== null) {
          const s = this.state.soldiers.find(x => x.id === clickedSoldier);
          if (!s) return;
          if (ctrl) {
            // Additive toggle selection
            s.selected = !s.selected;
            return;
          }
          // Non-ctrl single-click: select only this soldier
          for (const other of this.state.soldiers) other.selected = false;
          s.selected = true;
          return;
        }

        // Left-click on empty space: if ctrl held, keep selection; otherwise deselect all
        if (!ctrl) {
          for (const s of this.state.soldiers) s.selected = false;
        }
        return;
      },
      () => {
        // ESC pressed: deselect all
        for (const s of this.state.soldiers) s.selected = false;
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
    // Move soldiers towards moveTarget (if any)
    updateSoldierMovement(this.state, delta);

    // Defeat: too many monsters alive simultaneously
    if (this.state.monsters.length >= 100) this.state.gameOver = true;

    const { deadIds, attacks } = updateCombat(this.state, delta);
    for (const id of deadIds) this.entityRenderer.removeMonster(id);

    this.entityRenderer.updateMonsters(this.state.monsters);
    // Update soldier visuals after movement
    this.entityRenderer.updateSoldierVisuals(this.state.soldiers);
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
      moveTarget: null,
      moveSpeed: 3,
      selected: false,
      targetId: null,
    };
    this.state.soldiers.push(soldier);
    this.entityRenderer.addSoldier(soldier);
  }
}
