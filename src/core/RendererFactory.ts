import * as THREE from 'three';

export interface RendererBundle {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderer: any;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

export async function createRenderer(): Promise<RendererBundle> {
  const { WebGPURenderer } = await import('three/webgpu');

  // shadowMap.enabled must be set BEFORE renderer.init() in WebGPU
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderer = new WebGPURenderer({ antialias: true }) as any;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  await renderer.init();

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    55, window.innerWidth / window.innerHeight, 0.1, 200,
  );

  return { renderer, scene, camera };
}
