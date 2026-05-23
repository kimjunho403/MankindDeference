import type { SoldierType, WeaponType } from '../state/GameState';
import type { SoldierTemplate } from './SoldierTypes';
import { loadArcherTemplate } from './ArcherLoader';
import { loadNinjaTemplate } from './NinjaLoader';

export interface CharacterDef {
  soldierType: SoldierType;
  weaponType: WeaponType;
  stats: {
    attackDamage: number;
    attackRange: number;
    attackSpeed: number;
    moveSpeed: number;
  };
  load(): Promise<SoldierTemplate>;
}

export const CHARACTER_DEFS: CharacterDef[] = [
  {
    soldierType: 'archer',
    weaponType: 'arrow',
    stats: { attackDamage: 10, attackRange: 4, attackSpeed: 1, moveSpeed: 3 },
    load: loadArcherTemplate,
  },
  {
    soldierType: 'ninja',
    weaponType: 'shuriken',
    stats: { attackDamage: 10, attackRange: 4, attackSpeed: 1, moveSpeed: 3 },
    load: loadNinjaTemplate,
  },
];

export async function loadAllTemplates(): Promise<Map<SoldierType, SoldierTemplate>> {
  const entries = await Promise.all(
    CHARACTER_DEFS.map(async (def) => [def.soldierType, await def.load()] as const),
  );
  return new Map(entries);
}

export function randomSoldierType(): SoldierType {
  const idx = Math.floor(Math.random() * CHARACTER_DEFS.length);
  return CHARACTER_DEFS[idx].soldierType;
}

export function getCharacterDef(soldierType: SoldierType): CharacterDef {
  const def = CHARACTER_DEFS.find(d => d.soldierType === soldierType);
  if (!def) throw new Error(`Unknown soldierType: ${soldierType}`);
  return def;
}
