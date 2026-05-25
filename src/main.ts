import { Game } from './core/Game';

async function bootstrap(): Promise<void> {
  const game = new Game();
  await game.init();
  game.start();
}

bootstrap().catch(err => {
  console.error('Game init failed:', err);
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.textContent = `❌ 실패: ${(err as Error).message}`;
    loadingEl.style.color = '#ff4444';
  }
});
