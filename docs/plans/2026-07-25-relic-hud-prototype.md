# RELIC HUD Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 선택된 Peripheral Focus 시안을 576 x 288 G2 화면 비율의 정적 TypeScript HUD로 구현한다.

**Architecture:** React는 정적 HUD 영역만 조합하고 데이터는 한 개의 타입 안전한 상수에서 공급한다. CSS는 실제 G2의 검은 배경과 단색 녹색, 중앙 시야 확보, 축소 가능한 2:1 캔버스를 담당한다. 실제 Even Hub SDK와 센서 연결은 포함하지 않는다.

**Tech Stack:** TypeScript, React 19, Vite 6, Vitest, Testing Library

---

### Task 1: 요구사항 테스트

**Files:**
- Create: `src/App.test.tsx`
- Modify: `package.json`

- [ ] **Step 1: 테스트 도구를 설치하고 `npm test` 스크립트를 추가한다.**
- [ ] **Step 2: 시간, 장소, 방향, dB, STT, 가속도, 퀘스트와 뉴스가 렌더링되는 테스트를 작성한다.**
- [ ] **Step 3: 테스트를 실행해 현재 빈 앱에서 실패하는지 확인한다.**

### Task 2: 정적 HUD 구현

**Files:**
- Create: `src/App.tsx`
- Create: `src/main.tsx`
- Modify: `src/styles.css`
- Delete: `src/App.jsx`
- Delete: `src/main.jsx`
- Create: `tsconfig.json`

- [ ] **Step 1: 목업 데이터 타입과 `RelicHud` 컴포넌트를 작성한다.**
- [ ] **Step 2: 실제 576 x 288 비율과 Peripheral Focus 구성을 CSS로 구현한다.**
- [ ] **Step 3: 테스트를 실행해 통과하는지 확인한다.**
- [ ] **Step 4: 사용자 작성 TS/TSX/CSS가 총 450줄 이하인지 확인한다.**

### Task 3: 문서와 실행 안내

**Files:**
- Create: `README.md`
- Create: `docs/research/2026-07-25-g2-display-ui-constraints.md`
- Copy: `docs/research/2026-07-25-even-hub-development-research.md`
- Copy: `docs/design/selected-peripheral-focus.png`

- [ ] **Step 1: 조사 자료와 선택한 시각 기준을 저장한다.**
- [ ] **Step 2: Windows PowerShell 실행 명령과 프로토타입 범위를 README에 기록한다.**

### Task 4: 시각 QA

**Files:**
- Create: `design-qa.md`
- Create: `implementation-hud.png`
- Create: `comparison-hud.png`

- [ ] **Step 1: 로컬 서버를 실행하고 576 x 288 HUD 영역을 캡처한다.**
- [ ] **Step 2: 선택 이미지와 구현 캡처를 같은 비교 이미지에서 검토한다.**
- [ ] **Step 3: P0, P1, P2 차이를 수정하고 다시 캡처한다.**
- [ ] **Step 4: 최종 QA 결과를 `passed`로 기록한다.**

### Task 5: 검증과 공개 저장소

**Files:**
- Verify: all project files

- [ ] **Step 1: `npm test`, `npm run build`, `npm run test:sites`를 실행한다.**
- [ ] **Step 2: Git 저장소를 초기화하고 변경 파일을 검토한다.**
- [ ] **Step 3: `hmmhmmhm/even-relic` 공개 저장소를 생성한다.**
- [ ] **Step 4: 검증된 변경을 커밋하고 `main`에 푸시한다.**
