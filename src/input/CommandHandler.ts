import * as THREE from 'three';
import type { GameState } from '../state/GameState';

const FORMATION_SPACING  = 0.9;
const CLICK_THRESHOLD_PX = 12;
const GROUND_PLANE       = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export class CommandHandler {
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly state: GameState,
    private readonly getCamera: () => THREE.PerspectiveCamera,
  ) {}

  // ── Callbacks wired into InputController ─────────────────────────────────

  onSelectionRect = (rect: { x1: number; y1: number; x2: number; y2: number }): void => {
    const cr  = this.canvas.getBoundingClientRect();
    const cam = this.getCamera();
    for (const s of this.state.soldiers) {
      const v  = new THREE.Vector3(s.position.x, 0, s.position.z).project(cam);
      const sx = (v.x * 0.5 + 0.5) * cr.width  + cr.left;
      const sy = (-v.y * 0.5 + 0.5) * cr.height + cr.top;
      s.selected = sx >= rect.x1 && sx <= rect.x2 && sy >= rect.y1 && sy <= rect.y2;
    }
  };

  onClick = (clientX: number, clientY: number, button?: number, ctrl?: boolean): void => {
    if (button === 2) {
      this.issueMoveCommand(clientX, clientY);
      return;
    }
    this.handleClickSelect(clientX, clientY, ctrl ?? false);
  };

  onDeselect = (): void => {
    for (const s of this.state.soldiers) s.selected = false;
  };

  onMoveIssued?: (point: THREE.Vector3) => void;

  // ── Debug key bindings ────────────────────────────────────────────────────

  registerDebugKeys(onRangeToggle: () => void): void {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') onRangeToggle();
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private issueMoveCommand(clientX: number, clientY: number): void {
    const cr    = this.canvas.getBoundingClientRect();
    const ndcX  = ((clientX - cr.left) / cr.width)  * 2 - 1;
    const ndcY  = -((clientY - cr.top)  / cr.height) * 2 + 1;
    const ray   = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.getCamera());
    const point = new THREE.Vector3();
    if (!ray.ray.intersectPlane(GROUND_PLANE, point)) return;

    this.onMoveIssued?.(point.clone());

    const selected = this.state.soldiers.filter(s => s.selected);
    const cols = Math.ceil(Math.sqrt(selected.length));
    const rows = Math.ceil(selected.length / cols);
    selected.forEach((s, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      s.moveTarget = {
        x: point.x + (col - (cols - 1) / 2) * FORMATION_SPACING,
        z: point.z + (row - (rows - 1) / 2) * FORMATION_SPACING,
      };
    });
  }

  private handleClickSelect(clientX: number, clientY: number, ctrl: boolean): void {
    const cr  = this.canvas.getBoundingClientRect();
    const cam = this.getCamera();

    let clickedId: number | null = null;
    for (const s of this.state.soldiers) {
      const v  = new THREE.Vector3(s.position.x, 0, s.position.z).project(cam);
      const sx = (v.x * 0.5 + 0.5) * cr.width  + cr.left;
      const sy = (-v.y * 0.5 + 0.5) * cr.height + cr.top;
      if (Math.hypot(sx - clientX, sy - clientY) <= CLICK_THRESHOLD_PX) {
        clickedId = s.id;
        break;
      }
    }

    if (clickedId !== null) {
      const s = this.state.soldiers.find(x => x.id === clickedId);
      if (!s) return;
      if (ctrl) {
        s.selected = !s.selected;
      } else {
        for (const other of this.state.soldiers) other.selected = false;
        s.selected = true;
      }
      return;
    }

    if (!ctrl) {
      for (const s of this.state.soldiers) s.selected = false;
    }
  }
}
