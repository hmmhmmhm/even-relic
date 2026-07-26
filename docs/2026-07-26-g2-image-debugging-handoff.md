# G2 이미지 전송 디버깅 인수인계

- 마지막 갱신: 2026년 7월 26일
- 저장소: <https://github.com/hmmhmmhm/even-relic>
- 작업 브랜치: `feature/g2-session-rebuild`
- 문서 작성 시 HEAD: `2c8a4c3`
- 현재 진단 빌드: `hud400-step1`
- 현재 SDK: `@evenrealities/even_hub_sdk` 0.0.11
- 실기기: Even Realities G2, iPhone, Even Realities iOS 앱
- 개발 환경: Windows, PowerShell, Tailscale

## 한 줄 상태

공식 형식의 200×100 PNG 한 장은 실제 G2에 표시됐고 RELIC의 200×100 HUD도
표시됐다. 400×200 HUD도 개발 중 한 차례 크게 표시됐다. 현재 문제는 PNG 형식이나
안경 고장이 아니라 Even Hub 페이지 수명주기다. 새 실행에서 시작 페이지 생성이
`invalid`를 반환하고, 기존 페이지를 이미지 페이지로 바꾸는
`rebuildPageContainer()`가 `false`를 반환한다.

## 다른 컴퓨터에서 바로 시작하기

### 1. 저장소와 브랜치 받기

```powershell
git clone https://github.com/hmmhmmhm/even-relic.git
Set-Location even-relic
git switch --track origin/feature/g2-session-rebuild
npm ci
```

`main`에는 현재 이미지 진단 작업이 없다. 반드시
`feature/g2-session-rebuild` 브랜치를 사용한다.

### 2. 기준 상태 검증하기

```powershell
npm test
npm run typecheck
npm run build
npm run test:sites
```

문서 작성 시 기준 결과는 다음과 같다.

- Vitest: 6개 파일, 테스트 35개 통과
- TypeScript: 오류 없음
- Vite 프로덕션 빌드: 성공
- 정적 서버 및 PNG 형식 검사: 테스트 7개 통과

### 3. Tailscale 정적 서버 실행하기

실기기 진단에는 Vite 개발 서버보다 프로덕션 정적 미리보기를 권장한다. 개발
서버의 HMR과 소스 변경 중 재로딩을 제외하기 위해서다.

```powershell
npm run build
npm run preview -- --host 0.0.0.0 --port 4180 --strictPort
```

다른 PowerShell 창에서 새 PC의 Tailscale 주소를 확인한다.

```powershell
tailscale ip -4
```

현재 `package.json`의 `npm run qr`은 이전 PC의 주소
`100.84.176.81`을 포함한다. 다른 컴퓨터에서는 그대로 사용하지 말고 다음처럼
새 주소로 QR을 만든다.

```powershell
$g2Ip = (tailscale ip -4 | Select-Object -First 1).Trim()
$g2Url = "http://${g2Ip}:4180/hud-density-v2?sdk=0.0.11&build=hud400-step1"
npx evenhub qr --url $g2Url
```

아이폰과 PC 모두 Tailscale에 연결되어 있어야 한다. 아이폰 Safari에서 URL을
여는 것은 네트워크와 휴대폰 WebView 미리보기만 확인한다. 실제 안경 전송은
Even Realities 앱의 Even Hub 개발자 영역에서 QR을 스캔해 실행해야 한다.

### 4. 서버가 하나만 실행 중인지 확인하기

```powershell
Get-NetTCPConnection -LocalPort 4180 -State Listen |
  Select-Object LocalAddress, LocalPort, OwningProcess
```

리스너는 하나여야 한다. 새로 빌드한 뒤 같은 `vite preview` 프로세스가 변경된
`dist`를 제공하는지 다음 명령으로 확인한다.

```powershell
$page = Invoke-WebRequest -UseBasicParsing -Uri $g2Url
$asset = [regex]::Match(
  $page.Content,
  'src="([^"]+\.js)"'
).Groups[1].Value
$bundle = Invoke-WebRequest -UseBasicParsing -Uri (
  "http://${g2Ip}:4180" + $asset
)

$page.StatusCode
$page.Content.Contains("/@vite/client")
$bundle.Content.Contains("hud400-step1")
$bundle.Content.Contains("STAGE 1 STARTUP RESULT")
```

기준값은 각각 `200`, `False`, `True`, `True`다.

## 입증된 사실

### 하드웨어와 기본 이미지 경로

- Even Realities의 `Photos` 앱은 같은 iPhone과 G2에서 사진을 정상 전송한다.
- 공식 샘플과 같은 200×100, 8-bit RGB PNG가 SDK 0.0.11에서 실제 안경에
  표시됐다.
- 같은 경로로 RELIC 200×100 HUD가 실제 안경에 표시됐다.
- 표시된 200×100 이미지는 정상이나 작았다.
- 200×100 타일 네 장으로 만든 400×200 HUD가 개발 중 실제 안경에 한 차례 크게
  표시됐다.
- 따라서 G2 디스플레이, iPhone과 G2의 BLE 이미지 전송, PNG 자체가 모두
  일괄적으로 고장 난 상태는 아니다.

### SDK 호환성

- SDK 0.0.12는 `ImageRawDataUpdate`에 `compressMode: 2`를 추가해 전송한다.
- 현재 iPhone 앱과 G2 조합에서는 이 전송이 `SENDFAILED`로 실패했다.
- SDK 0.0.11은 같은 PNG를 `compressMode` 없이 보내며 실제 G2에서 성공했다.
- 그래서 `package.json`과 `app.json`은 0.0.11로 고정되어 있다.

자세한 비교는
[G2 이미지 전송 호환성 진단](research/2026-07-26-g2-image-transport-compatibility.md)에
기록되어 있다.

### 페이지와 타이밍

- 텍스트 전용 시작 페이지는 실제 G2에 표시됐다.
- `RELIC HUD LOADING...` 문구를 3초간 유지하는 경로도 실행됐다.
- 텍스트 페이지를 이미지 네 장의 페이지로 바꾸는 페이지 재구성은 `false`였다.
- 이미지 전송 사이의 지연 이전에 페이지 재구성이 실패하므로, 전송 간격만으로 현재
  실패를 설명할 수 없다.
- 정적 4180 서버에서도 같은 페이지 수명주기 실패가 재현됐다. Vite 개발 서버가
  즉시 종료되거나 HMR이 끊긴 현상만으로 설명할 수 없다.
- `npm run qr`은 앱 서버를 시작하는 명령이 아니라 URL의 QR을 만드는 명령이다.
  해당 터미널이 끝나더라도 별도로 실행한 Vite 서버가 유지되면 정상이다.
- 마지막 확인에서는 4180 포트에 리스너가 하나만 있었고, 프로덕션 해시 번들과
  `hud400-step1` 문자열이 HTTP로 제공됐다.

## 아직 입증되지 않은 사항

- 400×200 페이지가 언제나 생성 또는 재구성 가능한지는 입증되지 않았다.
- `createStartUpPageContainer()`가 반복해서 `invalid`가 되는 정확한 호스트
  조건은 확인되지 않았다.
- 실패 후 남은 페이지가 같은 앱의 페이지인지, 호스트가 소유하는 전경 페이지인지
  확인되지 않았다.
- `shutDownPageContainer(0)`과 `rebuildPageContainer()`가 모두 `false`였던
  경우의 내부 오류 코드는 공개 API에서 얻지 못했다.
- 가장 최근에 보인 로딩 문구가 새 페이지의 문구인지 이전에 남은 페이지의 문구인지
  구분하지 못했다. 다음 실험에서는 빌드별 고유 문구가 필요하다.
- 이미지 컨테이너 1개를 포함한 새 시작 페이지가 깨끗한 세션에서
  `success`로 생성되는지는 이번 점진식 빌드에서 아직 확인되지 않았다.

## 시도 이력

### 초기 WebView와 이미지 전송

1. React, TypeScript와 Vite로 576×288 RELIC HUD 미리보기를 만들었다.
2. 휴대폰 WebView에서는 HUD가 보였지만 WebView DOM이나 Canvas가 안경에 자동
   미러링되지 않는다는 점을 확인했다.
3. Canvas를 PNG로 만들고 이미지 컨테이너에 보내는 여러 진단 빌드를 만들었다.
4. 초기 빌드에서는 `SENDFAILED`, `PAGE CREATE FAILED: invalid`,
   `imageException`이 번갈아 나타났다.
5. 공식 이미지 예제를 별도 경로로 실행해 앱 코드와 이미지 형식 문제를 분리했다.

### 이미지 형식 분리

공식 샘플을 이용한 세 가지 형식 실험에서 첫 형식은 실패했고 두 번째와 세 번째
형식은 성공했다. 세 번째 형식은 작은 녹색 박스로 표시됐다. 이후 공식 샘플과
RELIC 자산을 모두 200×100, 8-bit RGB PNG로 고정했다.

`public/`의 현재 자산은 다음과 같다.

- `evenhub-official-sample.png`: 공식 원본 보존본
- `evenhub-sample-8bit-200x100.png`: 성공한 8-bit RGB 기준 자산
- `relic-hud-200x100.png`: 성공한 단일 RELIC HUD
- `relic-hud-400x200/`: 400×200 HUD를 나눈 200×100 타일 네 장

### SDK 0.0.12와 0.0.11 비교

| 빌드 | SDK | 결과 |
| --- | --- | --- |
| `png8-1` | 0.0.12 | 공식 8-bit RGB PNG도 `SENDFAILED` |
| `sdk011-1` | 0.0.11 | 작은 공식 이미지가 실제 G2에 표시됨 |
| `hud200-1` | 0.0.11 | RELIC 200×100 HUD가 표시됐으나 작음 |

이 비교로 이미지 실험은 0.0.11에 고정됐다.

### 400×200 그리드와 페이지 수명주기

| 빌드 | 구성과 목적 | 실제 결과 |
| --- | --- | --- |
| `hud400-1` | 200×100 이미지 네 장을 중앙 400×200 그리드로 구성 | 개발 중 한 차례 크게 표시됨. 이후 다시 열었을 때 rebuild `false` |
| `hud400-reset1` | invalid 페이지를 종료한 뒤 다시 열도록 유도 | `PAGE REBUILD RESULT: false`, `STALE PAGE CLOSE RESULT: false` |
| `hud400-reuse1` | 기존 400×200 컨테이너를 재사용 | 페이지 준비 로그 뒤 이미지 전송 단계로 진행되지 않음 |
| `hud400-loading1` | 기존 페이지의 텍스트를 갱신해 활성화 | `LOADING TEXT RESULT: false`; 이미지 전송 경로도 실패 |
| `hud400-text3s` | 텍스트 전용 페이지 생성, 3초 후 이미지 4개 페이지 rebuild | 로딩 글자는 보였지만 `HUD GRID REBUILD RESULT: false` |
| `hud400-step1` | 이미지 수를 1→2→3→4로 늘리고 단계마다 재전송 | 시작 페이지가 `invalid`; Stage 1 rebuild도 `false` |

### 가장 최근 실기기 결과

1. 정상 작동하는 Photos 앱을 실행했다.
2. Photos 앱을 더블 탭으로 종료했다.
3. `hud400-step1`을 다시 실행했다.
4. `RELIC HUD LOADING...` 문구는 안경에 표시됐다.
5. `STAGE 1 STARTUP RESULT`는 `success`가 아니었고 최종 로그는
   `STAGE 1 REBUILD FAILED`였다.

코드상 `STAGE 1 REBUILD FAILED`는 시작 페이지 생성 결과가 `invalid`일 때만
발생한다. 다만 로딩 문구가 새 실행에서 생성된 것인지 기존 페이지에서 남은 것인지
구분할 고유 문자열이 없으므로, 이 결과만으로 새 Stage 1 페이지가 생성됐다고 보면
안 된다.

## 현재 코드 구성

| 파일 | 역할 |
| --- | --- |
| `src/App.tsx` | URL별 진단 모드 선택과 휴대폰 로그 표시 |
| `src/glasses.ts` | 공식 샘플, Canvas, BMP를 포함한 이전 이미지 진단 경로 |
| `src/hud-density.ts` | 성공한 RELIC 200×100 단일 이미지 경로 |
| `src/hud-grid.ts` | 현재 1→2→3→4 점진식 400×200 그리드 진단 |
| `src/hud-grid.test.ts` | 단계별 페이지 수와 직렬 전송·중단 경계 테스트 |
| `tests/*format.test.mjs` | PNG 크기, 색상 형식과 정적 자산 검사 |
| `public/relic-hud-400x200/` | 현재 전송하는 네 개의 200×100 타일 |

### 현재 `hud400-step1` 순서

```text
브리지 연결
  → 로딩 텍스트 + TL 이미지 컨테이너로 Stage 1 시작 페이지 생성
  → 생성 결과가 invalid면 같은 Stage 1 페이지로 rebuild
  → 3초 대기
  → 로딩 텍스트를 공백으로 갱신
  → TL 전송 후 1초 대기
  → 이미지 2개 페이지 rebuild
  → TL, TR 재전송하며 각각 1초 대기
  → 같은 방식으로 이미지 3개와 4개까지 증가
```

현재 실기기에서는 첫 번째 시작 페이지 생성이 `invalid`를 반환하고, 이어지는
Stage 1 페이지 재구성이 `false`가 되어 이미지 바이트 전송 전에 중단된다.

## 진단 URL

| 경로 | 용도 |
| --- | --- |
| `/diagnostic-v10` | 1-bit BMP 수동 전송 진단 |
| `/diagnostic-v11` | 공식 PNG 원시 바이트 진단 |
| `/hud-density-v1` | 성공한 200×100 RELIC HUD 기준 경로 |
| `/hud-density-v2` | 현재 400×200 점진식 그리드 진단 |

새 컴퓨터에서는 호스트 부분을 해당 PC의 Tailscale IP로 바꾼다.

```text
http://<TAILSCALE-IP>:4180/hud-density-v2?sdk=0.0.11&build=hud400-step1
```

## 다음 작업 우선순위

이미지 형식, 압축 방식과 전송 지연을 다시 바꾸기 전에 페이지 수명주기를 분리해야
한다. 여러 수정이 실패했으므로 다음 단계는 기존 흐름에 조건을 더 붙이는 방식보다
페이지 소유권과 종료 구조를 다시 잡는 편이 낫다.

### 1. 새 페이지와 남은 페이지를 구분하기

- 로딩 문구에 빌드명과 실행별 짧은 nonce를 표시한다.
- 예: `STEP1 7F3A LOADING`
- 안경에 보인 문자열과 휴대폰 로그의 nonce가 같을 때만 새 페이지로 판단한다.

### 2. 종료 이벤트를 가장 먼저 등록하기

현재 더블 탭 종료 구독은 Stage 4가 끝난 뒤 등록된다. 중간에 실패하면 종료
구독이 없는 페이지가 남을 수 있다.

- 브리지를 얻은 직후 `onEvenHubEvent()`를 등록한다.
- 생성, rebuild 또는 전송이 실패해도 더블 탭 종료가 동작하게 한다.
- `beforeunload`에서 구독 해제와 페이지 정리 정책을 명시한다.
- 자동 종료는 다른 전경 앱을 닫을 위험이 있으므로 반환값과 페이지 소유권을 먼저
  기록한 뒤 결정한다.

### 3. rebuild 없는 최소 Stage 1 경로를 만든다

다음 실험은 점진식 전체 루프가 아니라 아래 한 경로만 포함하는 것이 좋다.

```text
고유 로딩 문구 + 이미지 컨테이너 1개로 startup create
  → create 결과가 success가 아니면 즉시 중단
  → invalid에서 rebuild하지 않음
  → success면 3초 후 TL 한 장만 전송
  → 결과를 유지하고 종료 이벤트 대기
```

이 실험이 성공하기 전에는 이미지 2개 이상 rebuild를 다시 시험하지 않는다.

### 4. 원시 호스트 결과를 보존하기

- SDK enum으로 정규화하기 전의 create 반환값도 로그에 표시한다.
- rebuild와 shutdown 호출 시 요청한 컨테이너 수, ID와 이름을 함께 기록한다.
- 가능하면 Even Realities iOS 앱 버전, G2 펌웨어 버전과 실행 시각도 기록한다.

## 관련 문서

- [전체 Even Hub 및 R1 개발 조사](research/2026-07-25-even-hub-development-research.md)
- [G2 화면과 SDK 컴포넌트 제약](research/2026-07-25-g2-display-ui-constraints.md)
- [SDK 0.0.11 이미지 호환성](research/2026-07-26-g2-image-transport-compatibility.md)
- [점진식 그리드 진단 설계](superpowers/specs/2026-07-26-g2-incremental-grid-diagnostic-design.md)
- [점진식 그리드 구현 계획](superpowers/plans/2026-07-26-g2-incremental-grid-diagnostic.md)
- [선택한 HUD 디자인 기준](design/README.md)

## 관련 커밋

| 커밋 | 내용 |
| --- | --- |
| `8ac63db` | WebView에 진단 빌드명 표시 |
| `bf15ad7` | 기존 G2 페이지 세션 진단 추가 |
| `48c3491` | 200×100 8-bit RGB 기준 PNG 추가 |
| `1afbdfc` | SDK 0.0.11 비교 빌드 |
| `2a73e2b` | 이미지 전송 호환성 결과 문서화 |
| `acc18a9` | RELIC 200×100 HUD 밀도 실험 |
| `50d6c9c` | RELIC 400×200 네 타일 실험 |
| `e4adc3f` | 실패한 페이지 종료 실험 |
| `90a0297` | 기존 이미지 컨테이너 재사용 실험 |
| `173c90a` | 텍스트 업데이트로 페이지 활성화 실험 |
| `52b7ab4` | 텍스트 전용 페이지 후 그리드 rebuild 실험 |
| `8037ca9` | 1→2→3→4 점진식 rebuild 실험 |
| `2c8a4c3` | 현재 `hud400-step1` 빌드명 |

## 작업 재개 전 체크리스트

- [ ] `feature/g2-session-rebuild` 브랜치인지 확인한다.
- [ ] SDK가 0.0.11인지 확인한다.
- [ ] 테스트 35개와 형식 테스트 7개를 실행한다.
- [ ] 새 PC의 Tailscale IP로 URL과 QR을 만든다.
- [ ] 4180 포트 리스너가 하나인지 확인한다.
- [ ] 안경에 실행별 고유 로딩 문구를 표시한다.
- [ ] `create`가 `success`인 실행에서만 이미지 한 장을 전송한다.
- [ ] 실패 직전과 직후의 전체 WebView 로그를 저장한다.
- [ ] 실기기 결과가 확인되기 전에는 하드웨어 문제가 해결됐다고 기록하지 않는다.
