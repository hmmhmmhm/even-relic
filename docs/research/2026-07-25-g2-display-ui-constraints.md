# G2 화면 자유도와 기본 컴포넌트

조사 기준일은 2026-07-25이며 공개 SDK 최신 버전은 `@evenrealities/even_hub_sdk` 0.0.12다.

## 결론

휴대폰의 Even Hub WebView와 안경 화면은 별도다. 휴대폰 화면은 일반 HTML, CSS와 TypeScript로 만들 수 있지만 그 DOM이 안경에 미러링되지는 않는다. G2에는 SDK 브리지를 통해 Text, List, Image 컨테이너를 전송한다.

## 표시 제약

| 항목 | 제약 |
| --- | --- |
| 캔버스 | 576 x 288, 좌측 상단 원점 |
| 색상 | 4-bit, 16단계 녹색 |
| 배경 | 검은 픽셀은 꺼진 상태로 현실이 비침 |
| 배치 | 절대 좌표, CSS와 DOM 사용 불가 |
| 전체 컨테이너 | 페이지당 최대 12개 |
| Text/List | 합계 최대 8개 |
| Image | 최대 4개 |
| 입력 | Text 또는 List 하나가 `isEventCapture: 1`이어야 함 |
| 레이어 | SDK 0.0.12부터 고유한 `zOrderIndex` 지원 |

## 기본 요소

### Text

- 자동 줄바꿈과 명시적 줄바꿈을 지원한다.
- 앱이 선택할 수 있는 폰트, 크기, 굵기, 기울임과 정렬 속성은 없다.
- `textContainerUpgrade`는 페이지 재구성 없이 갱신되어 시간, STT와 센서 숫자에 적합하다.
- 시작과 페이지 재구성은 컨테이너당 최대 1,000자, 인플레이스 갱신은 최대 2,000자다.

### List

- 펌웨어가 스크롤과 선택 표시를 처리한다.
- 항목은 1개에서 20개이며 항목 문자열은 최대 64자다.
- 항목별 스타일, 높이와 구분선을 설정할 수 없다.
- 내용 변경은 페이지 재구성이 필요해 잠깐 깜빡일 수 있다.

### Image

- 4-bit 그레이스케일 비트맵을 표시한다.
- 한 이미지 컨테이너는 너비 20~288, 높이 20~144다.
- 생성 후 `updateImageRawData`를 별도로 호출해야 한다.
- BLE 전송은 대략 0.5~2초가 걸릴 수 있어 다중 FPS 애니메이션에 적합하지 않다.
- 미니맵은 이동 거리나 방향 임계치를 넘었을 때만 갱신하는 방식이 적합하다.

## 제공되지 않는 네이티브 위젯

지도, 차트, 게이지, 나침반, 3D 장면, 카드, 탭, 그리드, 버튼과 뉴스 티커는 제공되지 않는다. 텍스트 기호, 테두리와 비트맵을 조합해 표현해야 한다.

## 한국어 글리프

공식 텍스트 측정 패키지 `@evenrealities/pretext` 0.1.4의 내장 폰트 테이블을 집계하면 완성형 한글 11,172자 중 2,780자의 폭 정보가 있다. 다음 HUD 용어는 모두 포함된다.

`시간`, `미니맵`, `지도`, `장소명`, `볼륨`, `음성 인식`, `방향 각도`, `가속도`, `퀘스트`, `뉴스`, `현재 위치`, `서울특별시`, `대한민국`

전체 한글을 지원하지 않으므로 실제 뉴스와 고유명사는 안경에서 검증해야 한다. 누락 글리프는 해당 문자열만 비트맵으로 만드는 대체 경로를 고려한다.

## RELIC에 적용

| 정보 | 권장 요소 |
| --- | --- |
| 시간, 장소명 | Text |
| 미니맵 | Image |
| dB와 레벨 바 | Text와 지원되는 블록 문자 |
| STT | Text |
| 방향과 가속도 | Text 숫자 |
| 현재 퀘스트 | Text |
| 전체 TODO와 뉴스 | 별도 페이지의 List |

최종 동적 HUD는 위 하이브리드 구성이 유력하다. 다만 첫 실기기 정보 밀도
검증에서는 네이티브 Text를 사용하지 않고 화면 전체를 래스터로 보낸다.

### 첫 실기기 래스터 테스트

```text
선택한 1792 x 896 시안
  → WebView Canvas에서 576 x 288로 축소
  → 288 x 144 PNG 네 장으로 분할
  → 네 Image 컨테이너에 순차 전송
```

- 보이는 정보는 모두 이미지 안에 있다.
- 공백 Text 컨테이너 하나는 `isEventCapture: 1`을 만족하기 위한 입력
  레이어일 뿐 화면에는 표시되지 않는다.
- 네 Image 컨테이너가 SDK 이미지 예산을 모두 사용한다.
- 이미지 전송은 반드시 직렬화하며 전체 화면 완성에 수 초가 걸릴 수 있다.
- 목적은 애니메이션 성능이 아니라 실제 광학계에서 글자 크기, 대비,
  주변부 배치와 중앙 시야 여백을 확인하는 것이다.
- 실기기 결과를 본 뒤 자주 변하는 시간, STT와 센서 숫자만 네이티브
  Text로 되돌릴지 결정한다.

## 출처

- [Even Hub G2 Glasses UI](https://github.com/even-realities/everything-evenhub/blob/main/plugins/everything-evenhub/skills/glasses-ui/SKILL.md)
- [Even Hub G2 Design Guidelines](https://github.com/even-realities/everything-evenhub/blob/main/plugins/everything-evenhub/skills/design-guidelines/SKILL.md)
- [Even Hub official templates](https://github.com/even-realities/evenhub-templates)
- [Official image template](https://github.com/even-realities/evenhub-templates/tree/main/image)
- [Even Hub SDK on npm](https://www.npmjs.com/package/@evenrealities/even_hub_sdk)
- [EvenHub Simulator on npm](https://www.npmjs.com/package/@evenrealities/evenhub-simulator)
- [Pretext on npm](https://www.npmjs.com/package/@evenrealities/pretext)
