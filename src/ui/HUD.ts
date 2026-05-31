import type { GameState } from '../core/state/GameState';
import { TRAIT_DEFS, upgradeCost, UPGRADE_MAX_LEVEL } from '../core/systems/UpgradeDefs';
import type { Trait } from '../core/systems/UpgradeDefs';

const MONSTER_LIMIT = 100;

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class HUD {
  private goldEl         = document.getElementById('gold')!;
  private monsterCountEl = document.getElementById('monster-count')!;
  private soldierCountEl = document.getElementById('soldier-count')!;
  private spawnBtn       = document.getElementById('btn-spawn-soldier') as HTMLButtonElement;
  private gameOverEl     = document.getElementById('game-over')!;
  private stageNumEl     = document.getElementById('stage-num')!;
  private stageTimerEl   = document.getElementById('stage-timer')!;
  private victoryEl      = document.getElementById('victory')!;
  private notifContainer = document.getElementById('spawn-notifications')!;

  private upgradeCards: Map<Trait, {
    levelEl: HTMLElement;
    costEl:  HTMLElement;
    btn:     HTMLButtonElement;
  }> = new Map();

  private upgradeCb: ((trait: Trait) => void) | null = null;

  constructor() {
    this.buildUpgradePanel();
  }

  private buildUpgradePanel(): void {
    const panel = document.getElementById('upgrade-panel')!;
    panel.addEventListener('contextmenu', (e) => e.preventDefault());
    for (const def of TRAIT_DEFS) {
      const card = document.createElement('div');
      card.className = 'upgrade-card';
      card.innerHTML = `
        <div class="upgrade-header">${def.icon} ${def.label}</div>
        <div class="upgrade-level">Lv.<span class="upg-lv">0</span></div>
        <button class="upgrade-btn">업그레이드<br><span class="upg-cost">100💰</span></button>
      `;
      panel.appendChild(card);

      const btn = card.querySelector('.upgrade-btn') as HTMLButtonElement;
      btn.addEventListener('click', () => this.upgradeCb?.(def.trait));

      this.upgradeCards.set(def.trait, {
        levelEl: card.querySelector('.upg-lv')!,
        costEl:  card.querySelector('.upg-cost')!,
        btn,
      });
    }
  }

  onSpawnSoldier(cb: () => void): void {
    this.spawnBtn.addEventListener('click', cb);
  }

  onUpgrade(cb: (trait: Trait) => void): void {
    this.upgradeCb = cb;
  }

  showSpawnNotification(charLabel: string, gradeLabel: string, gradeColor: number): void {
    const el = document.createElement('div');
    el.className = 'spawn-notif';
    el.style.color = '#' + gradeColor.toString(16).padStart(6, '0');
    el.textContent = `${charLabel} (${gradeLabel}) 소환!`;
    this.notifContainer.prepend(el);
    setTimeout(() => el.remove(), 2500);
  }

  update(state: GameState): void {
    this.goldEl.textContent         = String(Math.floor(state.gold));
    this.monsterCountEl.textContent = `${state.monsters.length} / ${MONSTER_LIMIT}`;
    this.soldierCountEl.textContent = String(state.soldiers.length);
    this.spawnBtn.disabled          = state.gold < 20 || state.gameOver || state.won;
    this.stageNumEl.textContent     = String(state.stage);
    this.stageTimerEl.textContent   = fmtTime(state.stageTimeRemaining);

    for (const [trait, els] of this.upgradeCards) {
      const level = state.upgrades[trait];
      const cost  = upgradeCost(level);
      els.levelEl.textContent = String(level);
      els.costEl.textContent  = level >= UPGRADE_MAX_LEVEL ? 'MAX' : `${cost}💰`;
      els.btn.disabled        = level >= UPGRADE_MAX_LEVEL || state.gold < cost || state.gameOver || state.won;
    }

    if (state.gameOver) this.gameOverEl.classList.add('visible');
    if (state.won)      this.victoryEl.classList.add('visible');
  }
}
