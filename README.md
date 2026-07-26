# even-relic

Even Realities G2용 다국어 HUD를 탐색하는 비공식 팬메이드 프로토타입이다.
현재는 실제 센서 기능보다 `Peripheral Focus` 화면의 정보 밀도와 이미지 전송
경로를 실제 안경에서 검증하는 데 집중한다.

## 현재 상태

가장 먼저 읽을 문서는
[G2 이미지 전송 디버깅 인수인계](docs/2026-07-26-g2-image-debugging-handoff.md)다.
여기에 지금까지 시도한 모든 주요 전송 방식, 실기기 결과, 현재 실패 경계,
다른 Windows PC에서 작업을 재개하는 절차와 다음 진단 우선순위를 기록했다.

현재 확인된 핵심 결과는 다음과 같다.

- 공식 형식의 200×100, 8-bit RGB PNG는 SDK 0.0.11에서 실제 G2에 표시된다.
- RELIC 200×100 HUD도 표시됐지만 작다.
- 400×200 HUD가 개발 중 한 차례 크게 표시됐다.
- SDK 0.0.12 이미지 전송은 현재 기기 조합에서 `SENDFAILED`이므로 0.0.11에
  고정했다.
- 현재 미해결 문제는 `createStartUpPageContainer()`가 `invalid`를 반환하고
  `rebuildPageContainer()`가 `false`를 반환하는 페이지 수명주기다.

## 저장소 받기

현재 작업은 아직 `main`에 병합되지 않았다.

```powershell
git clone https://github.com/hmmhmmhm/even-relic.git
Set-Location even-relic
git switch --track origin/feature/g2-session-rebuild
npm ci
```

## Windows와 실제 G2에서 실행

PC와 아이폰에서 Tailscale을 켠다. 프로덕션 정적 미리보기를 4180 포트에
실행한다.

```powershell
npm run build
npm run preview -- --host 0.0.0.0 --port 4180 --strictPort
```

다른 PowerShell 창에서 해당 PC의 Tailscale IP로 개발 QR을 만든다.

```powershell
$g2Ip = (tailscale ip -4 | Select-Object -First 1).Trim()
$g2Url = "http://${g2Ip}:4180/hud-density-v2?sdk=0.0.11&build=hud400-step1"
npx evenhub qr --url $g2Url
```

`npm run qr`에는 이전 개발 PC의 Tailscale IP가 들어 있으므로 다른 PC에서는
위 명령을 사용한다.

QR은 아이폰의 일반 카메라나 Safari가 아니라 Even Realities 앱의 Even Hub
개발자 영역에서 스캔한다. Safari는 휴대폰 미리보기와 네트워크 연결만 확인하며
안경 SDK 브리지를 제공하지 않는다.

## 현재 진단 흐름

`/hud-density-v2`의 `hud400-step1` 빌드는 다음 순서로 동작한다.

```text
로딩 텍스트 + 이미지 1개 startup create
  → 3초 대기
  → 이미지 1개 전송
  → 이미지 2개 페이지 rebuild 및 재전송
  → 이미지 3개 페이지 rebuild 및 재전송
  → 이미지 4개 페이지 rebuild 및 재전송
```

각 이미지 전송 뒤 1초씩 기다린다. 현재 실기기에서는 시작 페이지가
`invalid`이고 Stage 1 rebuild가 `false`라 이미지 바이트 전송 전에 중단된다.

## 검증과 패키징

```powershell
npm test
npm run typecheck
npm run build
npm run test:sites
npm run pack
```

## 주요 문서

- [G2 이미지 전송 디버깅 인수인계](docs/2026-07-26-g2-image-debugging-handoff.md)
- [전체 Even Hub 및 R1 개발 조사](docs/research/2026-07-25-even-hub-development-research.md)
- [G2 화면과 컴포넌트 제약](docs/research/2026-07-25-g2-display-ui-constraints.md)
- [SDK 0.0.11 이미지 호환성](docs/research/2026-07-26-g2-image-transport-compatibility.md)
- [점진식 그리드 진단 설계](docs/superpowers/specs/2026-07-26-g2-incremental-grid-diagnostic-design.md)
- [점진식 그리드 구현 계획](docs/superpowers/plans/2026-07-26-g2-incremental-grid-diagnostic.md)
- [선택한 HUD 디자인](docs/design/README.md)

## 범위

시간, 지도, 위치, dB, STT, 방향, 가속도, 퀘스트와 뉴스는 현재 모두 고정된
목업 데이터다. 센서, 지도, STT와 뉴스 연동은 이미지 전송과 페이지 수명주기가
안정된 뒤 진행한다.

이 저장소는 Even Realities 또는 CD PROJEKT와 관련이 없는 비공식 팬메이드
실험이다. 브랜드 자산, 게임 로고와 원본 UI 리소스를 포함하지 않는다.
