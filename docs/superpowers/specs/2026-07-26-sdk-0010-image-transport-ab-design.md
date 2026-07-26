# SDK 0.0.10 이미지 전송 A/B 진단 설계

## 배경

실제 G2에서 현재 루트의 첫 `288×144` PNG 타일과 `/diagnostic-v10`의
클릭 트리거 `200×100` 1-bit BMP가 모두 `SENDFAILED`를 반환했다. 두
실험은 이미지 형식, 크기와 전송 시점이 다르지만 SDK에서 안경으로 이미지를
보내는 단계는 같다.

현재 앱은 `@evenrealities/even_hub_sdk` `0.0.12`를 사용한다. 공식 이미지
템플릿은 `0.0.10`을 사용하며, 같은 `ImageRawDataUpdate`를 직렬화했을 때
`0.0.12`만 `compressMode: 2`를 추가한다. `0.0.12` 변경 기록도 이미지
전송에 LZ4 압축을 추가했다고 설명한다.

## 목표

현재 Even 앱과 G2 펌웨어를 바꾸지 않은 채 SDK 버전만 `0.0.10`으로 낮춰
`SENDFAILED`가 `0.0.12`의 압축 전송 모드와 관련 있는지 판별한다.

이번 실험은 SDK 다운그레이드를 제품 방향으로 채택하지 않는다. 원인 분리를
위한 일회성 A/B 진단이다.

## 선택한 접근

로컬 진단 브랜치에서 SDK를 정확히 `0.0.10`으로 고정한다.

- `package.json`과 lockfile의 SDK 버전을 `0.0.10`으로 맞춘다.
- `app.json`의 최소 SDK 버전과 버전 계약 테스트도 `0.0.10`으로 맞춘다.
- `/diagnostic-v10`의 페이지 정의, 1-bit BMP 바이트, 클릭 트리거와 전송
  순서는 바꾸지 않는다.
- QR의 `build` 식별자만 `sdk-0010-ab`로 바꿔 이전 WebView와 구분한다.
- 현재 Tailscale 서버와 동일한 `4173` 포트를 사용한다.

## 검토한 대안

### `0.0.12` 요청에서 `compressMode`만 제거

SDK 내부 직렬화를 우회해야 하며 공식 API 계약을 벗어난다. 실패해도 SDK
버전 문제인지 우회 코드 문제인지 구분하기 어렵기 때문에 선택하지 않는다.

### Even 앱과 G2 펌웨어를 먼저 업데이트

제품 환경에는 바람직하지만 앱, 펌웨어와 연결 세션이 동시에 바뀐다. 이번
A/B 실험에서는 원인 변수가 너무 많아지므로 결과 확인 뒤 별도 단계로 둔다.

## 데이터 흐름

1. `/diagnostic-v10`이 기존 세 컨테이너 페이지를 생성 또는 재구성한다.
2. 안경에 `TEXT READY - CLICK TO SEND`를 표시한다.
3. 사용자가 한 번 클릭한다.
4. 기존 `200×100` 1-bit BMP를 `ImageRawDataUpdate`에 넣는다.
5. SDK `0.0.10`은 `compressMode: 2` 없이 이미지 요청을 직렬화한다.
6. WebView에 정규화된 이미지 전송 결과를 표시한다.

## 결과 해석

| 결과 | 해석 | 다음 단계 |
|---|---|---|
| `success` | `0.0.12` 압축 전송 모드와 현재 호스트 환경의 호환성 문제 | 앱·펌웨어 업데이트 후 `0.0.12` 재검증 |
| `SENDFAILED` | SDK 압축 모드가 주원인이 아님 | `0.0.12`로 복원하고 앱/펌웨어·BLE 연결 상태 진단 |
| 다른 이미지 오류 | SDK 버전별 이미지 변환 동작 차이 | 공식 `sample.png`로 동일 버전 재검증 |

한 번의 결과만 기록하며 자동 재시도는 추가하지 않는다. 재시도는 간헐적 BLE
실패를 가려 A/B 해석을 흐릴 수 있다.

## 테스트

- 버전 계약 테스트가 `package.json`과 `app.json`의 SDK `0.0.10` 일치를
  확인한다.
- 기존 클릭 트리거와 BMP 전송 순서 테스트를 그대로 통과시킨다.
- 전체 Vitest, TypeScript 검사, production build와 Sites 패키징 검사를
  실행한다.
- Tailscale 진단 URL이 HTTP `200`을 반환하고 `4173` 리스너가 하나인지
  확인한다.

## 성공 기준

- SDK 버전 외 이미지 전송 동작은 변경되지 않는다.
- 자동 검증이 모두 통과한다.
- 새 QR에서 클릭 한 번 뒤 `success` 또는 `SENDFAILED` 중 하나를 재현하고
  결과를 기록한다.
- 결과에 따라 SDK `0.0.12` 복원 또는 호스트 업데이트라는 다음 단계가
  하나로 결정된다.

## Hardware result

- SDK: `0.0.10`
- Build: `sdk-0010-ab`
- Trigger: one manual G2 or R1 click
- Result: `success`
- Optical observation: a very small dot/checker pattern was visible on the G2.
- Interpretation: the SDK `0.0.12` image transport change is incompatible with
  the current Even app or G2 firmware environment.
- Next: update the Even app and G2 firmware, then retest SDK `0.0.12`.

## Full HUD follow-up result

- SDK: `0.0.10`
- Build: `hud-4tile-sdk0010`
- Layout: four `288×144` image containers covering the `576×288` display
- Result: all four tiles rendered successfully on the physical G2
- Optical observation: the full HUD was very clear and felt larger than the
  centered `200×100` diagnostic pattern
- Size conclusion: this layout already fills the maximum SDK raster area;
  future size changes must scale content within the same frame
