import type { MonsterType } from '../core/systems/StageDefs';
import type { MonsterTemplate } from './MonsterLoader';
import { loadMonsterTemplate } from './MonsterLoader';
import { loadJeryTemplate } from './JeryLoader';
import { loadMutentTemplate } from './MutentLoader';

export interface MonsterDef {
  type: MonsterType;
  hp: number;
  speed: number;
  load(): Promise<MonsterTemplate>;
}

export const MONSTER_DEFS: MonsterDef[] = [
  { type: 'jery',   hp: 30,  speed: 0.08, load: loadJeryTemplate },
  { type: 'mutent', hp: 70,  speed: 0.05, load: loadMutentTemplate },
  { type: 'warrok', hp: 110, speed: 0.07, load: loadMonsterTemplate },
];

export function getMonsterDef(type: MonsterType): MonsterDef {
  const def = MONSTER_DEFS.find(d => d.type === type);
  if (!def) throw new Error(`Unknown monster type: ${type}`);
  return def;
}

export async function loadAllMonsterTemplates(): Promise<Map<MonsterType, MonsterTemplate>> {
  const entries = await Promise.all(
    MONSTER_DEFS.map(async (def) => [def.type, await def.load()] as const),
  );
  return new Map(entries);
}
