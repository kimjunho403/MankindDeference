import type { GameState } from '../core/state/GameState';

const MONSTER_LIMIT = 100;

export class HUD {
  private goldEl         = document.getElementById('gold')!;
  private monsterCountEl = document.getElementById('monster-count')!;
  private soldierCountEl = document.getElementById('soldier-count')!;
  private spawnBtn       = document.getElementById('btn-spawn-soldier') as HTMLButtonElement;
  private gameOverEl     = document.getElementById('game-over')!;

  onSpawnSoldier(cb: () => void): void {
    this.spawnBtn.addEventListener('click', cb);
  }

  update(state: GameState): void {
    this.goldEl.textContent         = String(Math.floor(state.gold));
    this.monsterCountEl.textContent = `${state.monsters.length} / ${MONSTER_LIMIT}`;
    this.soldierCountEl.textContent = String(state.soldiers.length);
    this.spawnBtn.disabled          = state.gold < 20 || state.gameOver;

    if (state.gameOver) {
      this.gameOverEl.classList.add('visible');
    }
  }
}
