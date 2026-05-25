import type { GameState } from '../core/state/GameState';

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

  onSpawnSoldier(cb: () => void): void {
    this.spawnBtn.addEventListener('click', cb);
  }

  update(state: GameState): void {
    this.goldEl.textContent         = String(Math.floor(state.gold));
    this.monsterCountEl.textContent = `${state.monsters.length} / ${MONSTER_LIMIT}`;
    this.soldierCountEl.textContent = String(state.soldiers.length);
    this.spawnBtn.disabled          = state.gold < 20 || state.gameOver || state.won;
    this.stageNumEl.textContent     = String(state.stage);
    this.stageTimerEl.textContent   = fmtTime(state.stageTimeRemaining);

    if (state.gameOver) this.gameOverEl.classList.add('visible');
    if (state.won)      this.victoryEl.classList.add('visible');
  }
}
