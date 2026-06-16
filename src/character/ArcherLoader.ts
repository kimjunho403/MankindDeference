import type { SoldierTemplate } from './SoldierTypes';
import { loadSoldierTemplate, BASE_ASSETS } from './loadSoldierTemplate';

export function loadArcherTemplate(): Promise<SoldierTemplate> {
  return loadSoldierTemplate(BASE_ASSETS.archer);
}
