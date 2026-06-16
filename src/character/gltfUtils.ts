import * as THREE from 'three';

const TARGET_HEIGHT = 1.5;
// GLTFLoader가 노드명을 sanitize하며 콜론(:)을 제거하므로 런타임 이름은
// 'mixamorig:Hips'가 아니라 'mixamorigHips'가 된다. 콜론 유무 모두 매칭.
const MIXAMO_RE = /mixamorig:?/g;

export function makeInPlace(clip: THREE.AnimationClip): THREE.AnimationClip {
  const inPlace = clip.clone();
  inPlace.tracks = inPlace.tracks.filter(track => {
    const name = track.name.toLowerCase();
    return !name.endsWith('.position') && !name.endsWith('.translation');
  });
  return inPlace;
}

// 본 이름 정규화: 모델/클립이 서로 다른 export(예: Unreal 경유로 prefix 누락)에서 와도
// 'mixamorig:' prefix를 양쪽에서 제거해 AnimationMixer 바인딩이 항상 일치하도록 한다.
export function stripBonePrefix(root: THREE.Object3D): void {
  root.traverse(obj => {
    if (obj.name.includes('mixamorig')) obj.name = obj.name.replace(MIXAMO_RE, '');
  });
}

export function stripClipBonePrefix(clip: THREE.AnimationClip): THREE.AnimationClip {
  for (const track of clip.tracks) {
    if (track.name.includes('mixamorig')) track.name = track.name.replace(MIXAMO_RE, '');
  }
  return clip;
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
