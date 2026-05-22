import type { Scene, Camera } from 'three';

declare module 'three/webgpu' {
  // Re-export everything from three
  export * from 'three';

  export class WebGPURenderer {
    domElement: HTMLCanvasElement;
    constructor(options?: {
      antialias?: boolean;
      forceWebGL?: boolean;
      alpha?: boolean;
    });
    setSize(width: number, height: number): void;
    setPixelRatio(ratio: number): void;
    render(scene: Scene, camera: Camera): void;
    init(): Promise<void>;
    dispose(): void;
  }
}
