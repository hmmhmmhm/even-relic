# even-relic

Even Realities G2용 다국어 HUD를 탐색하는 팬메이드 프로토타입이다.
현재 버전은 실제 기능보다 `Peripheral Focus` 화면의 정보 밀도를 안경에서
검증하는 데 집중한다.

## 현재 하드웨어 프로토타입

- 선택한 HUD 시안을 WebView의 576 x 288 Canvas에 렌더링한다.
- Canvas를 288 x 144 PNG 네 장으로 분할한다.
- Even Hub SDK의 Image 컨테이너 네 개로 BLE 순차 전송한다.
- 입력 수신에 필요한 Text 컨테이너 하나는 공백이라 보이지 않는다.
- G2나 R1에서 아래로 스크롤하면 다음 HUD 페이지, 위로 스크롤하면 이전
  페이지를 같은 네 컨테이너에 순차 전송한다.
- 더블 탭하면 플러그인 종료 요청을 보낸다.

시간, 지도, 위치, 음성 레벨과 미션·뉴스 값은 모두 고정된 목업이다. 최초 네
이미지 전송과 각 페이지 갱신에는 수 초가 걸릴 수 있으며 애니메이션이나
자동 갱신은 없다.

## 현재 검증된 하드웨어 상태

2026-07-26에 SDK `0.0.10`으로 실제 G2 이미지 전송에 처음 성공했다.

- 클릭 뒤 `200×100` 1-bit BMP가 표시됐다.
- `288×144` PNG 네 장으로 구성한 `576×288` 전체 HUD가 표시됐다.
- `576×288` 최대영역 교정 패턴과 시스템 대시보드의 보이는 외곽 크기가
  같았다.
- 같은 기기에서 SDK `0.0.12`는 두 경로 모두 `SENDFAILED`를 반환했다.

SDK 버전별 차이, 정확한 재현 명령과 성공 증거는
[G2 이미지 전송 최초 성공 기록](docs/hardware/2026-07-26-first-g2-image-success.md)에
보존한다.

## 전술 Canvas HUD 실험

기존 `/`는 선택한 PNG 시안을 전송하는 하드웨어 기준선으로 보존한다.
새 `/hud-canvas`는 원본 이미지를 사용하지 않고 시간, 나침반, 지도, 경로
안내, 마이크와 미션·뉴스를 `576×288` Canvas에 직접 크게 그린다.

첫 Canvas 버전은 실제 G2에서 기존 대시보드와 같은 외곽 크기로 보였고,
시간과 지도도 선명하게 읽혔다. 현재 후보는 ACC 칸을 제거한 자리에 큰
뉴스·미션 카드를 배치하고, 반복되는 닫힌 사각형을 열린 코너 프레임으로
바꿨다. 지도 경로와 중앙 방향 지시는 중간 밝기 아래선과 흰색 중심선을
겹쳐 전술 게임 HUD처럼 표현한다. 현재 후보는 실행 시점의 실제 시각을
`HH:MM:SS`로 표시하고, 지역·온도·날씨 목업과 Canvas 체크박스 기반 TODO
카드를 추가한다. 날씨와 나머지 HUD 값은 아직 정적 목업이다.

현재 HUD는 다음 네 페이지를 원형으로 순환한다.

1. `OVERVIEW`: 지도와 큰 뉴스 헤드라인·브리핑을 보여주는 기본 화면
2. `NAVIGATION`: 지도와 120m 우회전·다음 교차로 안내
3. `NEWS`: 헤드라인과 날씨를 큰 카드로 분산한 집중 화면
4. `TODO`: 큰 체크리스트와 오디오·G2/R1 연결 상태

기본 `OVERVIEW`에는 내비게이션 상태가 아닐 때 불필요한 `우회전`과
`다음 교차로`를 표시하지 않는다. 페이지 전환은 컨테이너를 다시 만들지
않고 기존 ID 2–5의 이미지 데이터만 직렬 갱신한다.

2026-07-26 Tailscale 하드웨어 테스트 URL은 다음과 같다.

```text
http://100.96.68.73:4173/hud-canvas?sdk=0.0.10&build=paged-hud-004
```

초는 최초 전송 또는 페이지 전환 때 Canvas를 다시 그린 순간의 값이다.
BLE로 이미지를 매초 재전송하지 않으므로 같은 페이지에 머무는 동안에는
자동으로 흐르지 않는다.

`/calibration-max`는 최대 표시 외곽을 비교하는 교정 화면이며
`/diagnostic-v10`은 클릭 뒤 작은 1-bit BMP를 보내는 전송 진단이다. 네
경로 모두 검증된 SDK `0.0.10` 계약을 유지한다.

## Windows와 실제 G2에서 실행

PC와 아이폰에서 Tailscale을 켠 뒤 PowerShell에서 실행한다.

```powershell
npm install
npm run dev -- --host 0.0.0.0 --port 4173 --strictPort
```

다른 PowerShell 창에서 QR을 띄운다.

```powershell
npm run qr
```

아이폰의 일반 카메라가 아니라 다음 경로에서 QR을 스캔한다.

1. Even Realities 앱을 연다.
2. `Even Hub`의 개발자 영역으로 이동한다.
3. `Scan QR`을 선택한다.
4. PC 화면의 QR을 스캔하고 이미지 네 장의 전송이 끝날 때까지 기다린다.

현재 `npm run qr`은 최초 성공 진단에 사용한 Mac의 Tailscale 주소
`http://100.96.68.73:4173`과 SDK `0.0.10`을 사용한다. 주소가 바뀌면
다음 명령으로 새 QR을 만든다.

```powershell
npx evenhub qr --url http://<TAILSCALE-IP>:4173 --external
```

Safari로 같은 주소를 열면 휴대폰 미리보기만 표시되고 안경 전송은
일어나지 않는다. 반드시 Even 앱의 QR 사이드로드로 열어야 SDK 브리지가
연결된다.

## 검증과 패키징

```powershell
npm test
npm run typecheck
npm run build
npm run test:sites
npm run pack
```

## 문서

- [G2 이미지 전송 최초 성공 기록](docs/hardware/2026-07-26-first-g2-image-success.md)
- [전체 Even Hub 개발 조사](docs/research/2026-07-25-even-hub-development-research.md)
- [G2 화면과 컴포넌트 제약](docs/research/2026-07-25-g2-display-ui-constraints.md)
- [G2 이미지 밀도 테스트 설계](docs/superpowers/specs/2026-07-25-g2-raster-density-test-design.md)
- [선택한 HUD 디자인](docs/design/README.md)
- [초기 구현 계획](docs/plans/2026-07-25-relic-hud-prototype.md)

## 범위

이 저장소는 비공식 팬메이드 실험이며 Even Realities 또는 CD PROJEKT와
관련이 없다. 브랜드 자산, 게임 로고와 원본 UI 리소스를 포함하지 않는다.
