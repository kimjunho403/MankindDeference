import * as THREE from 'three';

const TARGET_HEIGHT = 1.5; // world units

/**
 * Strip root-motion XZ from a clip so the character animates in-place.
 * Zeroes X and Z on every .position track; Y (body-bob) is preserved.
 */
export function makeInPlace(clip: THREE.AnimationClip): THREE.AnimationClip {
  const inPlace = clip.clone();
  for (const track of inPlace.tracks) {
    if (!track.name.endsWith('.position')) continue;
    const v = track.values as Float32Array;
    for (let i = 0; i < v.length; i += 3) {
      v[i]     = 0; // X
      v[i + 2] = 0; // Z
    }
  }
  return inPlace;
}

/**
 * Replace every material on the loaded model with MeshBasicMaterial.
 *
 * Three.js WebGPU r170 renders MeshStandardMaterial on SkinnedMesh
 * pitch-black regardless of lighting. MeshBasicMaterial bypasses the
 * lighting pipeline and renders the albedo texture directly.
 */
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

/** Compute uniform scale so the model fits TARGET_HEIGHT world units tall. */
export function computeScale(scene: THREE.Object3D, targetHeight = TARGET_HEIGHT): number {
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  return size.y > 0 ? targetHeight / size.y : 1;
}

/**
 * Lift model.position.y so the bounding-box bottom sits exactly at Y = 0.
 * Call this AFTER scale is already applied to the model.
 *
 * Three.js r170 does not auto-update world matrices inside Box3.setFromObject,
 * so we call updateWorldMatrix(true, true) first.
 */
export function floorModel(model: THREE.Object3D): void {
  model.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(model);
  if (isFinite(box.min.y)) {
    model.position.y -= box.min.y;
  }
}
