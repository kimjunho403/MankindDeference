import * as THREE from 'three';

const TARGET_HEIGHT = 1.5;

export function makeInPlace(clip: THREE.AnimationClip): THREE.AnimationClip {
  const inPlace = clip.clone();
  inPlace.tracks = inPlace.tracks.filter(track => {
    const name = track.name.toLowerCase();
    return !name.endsWith('.position') && !name.endsWith('.translation');
  });
  return inPlace;
}

export function convertToBasic(root: THREE.Object3D): void {
  root.traverse(obj => {
    if (!(obj instanceof THREE.Mesh)) return;

    const convert = (src: THREE.Material): THREE.Material => {
      const std = src instanceof THREE.MeshStandardMaterial ? src : null;
      const map = std?.map ?? null;
      const dst = new THREE.MeshBasicMaterial({
        map:         map ?? undefined,
        color:       map ? 0xffffff : (std?.color.clone() ?? new THREE.Color(0x888888)),
        transparent: src.transparent,
        alphaTest:   src.alphaTest,
        side:        src.side,
        name:        src.name,
      });
      if (dst.map) dst.map.colorSpace = THREE.SRGBColorSpace;
      src.dispose();
      return dst;
    };

    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map(convert);
    } else {
      obj.material = convert(obj.material);
    }
  });
}

export function computeScale(scene: THREE.Object3D, targetHeight = TARGET_HEIGHT): number {
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  return size.y > 0 ? targetHeight / size.y : 1;
}

export function floorModel(model: THREE.Object3D): void {
  model.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(model);
  if (isFinite(box.min.y)) model.position.y -= box.min.y;
}
