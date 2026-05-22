import * as THREE from 'three';

// ── Camera constants ──────────────────────────────────────────────────────────

const CAM_BASE_Y    = 18;
const CAM_BASE_Z    = 7;
const CAM_ZOOM_MIN  = 0.45;
const CAM_ZOOM_MAX  = 2.8;
const CAM_ZOOM_STEP = 0.12;
const CAM_LERP      = 0.12;

// ── InputController ───────────────────────────────────────────────────────────

/**
 * Manages all user input (drag-to-pan, scroll-to-zoom, window resize) and
 * owns the camera state. Call updateCamera() each frame.
 */
export class InputController {
  /** World-space point the camera looks at; updated by drag. */
  readonly cameraTarget = new THREE.Vector3(0, 0, 0);

  private zoomCurrent = 1.0;
  private zoomTarget  = 1.0;
  private heightOffset = 0;
  private isDragging  = false;
  private readonly dragLast = { x: 0, y: 0 };

  /**
   * Attach all event listeners.
   * @param canvas  The renderer's canvas element.
   * @param onResize  Called when the window resizes with the new aspect ratio,
   *                  width and height so Game can update camera + renderer.
   */
  register(
    canvas: HTMLCanvasElement,
    onResize: (aspect: number, width: number, height: number) => void,
    onSelectionComplete?: (rect: { x1: number; y1: number; x2: number; y2: number }) => void,
    onClick?: (clientX: number, clientY: number, button?: number, ctrl?: boolean) => void,
    onDeselect?: () => void,
  ): void {
    this.registerDragSelection(canvas, onSelectionComplete, onClick);
    this.registerZoom();
    this.registerResize(onResize);
    this.registerKeyboardCamera(onDeselect);
  }

  /** Smoothly update camera position and look-at each frame. */
  updateCamera(camera: THREE.PerspectiveCamera): void {
    this.zoomCurrent += (this.zoomTarget - this.zoomCurrent) * CAM_LERP;

    camera.position.set(
      this.cameraTarget.x,
      CAM_BASE_Y * this.zoomCurrent + this.heightOffset,
      this.cameraTarget.z + CAM_BASE_Z * this.zoomCurrent,
    );
    camera.lookAt(this.cameraTarget.x, 0, this.cameraTarget.z);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private registerDragSelection(
    canvas: HTMLCanvasElement,
    onSelectionComplete?: (rect: { x1: number; y1: number; x2: number; y2: number }) => void,
    onClick?: (clientX: number, clientY: number, button?: number, ctrl?: boolean) => void,
  ): void {
    canvas.style.cursor = 'default';

    let startX = 0;
    let startY = 0;
    let selecting = false;
    const box = document.createElement('div');
    Object.assign(box.style, {
      position: 'absolute',
      border: '1px dashed #88ccff',
      background: 'rgba(136,204,255,0.12)',
      pointerEvents: 'none',
      display: 'none',
      zIndex: '1000',
    });
    document.body.appendChild(box);

    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return;
      this.isDragging = true;
      selecting = false;
      startX = e.clientX;
      startY = e.clientY;
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!selecting && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) selecting = true;
      if (selecting) {
        box.style.display = 'block';
        const left = Math.min(startX, e.clientX);
        const top = Math.min(startY, e.clientY);
        const width = Math.abs(e.clientX - startX);
        const height = Math.abs(e.clientY - startY);
        box.style.left = `${left}px`;
        box.style.top = `${top}px`;
        box.style.width = `${width}px`;
        box.style.height = `${height}px`;
      }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button !== 0) return;
      this.isDragging = false;
      box.style.display = 'none';
      if (selecting) {
        const left = parseFloat(box.style.left || '0');
        const top = parseFloat(box.style.top || '0');
        const width = parseFloat(box.style.width || '0');
        const height = parseFloat(box.style.height || '0');
        const rect = {
          x1: left,
          y1: top,
          x2: left + width,
          y2: top + height,
        };
        if (onSelectionComplete) onSelectionComplete(rect);
      } else {
        if (onClick) onClick(e.clientX, e.clientY, 0, e.ctrlKey);
      }
    });

    // Right-click for issuing move commands — use contextmenu to capture position
    canvas.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      if (onClick) onClick(e.clientX, e.clientY, 2, e.ctrlKey);
    });
  }

  private registerKeyboardCamera(onDeselect?: () => void): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      const step = 0.5;
      switch (e.key) {
        case 'ArrowLeft':
          this.cameraTarget.x -= step;
          break;
        case 'ArrowRight':
          this.cameraTarget.x += step;
          break;
        case 'ArrowUp':
          this.cameraTarget.z -= step;
          break;
        case 'ArrowDown':
          this.cameraTarget.z += step;
          break;
        case 'w':
        case 'W':
          this.heightOffset += 0.5;
          break;
        case 's':
        case 'S':
          this.heightOffset -= 0.5;
          break;
        case 'Escape':
          if (onDeselect) onDeselect();
          break;
      }
    });
  }

  private registerZoom(): void {
    window.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1; // +1 = zoom out
      this.zoomTarget = Math.min(
        CAM_ZOOM_MAX,
        Math.max(CAM_ZOOM_MIN, this.zoomTarget + dir * CAM_ZOOM_STEP),
      );
    }, { passive: false });
  }

  private registerResize(
    onResize: (aspect: number, width: number, height: number) => void,
  ): void {
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      onResize(w / h, w, h);
    });
  }
}
