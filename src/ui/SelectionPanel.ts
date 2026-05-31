import type { SoldierData, SoldierType } from '../core/state/GameState';
import type { Trait } from '../core/systems/UpgradeDefs';
import { damageMultiplier } from '../core/systems/UpgradeDefs';
import { getGradeDef } from '../core/systems/GradeDefs';
import { getCharacterDef } from '../character/CharacterRegistry';
import type { PortraitRenderer } from '../character/PortraitRenderer';

const PORT_SIZE  = 96;
const THUMB_SIZE = 40;

interface ThumbEntry {
  canvas:      HTMLCanvasElement;
  ctx:         CanvasRenderingContext2D;
  soldierType: SoldierType;
  soldierId:   number;
}

export class SelectionPanel {
  private el:       HTMLElement;
  private singleEl: HTMLElement;
  private multiEl:  HTMLElement;
  private thumbsEl: HTMLElement;

  // single view elements
  private sPortCtx: CanvasRenderingContext2D;
  private sNameEl:  HTMLElement;
  private sGradeEl: HTMLElement;
  private sAtkEl:   HTMLElement;
  private sSpdEl:   HTMLElement;
  private sRngEl:   HTMLElement;
  private sMvsEl:   HTMLElement;

  private prevSelKey:   string = '';
  private thumbEntries: ThumbEntry[] = [];
  private focusCb:      ((id: number) => void) | null = null;

  constructor(private readonly portraits: PortraitRenderer) {
    this.el       = document.getElementById('selection-panel')!;
    this.singleEl = document.getElementById('sel-single')!;
    this.multiEl  = document.getElementById('sel-multi')!;
    this.thumbsEl = document.getElementById('sel-thumbs')!;

    this.sPortCtx = (document.getElementById('sel-portrait') as HTMLCanvasElement).getContext('2d')!;
    this.sNameEl  = document.getElementById('sel-name')!;
    this.sGradeEl = document.getElementById('sel-grade')!;
    this.sAtkEl   = document.getElementById('sel-atk')!;
    this.sSpdEl   = document.getElementById('sel-spd')!;
    this.sRngEl   = document.getElementById('sel-rng')!;
    this.sMvsEl   = document.getElementById('sel-mvs')!;
  }

  onFocusSoldier(cb: (id: number) => void): void {
    this.focusCb = cb;
  }

  update(soldiers: SoldierData[], upgrades: Record<Trait, number>): void {
    const selected = soldiers.filter(s => s.selected);

    if (selected.length === 0) {
      this.el.classList.remove('visible');
      this.prevSelKey = '';
      return;
    }

    this.el.classList.add('visible');

    if (selected.length === 1) {
      this.singleEl.style.display = 'flex';
      this.multiEl.style.display  = 'none';
      this.writeProfile(selected[0], upgrades);
    } else {
      this.singleEl.style.display = 'none';
      this.multiEl.style.display  = 'flex';

      const selKey = selected.map(s => s.id).join(',');
      if (selKey !== this.prevSelKey) {
        this.prevSelKey = selKey;
        this.rebuildThumbs(selected);
      }

      for (const entry of this.thumbEntries) {
        const src = this.portraits.getCanvas(entry.soldierType);
        if (src) entry.ctx.drawImage(src, 0, 0, THUMB_SIZE, THUMB_SIZE);
      }
    }
  }

  private writeProfile(s: SoldierData, upgrades: Record<Trait, number>): void {
    const def      = getCharacterDef(s.soldierType);
    const gradeDef = getGradeDef(s.grade);
    const level    = upgrades[s.trait];
    const bonus    = Math.round((damageMultiplier(level) - 1) * 100);
    const totalAtk = Math.round(s.attackDamage * damageMultiplier(level));
    const hex      = '#' + gradeDef.color.toString(16).padStart(6, '0');

    this.sNameEl.textContent  = def.label;
    this.sGradeEl.textContent = gradeDef.label;
    this.sGradeEl.style.color = hex;
    this.sAtkEl.innerHTML     = `${totalAtk} <small style="color:#88ff88">(+${bonus}%)</small>`;
    this.sSpdEl.textContent   = s.attackSpeed.toFixed(2);
    this.sRngEl.textContent   = s.attackRange.toFixed(1);
    this.sMvsEl.textContent   = s.moveSpeed.toFixed(1);

    const src = this.portraits.getCanvas(s.soldierType);
    if (src) {
      this.sPortCtx.clearRect(0, 0, PORT_SIZE, PORT_SIZE);
      this.sPortCtx.drawImage(src, 0, 0);
    }
  }

  private rebuildThumbs(selected: SoldierData[]): void {
    this.thumbsEl.innerHTML = '';
    this.thumbEntries = [];

    for (const s of selected) {
      const wrap = document.createElement('div');
      wrap.className = 'thumb-wrap';

      const gradeDef = getGradeDef(s.grade);
      wrap.style.borderColor = '#' + gradeDef.color.toString(16).padStart(6, '0');

      const canvas = document.createElement('canvas');
      canvas.width  = THUMB_SIZE;
      canvas.height = THUMB_SIZE;
      const ctx = canvas.getContext('2d')!;

      const src = this.portraits.getCanvas(s.soldierType);
      if (src) ctx.drawImage(src, 0, 0, THUMB_SIZE, THUMB_SIZE);

      wrap.appendChild(canvas);

      const sid = s.id;
      wrap.addEventListener('click', () => {
        this.focusCb?.(sid);
      });

      this.thumbsEl.appendChild(wrap);
      this.thumbEntries.push({ canvas, ctx, soldierType: s.soldierType, soldierId: s.id });
    }
  }
}
