import type { SoldierTemplate } from './SoldierTypes';
import { loadSoldierTemplate, BASE_ASSETS } from './loadSoldierTemplate';

export function loadPaladinTemplate(): Promise<SoldierTemplate> {
  return loadSoldierTemplate(BASE_ASSETS.paladin);
}
