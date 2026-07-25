# G2 이미지 전송 호환성 진단

조사 및 실기기 검증일: 2026-07-26

## 결론

현재 테스트한 iPhone Even 앱과 G2 조합에서는
`@evenrealities/even_hub_sdk` 0.0.12의 이미지 전송이 `SENDFAILED`로
실패하지만, 동일한 페이지와 동일한 8-bit RGB PNG를 SDK 0.0.11로
전송하면 정상 렌더링된다.

RELIC의 G2 이미지 전송 경로는 당분간 SDK 0.0.11에 고정한다. SDK 또는
Even 앱·G2 펌웨어가 갱신되면 0.0.12 이상을 별도 비교 빌드로 다시
검증한다.

## 확인된 차이

`ImageRawDataUpdate.toJson()` 직렬화 결과는 다음과 같이 달랐다.

```jsonc
// SDK 0.0.12
{
  "containerID": 3,
  "containerName": "frame",
  "imageData": [1, 2, 3],
  "compressMode": 2
}
```

```jsonc
// SDK 0.0.11
{
  "containerID": 3,
  "containerName": "frame",
  "imageData": [1, 2, 3]
}
```

SDK 0.0.12의 변경 기록에는 이미지 원시 데이터 전송에 내부 LZ4 압축이
추가됐다고 적혀 있다. 공개 생성자 입력에서 `compressMode`를 0 또는
1로 지정해도 0.0.12의 `toJson()`은 2를 강제로 출력했다.

따라서 이번 실험이 직접 입증한 범위는 다음과 같다.

- `compressMode: 2`가 포함된 0.0.12 전송: `SENDFAILED`
- `compressMode`가 없는 0.0.11 전송: 정상 렌더링
- 같은 200×100 PNG, 같은 페이지 구성, 같은 3초 대기 사용

LZ4 자체와 호스트 앱 또는 펌웨어 중 어느 구현이 맞지 않는지는 공개
오류 정보만으로 더 구체화할 수 없다. 따라서 일반적인 G2 전체의 결함으로
단정하지 않고, 현재 테스트 환경의 호환성 문제로 기록한다.

## 실기기 결과

성공 빌드: `v0.1.0 · sdk011-1`

1. 200×100 이미지 컨테이너 페이지 생성
2. 페이지 생성 후 3초 대기
3. 공식 8-bit RGB PNG 469바이트 전송
4. 안경에 작은 녹색 이미지가 표시됨
5. 이미지 아래에 `OFFICIAL SAMPLE RENDERED`가 표시됨

이 결과는 페이지 생성, 텍스트 갱신, PNG 로드, 이미지 바이트 전송,
G2 렌더링의 전체 경로가 SDK 0.0.11에서 동작함을 확인한다.

## 회귀 방지

`src/sdk-version.test.ts`에서 다음을 검사한다.

- 패키지와 앱 매니페스트가 SDK 0.0.11로 일치하는지
- 테스트 주소가 `sdk011-1` 비교 빌드를 가리키는지
- `ImageRawDataUpdate` 직렬화 결과에 `compressMode`가 없는지

이미지 형식 테스트에서는 전송 PNG가 200×100, 8-bit RGB인지 별도로
검사한다.
