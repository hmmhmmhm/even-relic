# even-relic

Even Realities G2용 다국어 HUD를 탐색하는 팬메이드 프로토타입이다.
현재 버전은 실제 기능보다 `Peripheral Focus` 화면의 정보 밀도를 안경에서
검증하는 데 집중한다.

## 현재 하드웨어 프로토타입

- 선택한 HUD 시안을 WebView의 576 x 288 Canvas에 렌더링한다.
- Canvas를 288 x 144 PNG 네 장으로 분할한다.
- Even Hub SDK의 Image 컨테이너 네 개로 BLE 순차 전송한다.
- 입력 수신에 필요한 Text 컨테이너 하나는 공백이라 보이지 않는다.
- 더블 탭하면 플러그인 종료 요청을 보낸다.

시간, 지도, 위치, 음성, 센서와 뉴스 값은 모두 고정된 목업이다. 최초 네
이미지 전송에는 수 초가 걸릴 수 있으며 애니메이션이나 자동 갱신은 없다.

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
