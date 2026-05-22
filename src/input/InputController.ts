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
  ): void {
    this.registerDrag(canvas);
    this.registerZoom();
    this.registerResize(onResize);
  }

  /** Smoothly update camera position and look-at each frame. */
  updateCamera(camera: THREE.PerspectiveCamera): void {
    this.zoomCurrent += (this.zoomTarget - this.zoomCurrent) * CAM_LERP;

    camera.position.set(
      this.cameraTarget.x,
      CAM_BASE_Y * this.zoomCurrent,
      this.cameraTarget.z + CAM_BASE_Z * this.zoomCurrent,
    );
    camera.lookAt(this.cameraTarget.x, 0, this.cameraTarget.z);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private registerDrag(canvas: HTMLCanvasElement): void {
    canvas.style.cursor = 'grab';

    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return;
      this.isDragging = true;
      this.dragLast.x = e.clientX;
      this.dragLast.y = e.clientY;
      canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragLast.x;
      const dy = e.clientY - this.dragLast.y;
      this.dragLast.x = e.clientX;
      this.dragLast.y = e.clientY;

      // Sensitivity scales with zoom so panning feels constant in screen-space
      const s = 0.028 * this.zoomCurrent;
      this.cameraTarget.x -= dx * s;
      this.cameraTarget.z -= dy * s;
    });

    const stopDrag = (e: MouseEvent) => {
      if (e.button !== 0) return;
      this.isDragging = false;
      canvas.style.cursor = 'grab';
    };
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('mouseleave', () => {
      this.isDragging = false;
      canvas.style.cursor = 'grab';
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
