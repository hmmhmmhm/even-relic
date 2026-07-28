# even-relic

Even Realities G2에서 빠르게 읽을 수 있는 개인용 전술 HUD를 만드는
팬메이드 프로토타입이다. 현재 기준 화면은 `/hud-canvas-fast`이며,
576×288 Canvas 한 장을 네 개의 288×144 이미지로 나누어 G2에 직렬
전송한다.

원격에 보존한 물리 G2 기준선은 `@evenrealities/even_hub_sdk`
`0.0.11`이다. 현재 로컬 실험은 SDK만 `0.0.12`로 올려 공식 LZ4 이미지
전송을 다시 검증하며, Canvas·타일·직렬 전송 규칙은 기준선과 동일하다.
실험은 실제 기기 승인 전 원격에 푸시하지 않는다.

## 현재 HUD

대시보드는 왼쪽 288×288 실시간 지도와 오른쪽 288×288 정보 영역으로
구성한다. 페이지 전환 때는 오른쪽 두 타일만 갱신하고, 현재 페이지를 한 번
탭하면 네 타일 전체를 사용하는 상세 화면을 연다.

페이지 순서는 다음과 같다.

1. `OVERVIEW`: 시각, 날짜, 날씨, 연결된 단일 기기의 배터리
2. `NEWS`: SBS 최신 뉴스 제목 최대 여섯 개
3. `TODO`: 체크리스트 세 개와 오늘 진행률
4. `NAVIGATION`: ORS 상태, 남은 거리, 다음 동작과 목적지

G2 전송 계약은 다음과 같다.

- 최초 화면, 복원, 모든 전체 화면 상세 덱: `3 → 5 → 2 → 4`
- 페이지 전환: 오른쪽 `3 → 5`
- 지도 이동: 왼쪽 `2 → 4`
- 시계와 보이는 배터리 변경: 오른쪽 위 `3`
- 승인된 한 번의 이미지 갱신 안에서만 타일을 직렬 전송
- 전송 중 들어온 갱신 요청은 적재·통합·재시도하지 않고 즉시 폐기

## 키 없이 동작하는 기능

| 기능 | 데이터 소스 | 갱신 방식 |
| --- | --- | --- |
| 현재 위치 | Even Hub SDK | 최초 1회, 이후 `15초 / 15m` |
| 날씨 | Open-Meteo | 15분 캐시와 포그라운드 재확인 |
| 뉴스 | allowlist 기반 SBS RSS 프록시 | 10분 클라이언트 캐시 |
| 도로와 지명 | OpenStreetMap, Overpass | 위치 셀 변경 시 |
| 시계 | 로컬 시각 | 매분 경계 |
| 배터리 | Even SDK 기기 상태 이벤트 | 값이 바뀔 때 |

현재 위치를 얻지 못하면 최근 위치를 사용하고, 최근 위치도 없으면 `DEMO`로
표시한 홍대 좌표를 사용한다. 날씨, 뉴스, 지도 요청이 실패하면 마지막으로
성공한 값을 `stale` 상태로 유지한다.

RSS와 Overpass는 임의의 외부 URL을 받지 않는 같은 출처 서버 API를
거친다. 공개 서비스의 현재 사용 범위는 개인·비상업 프로토타입이다.

## 전체 화면 상세 덱

각 대시보드 페이지에서 G2나 R1을 한 번 탭하면 해당 내용을 네 타일 전체로
연다.

- `OVERVIEW`: 전체 화면 지도
- `NEWS`: 실제 RSS 기사 제목, 요약, 발행 시각을 한 건씩 표시
- `TODO`: 저장된 체크리스트 전체와 현재 선택 항목 표시
- `NAVIGATION`: 선택한 경로 동작, 동작 거리, 전체 남은 거리 표시

뉴스와 내비게이션에서는 아래·위 스크롤로 다음·이전 항목을 선택한다.
TODO에서는 스크롤로 항목을 선택하고 한 번 탭하여 완료 상태를 바꾼다.
변경된 TODO는 Even 로컬 저장소의 `relic:todos:v1`에 보존한다.
내비게이션에서 한 번 탭하면 현재 활성 동작으로 돌아간다. 모든 상세
화면에서 빠르게 두 번 탭하면 해당 대시보드 페이지로 복귀한다.

전체 화면 지도의 제스처는 다음과 같다.

- 아래로 스크롤: 확대
- 위로 스크롤: 축소
- 줌 반경: 850m, 650m, 500m, 375m, 280m
- 빠르게 두 번 탭: `OVERVIEW`로 복귀

선택한 줌은 대시보드와 전체 화면 지도, 위치 이동 사이에서 유지된다.
모든 상세 화면의 목록과 줌 경계에서 추가 스크롤은 대시보드 페이지
이동으로 전달하지 않는다.

대시보드에서 빠르게 두 번 탭하면 앱을 종료하지 않고 검정 이미지 네 장을
보내 표시 픽셀만 끈다. 다시 두 번 탭하면 최신 시각, 배터리, 위치와
페이지를 복원한다. 이는 G2의 공식 절전 모드가 아니므로 앱과 이벤트
리스너는 계속 실행된다.

## 선택형 ORS 길찾기

목적지 검색과 경로 계산만 OpenRouteService 서버 키가 필요하다. 키는
서버 환경 변수 `ORS_API_KEY`로만 읽으며 Vite 클라이언트 변수나 소스,
EHPK, 응답, 로그에는 포함하지 않는다.

키가 없으면 다음 상태가 정상이다.

- 위치, 날씨, 뉴스와 OSM 지도는 계속 동작
- 폰 화면에는 목적지 입력창을 표시하지 않음
- G2 `NAVIGATION` 페이지는 `경로 키 필요` 표시
- 검색과 경로 API는 `ROUTING_DISABLED` 반환

키가 있으면 폰 화면에서 한국 목적지를 검색하고 도보, 자전거, 자동차 중
하나를 선택할 수 있다. 활성 경로는 OSM 도로 위에 표시되며 G2에는 남은
거리와 다음 동작이 나온다.

길찾기 중에는 위치 조건을 `2초 / 5m`로 높인다. 경로에서 35m 이상
벗어난 위치가 세 번 이어지면 경로를 다시 계산한다. 재탐색은 30초에 한
번만 허용하고 동시에 하나만 요청한다. 길찾기를 종료하면 경로를 지우고
일반 지도 조건인 `15초 / 15m`로 돌아간다.

최근 경로는 최대 여섯 시간 보존한다. 앱을 다시 열었을 때는 자동 안내를
시작하지 않고 `stale`로 표시하며, 폰 화면에서 다시 시작하거나 종료할 수
있다.

## 로컬 실행

Node.js 의존성을 설치한다.

```bash
npm install
```

Tailscale에서 접근할 개발 서버를 연다.

```bash
npm run dev -- --host 0.0.0.0 --port 4176 --strictPort
```

ORS를 시험할 때만 같은 서버 프로세스에 키를 전달한다.

```bash
ORS_API_KEY='<server-only-key>' \
  npm run dev -- --host 0.0.0.0 --port 4176 --strictPort
```

Even 앱의 `Even Hub → Scan QR`에서 다음 형태의 주소를 연다.

```text
http://<TAILSCALE-IP>:4176/hud-canvas-fast?sdk=<SDK>&build=<BUILD-ID>
```

일반 Safari에서는 Canvas 미리보기만 보이며 안경 전송은 일어나지 않는다.
G2 전송은 Even 앱 브리지로 열었을 때만 시작한다.

현재 SDK LZ4 실험 URL은 다음과 같다.

```text
http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.12&build=sdk-lz4-030
```

문제가 생기면 원격 커밋 `90a9421`의 `0.0.11` 기준선과 비교한다.

## 검증

프로젝트 테스트는 G2 개발 환경의 자원 경합을 막기 위해 항상 파일 단위로
직렬 실행한다.

```bash
npm test
npm run typecheck
npm run build
npm run test:sites
node --test --test-concurrency=1 \
  tests/api-router.test.mjs \
  tests/map-api.test.mjs \
  tests/news-api.test.mjs \
  tests/route-api.test.mjs
git diff --check
```

클라이언트에 ORS 키 접근이 없는지는 다음 명령으로 확인한다.

```bash
git grep -n "ORS_API_KEY" -- src app.json package.json
```

배포 패키지를 만들려면 다음 명령을 사용한다.

```bash
npm run pack
```

## 보존된 비교 및 진단 경로

- `/hud-canvas`: 기존 네 타일 전체 갱신 Canvas HUD
- `/hud-hybrid`: Canvas와 네이티브 Text 레이어 실험
- `/hud-hybrid-z`: 명시적 Text z-order 실험
- `/calibration-max`: 576×288 최대 표시 영역 교정
- `/diagnostic-v10`: 탭 후 1-bit BMP를 보내는 전송 진단

현재 제품 후보는 `/hud-canvas-fast`다. 나머지 경로는 G2 전송 문제를
재현하거나 과거 디자인과 비교하기 위해 보존한다.

## 주요 기록

- [최초 G2 이미지 전송 성공](docs/hardware/2026-07-26-first-g2-image-success.md)
- [SDK 0.0.11 전송 성공](docs/hardware/2026-07-27-sdk-0011-transport-success.md)
- [SDK 0.0.12 LZ4 실험](docs/hardware/2026-07-28-sdk-0012-lz4-experiment.md)
- [실시간 시계, 배터리, 이동 지도](docs/hardware/2026-07-27-g2-live-refresh.md)
- [OSM 지명 가독성](docs/hardware/2026-07-27-balanced-osm-labels.md)
- [전체 화면 지도 체크포인트](docs/hardware/2026-07-27-g2-fullscreen-map.md)
- [전체 화면 상세 덱 체크포인트](docs/hardware/2026-07-27-g2-fullscreen-detail-decks.md)
- [선택형 ORS 체크포인트](docs/hardware/2026-07-27-optional-ors-routing.md)
- [프로젝트 완료 기준표](docs/hardware/2026-07-27-project-completion-audit.md)

## 범위와 고지

이 저장소는 Even Realities 또는 CD PROJEKT와 관련 없는 비공식 팬메이드
프로토타입이다. 브랜드 자산, 게임 로고와 원본 게임 UI 리소스를 포함하지
않는다.
