import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadAllTemplates, getAttackTiming, type TemplateEntry } from '../character/CharacterRegistry';
import { createSoldierInstance, type SoldierInstance } from '../character/SoldierTypes';
import type { SoldierType } from '../core/state/GameState';
import { clearWeaponRegistry } from '../character/weaponMount';
import { initWeaponTuner } from './WeaponTuner';

// 무기 위치 전용 에디터 — 캐릭터 단독 렌더 + 애니 재생 + 무기 튜너
async function main(): Promise<void> {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1f2e);
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  scene.add(new THREE.GridHelper(6, 12, 0x335577, 0x223044));

  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.01, 100);
  camera.position.set(1.4, 1.3, 2.4);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.9, 0);
  controls.update();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const store = await loadAllTemplates();
  const entries = store.entries();

  // 캐릭터 드롭다운 구성
  const select = document.getElementById('char-select') as HTMLSelectElement;
  entries.forEach((e, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    const name = e.template.displayName ?? e.type;
    opt.textContent = `${name}${e.template.weapon ? '  ⚔️' : ''}`;
    select.appendChild(opt);
  });

  let current: SoldierInstance | null = null;
  let currentType: SoldierType = 'ranged';

  // 애니 재생 (blunt: 스크럽 상태와 충돌 안 나게 직접 제어)
  const playClip = (action: THREE.AnimationAction): void => {
    if (!current) return;
    current.attackAction.paused = false;
    current.mixer.stopAllAction();
    action.reset().play();
  };
  // 공격 애니를 fraction(0~1) 지점 포즈로 정지 (던지는 프레임 확인용)
  const poseAttack = (fraction: number): void => {
    if (!current) return;
    current.mixer.stopAllAction();
    const a = current.attackAction;
    a.reset(); a.play();
    a.paused = true;
    a.time = THREE.MathUtils.clamp(fraction, 0, 1) * a.getClip().duration;
    current.mixer.update(0);
  };

  const showEntry = (entry: TemplateEntry): void => {
    if (current) { scene.remove(current.model); current.mixer.stopAllAction(); }
    clearWeaponRegistry();
    current = createSoldierInstance(entry.template);
    currentType = entry.type;
    scene.add(current.model);
    setThrow(getAttackTiming(entry.type));
  };

  select.addEventListener('change', () => showEntry(entries[+select.value]));
  document.getElementById('btn-idle')!.addEventListener('click', () => current && playClip(current.idleAction));
  document.getElementById('btn-walk')!.addEventListener('click', () => current && playClip(current.walkAction));
  document.getElementById('btn-attack')!.addEventListener('click', () => current && playClip(current.attackAction));

  // ── 던지는 프레임 패널 ──────────────────────────────────────────────────────
  const throwPanel = document.createElement('div');
  throwPanel.style.cssText = `
    position:fixed; top:16px; right:16px; z-index:50; width:230px;
    background:rgba(10,14,30,0.92); border:1px solid #3a5a9a; border-radius:8px;
    padding:10px 12px; color:#cfe; font:12px 'Segoe UI',sans-serif;`;
  throwPanel.innerHTML = `<div style="font-weight:bold;color:#9cf;margin-bottom:6px">🎯 던지는/타격 프레임</div>`;

  const throwRow = document.createElement('div');
  throwRow.style.cssText = 'display:flex;align-items:center;gap:6px;';
  const throwSlider = document.createElement('input');
  throwSlider.type = 'range'; throwSlider.min = '0'; throwSlider.max = '1'; throwSlider.step = '0.01';
  throwSlider.style.flex = '1';
  const throwNum = document.createElement('input');
  throwNum.type = 'number'; throwNum.min = '0'; throwNum.max = '1'; throwNum.step = '0.01';
  throwNum.style.cssText = 'width:54px;background:#05080f;color:#cfe;border:1px solid #345;border-radius:3px;';
  throwRow.append(throwSlider, throwNum);

  const throwSave = document.createElement('button');
  throwSave.textContent = '💾 저장';
  throwSave.style.cssText = 'width:100%;margin-top:6px;padding:5px;background:#1d4023;color:#cfe;border:1px solid #3a7a4a;border-radius:4px;cursor:pointer;';

  const throwHint = document.createElement('div');
  throwHint.style.cssText = 'margin-top:6px;color:#7a90b0;font-size:11px;';
  throwHint.textContent = '슬라이더를 움직이면 그 프레임 포즈로 정지됨';

  throwPanel.append(throwRow, throwSave, throwHint);
  document.body.appendChild(throwPanel);

  let throwFraction = 0.1;
  function setThrow(f: number): void {
    throwFraction = THREE.MathUtils.clamp(f, 0, 1);
    throwSlider.value = String(throwFraction);
    throwNum.value = throwFraction.toFixed(2);
  }
  const onThrowInput = (f: number): void => { setThrow(f); poseAttack(throwFraction); };
  throwSlider.addEventListener('input', () => onThrowInput(parseFloat(throwSlider.value)));
  throwNum.addEventListener('input', () => onThrowInput(parseFloat(throwNum.value)));
  throwSave.addEventListener('click', async () => {
    throwSave.textContent = '저장 중…';
    try {
      const res = await fetch('/__save-tuning', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'attackTiming', key: currentType, value: throwFraction }),
      });
      throwSave.textContent = res.ok ? '✓ 저장됨' : '✗ 실패';
    } catch { throwSave.textContent = '✗ 실패'; }
    setTimeout(() => (throwSave.textContent = '💾 저장'), 1500);
  });

  initWeaponTuner();

  // 무기 있는 첫 항목을 기본 선택 (없으면 0번)
  const firstWeaponIdx = entries.findIndex(e => e.template.weapon);
  const startIdx = firstWeaponIdx >= 0 ? firstWeaponIdx : 0;
  select.value = String(startIdx);
  showEntry(entries[startIdx]);

  const clock = new THREE.Clock();
  const loop = (): void => {
    const delta = clock.getDelta();
    if (current) current.mixer.update(delta);
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  loop();
}

main();
