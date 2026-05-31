export type MonsterType = 'warrok' | 'jery' | 'mutent';

// ── 스테이지 스폰 설정 ──────────────────────────────────────────────────────────
export interface MonsterSpawnConfig {
  type: MonsterType;
  spawnInterval: number;
  maxCount?: number;
}

export interface StageDef {
  duration: number;
  monsters: MonsterSpawnConfig[];
}

export const STAGES: StageDef[] = [
  {
    duration: 30,
    monsters: [
      { type: 'jery',   spawnInterval: 1.5, maxCount: 25 },
    ],
  },
  {
    duration: 30,
    monsters: [
      { type: 'mutent', spawnInterval: 1.5 },
    ],
  },
  {
    duration: 30,
    monsters: [
      { type: 'warrok', spawnInterval: 1.5 },
    ],
  },
];
