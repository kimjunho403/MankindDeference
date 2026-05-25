import * as THREE from 'three';
import { addGround } from './Ground';
import { addTrack } from './Track';
import { addTrees } from './Trees';
import { addSkyBox } from './SkyBox';

export function buildScene(scene: THREE.Scene): void {
  addLights(scene);
  addSkyBox(scene);
  addGround(scene);
  addTrack(scene);
  addTrees(scene);
}

function addLights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xddeeff, 0x553322, 0.6));

  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(6, 12, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.width  = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near   = 0.5;
  sun.shadow.camera.far    = 50;
  sun.shadow.camera.left   = -18;
  sun.shadow.camera.right  =  18;
  sun.shadow.camera.top    =  18;
  sun.shadow.camera.bottom = -18;
  scene.add(sun);
}
