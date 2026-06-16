import { setLiveWeaponParams, listWeaponKeys, getWeaponParams, type WeaponParams } from '../character/weaponMount';

interface Row {
  label: string;
  min: number; max: number; step: number;
  get(p: WeaponParams): number;
  set(p: WeaponParams, v: number): void;
}

const ROWS: Row[] = [
  { label: 'offset X', min: -0.5, max: 0.5, step: 0.005, get: p => p.offset[0],      set: (p, v) => (p.offset[0] = v) },
  { label: 'offset Y', min: -0.5, max: 0.5, step: 0.005, get: p => p.offset[1],      set: (p, v) => (p.offset[1] = v) },
  { label: 'offset Z', min: -0.5, max: 0.5, step: 0.005, get: p => p.offset[2],      set: (p, v) => (p.offset[2] = v) },
  { label: 'rot X°',   min: -180, max: 180, step: 1,     get: p => p.rotationDeg[0], set: (p, v) => (p.rotationDeg[0] = v) },
  { label: 'rot Y°',   min: -180, max: 180, step: 1,     get: p => p.rotationDeg[1], set: (p, v) => (p.rotationDeg[1] = v) },
  { label: 'rot Z°',   min: -180, max: 180, step: 1,     get: p => p.rotationDeg[2], set: (p, v) => (p.rotationDeg[2] = v) },
  { label: 'length',   min: 0.05, max: 2.0, step: 0.01,  get: p => p.targetLength,   set: (p, v) => (p.targetLength = v) },
];

// 무기 부착 위치/회전/크기를 화면에서 실시간 조정하는 dev 패널.
// 상단 드롭다운으로 무기(axe/spear 등)를 골라 독립적으로 튜닝하고, 하단에 복붙용 스니펫 출력.
export function initWeaponTuner(): void {
  let params: WeaponParams = getWeaponParams('');  // 선택 전 기본값
  const rows: { slider: HTMLInputElement; num: HTMLInputElement; row: Row }[] = [];

  const panel = document.createElement('div');
  panel.style.cssText = `
    position:fixed; top:16px; left:16px; z-index:50; width:250px;
    background:rgba(10,14,30,0.92); border:1px solid #3a5a9a; border-radius:8px;
    padding:10px 12px; color:#cfe; font:12px 'Segoe UI',sans-serif;`;
  panel.innerHTML = `<div style="font-weight:bold;color:#9cf;margin-bottom:6px">⚔️ Weapon Tuner</div>`;

  // 무기 선택 드롭다운 (열 때마다 등록된 무기로 갱신)
  const select = document.createElement('select');
  select.style.cssText = 'width:100%;margin-bottom:8px;background:#05080f;color:#cfe;border:1px solid #345;border-radius:3px;padding:3px;';
  const refreshKeys = (): void => {
    const keys = listWeaponKeys();
    const cur = select.value;
    select.innerHTML = '';
    for (const k of keys) {
      const opt = document.createElement('option');
      opt.value = k; opt.textContent = k;
      select.appendChild(opt);
    }
    if (keys.includes(cur)) select.value = cur;
    else if (keys.length) selectKey(keys[0]);
  };
  select.addEventListener('mousedown', refreshKeys);
  select.addEventListener('change', () => selectKey(select.value));
  panel.appendChild(select);

  // 💾 저장 버튼 — weaponParams.json에 현재 값 기록 (dev 서버 엔드포인트)
  const saveBtn = document.createElement('button');
  saveBtn.textContent = '💾 저장';
  saveBtn.style.cssText = 'width:100%;margin-top:6px;padding:5px;background:#1d4023;color:#cfe;border:1px solid #3a7a4a;border-radius:4px;cursor:pointer;font-size:12px;';
  saveBtn.addEventListener('click', async () => {
    if (!select.value) return;
    saveBtn.textContent = '저장 중…';
    try {
      const res = await fetch('/__save-tuning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'weapon', key: select.value, value: params }),
      });
      saveBtn.textContent = res.ok ? '✓ 저장됨' : '✗ 실패';
    } catch {
      saveBtn.textContent = '✗ 실패';
    }
    setTimeout(() => (saveBtn.textContent = '💾 저장'), 1500);
  });

  const snippet = document.createElement('pre');
  snippet.style.cssText = 'margin-top:8px;padding:6px;background:#05080f;border-radius:4px;color:#8f8;white-space:pre-wrap;font-size:11px;';

  const syncInputs = (): void => {
    for (const { slider, num, row } of rows) {
      const v = row.get(params);
      slider.value = String(v);
      num.value = String(v);
    }
  };
  const updateSnippet = (): void => {
    const r = (a: number[]): string => `[${a.map(n => +n.toFixed(3)).join(', ')}]`;
    snippet.textContent =
      `key: '${select.value}',\n` +
      `offset: ${r(params.offset)},\n` +
      `rotationDeg: ${r(params.rotationDeg)},\n` +
      `targetLength: ${+params.targetLength.toFixed(3)},`;
  };

  function selectKey(key: string): void {
    select.value = key;
    params = getWeaponParams(key);
    syncInputs();
    updateSnippet();
  }

  for (const row of ROWS) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:flex;align-items:center;gap:6px;margin:3px 0;';

    const name = document.createElement('span');
    name.textContent = row.label;
    name.style.cssText = 'width:54px;flex:none;';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(row.min); slider.max = String(row.max); slider.step = String(row.step);
    slider.style.flex = '1';

    const num = document.createElement('input');
    num.type = 'number';
    num.step = String(row.step);
    num.style.cssText = 'width:54px;flex:none;background:#05080f;color:#cfe;border:1px solid #345;border-radius:3px;';

    const onChange = (v: number): void => {
      if (!select.value) return;
      row.set(params, v);
      slider.value = String(v);
      num.value = String(v);
      setLiveWeaponParams(select.value, params);
      updateSnippet();
    };
    slider.addEventListener('input', () => onChange(parseFloat(slider.value)));
    num.addEventListener('input', () => onChange(parseFloat(num.value)));

    wrap.append(name, slider, num);
    panel.appendChild(wrap);
    rows.push({ slider, num, row });
  }

  panel.appendChild(saveBtn);
  panel.appendChild(snippet);
  document.body.appendChild(panel);

  syncInputs();
  updateSnippet();
}
