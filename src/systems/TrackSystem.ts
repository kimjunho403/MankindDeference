export const TRACK_RADIUS = 8;
export const SOLDIER_MAX_RADIUS = 5.5; // soldiers placed inside this radius

export function progressToPosition(progress: number): { x: number; z: number } {
  const angle = progress * Math.PI * 2;
  return {
    x: TRACK_RADIUS * Math.cos(angle),
    z: TRACK_RADIUS * Math.sin(angle),
  };
}

export function randomSoldierPosition(): { x: number; z: number } {
  // Random position inside the track, avoiding the very center
  const r = (0.25 + Math.random() * 0.75) * SOLDIER_MAX_RADIUS;
  const angle = Math.random() * Math.PI * 2;
  return {
    x: r * Math.cos(angle),
    z: r * Math.sin(angle),
  };
}

export function distance2D(
  a: { x: number; z: number },
  b: { x: number; z: number }
): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}
