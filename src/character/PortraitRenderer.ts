import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { floorModel } from './gltfUtils';
import type { SoldierType } from '../core/state/GameState';
import type { SoldierTemplate } from './SoldierTypes';

const SIZE = 96;

interface PortraitEntry {
  scene:  THREE.Scene;
  mixer:  THREE.AnimationMixer;
  canvas: HTMLCanvasElement;
  ctx:    CanvasRenderingContext2D;
}

export class PortraitRenderer {
  private gl: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private entries = new Map<SoldierType, PortraitEntry>();

  constructor(templates: Map<SoldierType, SoldierTemplate>) {
    this.gl = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    this.gl.setSize(SIZE, SIZE);
    this.gl.setPixelRatio(1);
    this.gl.setClearColor(0x000000, 0);

    // Camera framed to show face close-up (char height ~1.5, face ~y 1.25).
    // If portraits show the character's back, flip z to -0.9.
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
    this.camera.position.set(0, 1.25, 0.9);
    this.camera.lookAt(0, 1.25, 0);

    for (const [type, template] of templates) {
      this.buildEntry(type, template);
    }
  }

  private buildEntry(type: SoldierType, template: SoldierTemplate): void {
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 2.0));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(1, 3, 2);
    scene.add(dir);

    const model = skeletonClone(template.scene) as THREE.Object3D;
    model.scale.setScalar(template.scale);
    floorModel(model);
    scene.add(model);

    const mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(template.idleClip).play();

    const canvas = document.createElement('canvas');
    canvas.width  = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;

    this.entries.set(type, { scene, mixer, canvas, ctx });
  }

  tick(delta: number): void {
    for (const entry of this.entries.values()) {
      entry.mixer.update(delta);
      this.gl.render(entry.scene, this.camera);
      entry.ctx.clearRect(0, 0, SIZE, SIZE);
      entry.ctx.drawImage(this.gl.domElement, 0, 0);
    }
  }

  getCanvas(type: SoldierType): HTMLCanvasElement | undefined {
    return this.entries.get(type)?.canvas;
  }
}
