import * as THREE from 'three';

// asset/skybox/*.png → publicDir(asset) 기준 /skybox/*.png 로 서빙됨
const SKYBOX_DIR    = '/skybox/';
const SKYBOX_PREFIX = 'jettelly_space_nebulas_black_';

// CubeTextureLoader 순서: [ +X, -X, +Y, -Y, +Z, -Z ] = [ Right, Left, Up, Down, Front, Back ]
const FACES = ['RIGHT', 'LEFT', 'UP', 'DOWN', 'FRONT', 'BACK'].map(
  (f) => `${SKYBOX_PREFIX}${f}.png`,
);

export function addSkyBox(scene: THREE.Scene): void {
  const texture = new THREE.CubeTextureLoader()
    .setPath(SKYBOX_DIR)
    .load(FACES);
  texture.colorSpace = THREE.SRGBColorSpace;

  scene.background = texture;
}
