# CLAUDE.md — WebGPU Defence 코딩 컨벤션

## 핵심 원칙: 함수화 · 모듈화 · 중복 최소화

### 1. 공통 로직은 반드시 별도 모듈로 추출
같은 로직이 두 곳 이상 등장하면 즉시 공통 모듈로 분리한다.

**예시:**
- GLTF 관련 유틸 → `src/rendering/gltfUtils.ts`
- 트랙 계산 → `src/systems/TrackSystem.ts`
- 게임 상태 초기화 → `src/state/GameState.ts`

### 2. 파일 역할을 명확히 분리
| 디렉토리 | 역할 |
|----------|------|
| `state/` | 순수 데이터 타입과 초기 상태. 렌더링/시스템에 의존하지 않음 |
| `systems/` | 게임 로직 (이동, 전투, 스폰). Three.js에 의존하지 않음 |
| `rendering/` | Three.js 씬 조작만 담당. 게임 로직을 직접 계산하지 않음 |
| `ui/` | HTML DOM 조작만 담당 |

### 3. 함수 단위 설계 원칙
- **함수 하나 = 한 가지 역할**. 로드, 변환, 클론, 상태 전이를 한 함수에 섞지 않는다.
- **순수 함수 우선**: 가능하면 입력 → 출력만 있는 형태로 작성한다.
- **loader 함수**: `loadXxxTemplate()` — GLB 파일 로드 및 전처리 (비동기)
- **factory 함수**: `createXxxInstance()` — 템플릿에서 클론 인스턴스 생성 (동기)

### 4. 렌더링 모듈 구조 (`src/rendering/`)
```
gltfUtils.ts        — GLTF 공통 유틸 (convertToBasic, makeInPlace, computeScale)
MonsterLoader.ts    — Warrok 모델 전용 로더 (gltfUtils 활용)
ArcherLoader.ts     — Archer 모델 전용 로더 (gltfUtils 활용)
EntityRenderer.ts   — 씬에 엔티티 추가/제거/업데이트 (각 Loader 활용)
```
새 캐릭터 추가 시: `XxxLoader.ts`만 추가하고 `EntityRenderer`에 연결한다.

### 5. 타입 정의 위치
- 시스템 간 공유되는 이벤트/데이터 타입은 해당 시스템 파일에서 `export`
  - 예: `AttackEvent` → `CombatSystem.ts`
- 렌더링 내부에서만 쓰이는 타입 (MeshData 등) → 해당 렌더링 파일 내 `interface`로 선언
- 전역 게임 상태 타입 → `state/GameState.ts`

### 6. 애니메이션 상태 관리 패턴
캐릭터 애니메이션은 **상태 머신** 방식으로 구현한다:
```
기본 상태 → 트리거 → 임시 상태 → 완료 이벤트 → 기본 상태 복귀
```
- `LoopOnce` + `clampWhenFinished` + `mixer.addEventListener('finished', ...)` 조합 사용
- 상태 전이 함수를 별도로 추출하거나 `SoldierMeshData` 내 메서드로 캡슐화

### 7. 금지 사항
- **복붙 금지**: `convertToBasic`, `makeInPlace` 등 공통 로직을 각 Loader에 복사하지 않는다
- **역할 혼재 금지**: 시스템 코드에서 Three.js 객체를 직접 생성하지 않는다
- **하드코딩 최소화**: 반복되는 상수는 파일 상단에 `const`로 선언한다

## 프로젝트 구조 요약
```
src/
  main.ts                    — 진입점
  Game.ts                    — 오케스트레이터 (init/loop/update만) ← 기능 추가 금지
  state/
    GameState.ts             — 데이터 타입 & 초기 상태
  systems/
    TrackSystem.ts           — 트랙 경로/거리 계산
    SpawnSystem.ts           — 몬스터 스폰 로직
    CombatSystem.ts          — 전투 & AttackEvent
  scene/
    SceneBuilder.ts          — 정적 씬 기하(바닥/트랙/기지/화살표) + 조명 ← 씬 변경은 여기
  input/
    InputController.ts       — 드래그/줌/리사이즈 이벤트 + 카메라 상태 ← 입력 변경은 여기
  rendering/
    gltfUtils.ts             — GLTF 공통 유틸 ← 중복 방지 핵심
    MonsterLoader.ts         — Warrok 로더
    ArcherLoader.ts          — Archer 로더 (Idle/Shot 포함)
    EntityRenderer.ts        — 씬 엔티티 관리
  ui/
    HUD.ts                   — HTML UI
  types/
    three-webgpu.d.ts        — WebGPU 타입
asset/
  warrok/                    — Warrok 모델 GLB
  Archer/                    — Archer 모델 GLB (Archer, ArcherIdle, ArcherShot, ArcherWalk)
```

## 협업 진입점 가이드
| 수정하고 싶은 것 | 담당 파일 |
|----------------|-----------|
| 맵/배경/오브젝트 추가 | `scene/SceneBuilder.ts` |
| 카메라 속도/줌 범위/드래그 감도 | `input/InputController.ts` |
| 새 캐릭터 모델 추가 | `rendering/XxxLoader.ts` 신규 생성 |
| 전투/스폰 밸런스 | `systems/CombatSystem.ts`, `SpawnSystem.ts` |
| UI 텍스트/버튼 | `ui/HUD.ts` |
| 게임 데이터 구조 | `state/GameState.ts` |
