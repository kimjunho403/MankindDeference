import type { SoldierTemplate } from './SoldierTypes';
import { loadSoldierTemplate, BASE_ASSETS } from './loadSoldierTemplate';

export function loadNinjaTemplate(): Promise<SoldierTemplate> {
  return loadSoldierTemplate(BASE_ASSETS.ninja);
}
