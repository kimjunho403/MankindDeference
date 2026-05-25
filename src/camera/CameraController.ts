import * as THREE from 'three';

const CAM_BASE_Y    = 18;
const CAM_BASE_Z    = 7;
const CAM_ZOOM_MIN  = 0.45;
const CAM_ZOOM_MAX  = 2.8;
const CAM_ZOOM_STEP = 0.12;
const CAM_LERP      = 0.12;

export class CameraController {
  readonly cameraTarget = new THREE.Vector3(0, 0, 0);

  private zoomCurrent  = 1.0;
  private zoomTarget   = 1.0;
  private heightOffset = 0;

  register(onResize: (aspect: number, width: number, height: number) => void): void {
    this.registerZoom();
    this.registerKeyboard();
    this.registerResize(onResize);
  }

  updateCamera(camera: THREE.PerspectiveCamera): void {
    this.zoomCurrent += (this.zoomTarget - this.zoomCurrent) * CAM_LERP;
    camera.position.set(
      this.cameraTarget.x,
      CAM_BASE_Y * this.zoomCurrent + this.heightOffset,
      this.cameraTarget.z + CAM_BASE_Z * this.zoomCurrent,
    );
    camera.lookAt(this.cameraTarget.x, 0, this.cameraTarget.z);
  }

  private registerZoom(): void {
    window.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      this.zoomTarget = Math.min(
        CAM_ZOOM_MAX,
        Math.max(CAM_ZOOM_MIN, this.zoomTarget + dir * CAM_ZOOM_STEP),
      );
    }, { passive: false });
  }

  private registerKeyboard(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      const step = 0.5;
      switch (e.key) {
        case 'ArrowLeft':  this.cameraTarget.x -= step; break;
        case 'ArrowRight': this.cameraTarget.x += step; break;
        case 'ArrowUp':    this.cameraTarget.z -= step; break;
        case 'ArrowDown':  this.cameraTarget.z += step; break;
        case 'w': case 'W': this.heightOffset += 0.5; break;
        case 's': case 'S': this.heightOffset -= 0.5; break;
      }
    });
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
