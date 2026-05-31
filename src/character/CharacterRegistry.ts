import type { SoldierType, WeaponType } from '../core/state/GameState';
import type { SoldierTemplate } from './SoldierTypes';
import { loadArcherTemplate } from './ArcherLoader';
import { loadNinjaTemplate } from './NinjaLoader';
import { loadPaladinTemplate } from './PaladinLoader';

export interface CharacterDef {
  soldierType: SoldierType;
  weaponType: WeaponType;
  attackHitDelay?: number;  // 공격 모션 시작 후 데미지 판정까지의 딜레이 (초). 기본값 0
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
    stats: { attackDamage: 10, attackRange: 4, attackSpeed: 2, moveSpeed: 3 },
    load: loadArcherTemplate,
  },
  {
    soldierType: 'ninja',
    weaponType: 'shuriken',
    stats: { attackDamage: 10, attackRange: 4, attackSpeed: 1, moveSpeed: 3 },
    load: loadNinjaTemplate,
  },
  {
    soldierType: 'paladin',
    weaponType: 'melee',
    attackHitDelay: 0.35,  // 선딜레이(Anticipation) 이후 타격 구간(Active) 진입 시점
    stats: { attackDamage: 25, attackRange: 1.5, attackSpeed: 1.5, moveSpeed: 2.5 },
    load: loadPaladinTemplate,
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
