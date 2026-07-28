# SDK 0.0.12 G2 LZ4 이미지 전송 실험

날짜: 2026-07-28

SDK: `0.0.12`

Build: `sdk-0012-repro-033`

Result: `FAIL`

브랜치: `0.0.12-reproduce`

원격 기준선 커밋: `90a9421`

SDK 교체 커밋: `588c9fc`

로컬 URL:
`http://localhost:4177/hud-canvas-fast?sdk=0.0.12&build=sdk-0012-repro-033`

## 목적

물리 G2에서 승인된 SDK `0.0.11` 빌드를 원격에 보존하고, SDK만
`0.0.12`로 변경해 LZ4 이미지 전송의 속도와 안정성을 비교한다.

## 유지한 전송 조건

- 576×288 Canvas를 288×144 PNG 네 장으로 인코딩
- 전체 전송 순서 `3 → 5 → 2 → 4`
- 오른쪽 페이지 전환 순서 `3 → 5`
- 한 refresh 내부의 타일만 직렬 전송
- 동시 이미지 호출 금지
- busy 갱신 요청 즉시 폐기
- 실패한 갱신 재시도와 밀린 이벤트 처리 금지
- 타일당 제한 시간 12초 유지

## 확인된 SDK 차이

앱의 `ImageRawDataUpdate` 호출 인자는 바꾸지 않았다. SDK `0.0.12`의
`toJson()` 결과에는 `compressMode: 2`가 자동 추가되며, 단위 테스트로 이
계약을 고정했다. Canvas 렌더러와 전송 스케줄러 소스는 변경하지 않았다.

## 자동 검증

- SDK 버전·앱 최소 버전·QR 표식 테스트: 2/2 통과
- `npm test`: 37개 파일, 371개 테스트 통과
- `npm run test:sites`: 4개 테스트 통과
- `npm run typecheck`: 통과
- `npm run build`: 67개 모듈 변환, 프로덕션 빌드 통과
- 설치 확인: `@evenrealities/even_hub_sdk@0.0.12`
- payload 확인: `compressMode: 2`
- Tailscale 실험 URL: HTTP 200

위 명령은 동시에 실행하지 않고 한 프로세스에서 순서대로 실행했다.

## 실제 G2 결과

최초 실행에서 Canvas 네 타일 인코딩은 55ms에 정상 완료됐지만 첫 번째
`relicTR` 전송이 7ms 만에 `sendFailed`를 반환했다. 나머지 세 타일은
전송하지 않았고 양안 모두 아무 화면도 표시되지 않았다.

```text
[15:35:46.275] [ENCODE] start · 4 tiles
[15:35:46.330] [ENCODE] complete · 4 tiles · 55ms
[15:35:46.330] [TILE] relicTR start · 1/4
[15:35:46.337] [ERROR] relicTR failed · sendFailed · 7ms
[15:35:46.338] [ERROR] app startup failed · Error
```

전송 스케줄러와 Canvas 소스는 SDK 0.0.11 기준선에서 바뀌지 않았다.
호출자가 만드는 `ImageRawDataUpdate` 필드도 같다. 직렬화된 payload에서
확인한 차이는 SDK 0.0.12가 자동 추가한 `compressMode: 2`다. 이는 조사
단서이며 압축이 확정 원인이라는 결론은 내리지 않는다.

## 실제 G2 직렬 확인 순서

- [x] 최초 실행의 첫 타일 실패 시간이 진단 로그에 남는다.
- [ ] 최초 실행에서 네 타일과 양안 표시가 완료된다. (`sendFailed`)
- [ ] 일반 페이지 다음·이전 이동이 한 번에 한 페이지만 이동한다.
- [ ] 오른쪽 두 타일 갱신 시간이 진단 로그에 남는다.
- [ ] Overview, News, TODO, Weather 상세 진입과 복귀가 동작한다.
- [ ] 지도 줌, 뉴스 본문 페이지, TODO 체크·해제가 동작한다.
- [ ] HUD 숨김과 복원이 동작한다.
- [ ] 전송 중 추가 입력은 `dropped · busy`로 끝나며 나중에 재실행되지 않는다.
- [ ] `SENDFAILED`가 발생하지 않는다.
- [ ] 가만히 둔 상태에서 WebView가 정지하지 않는다.

## 판정과 대조군

최초 표시 게이트에서 실패했으므로 후속 동작 시험을 중단했다. 같은 물리
G2에서 SDK 0.0.11로 고정한 동일 페이지, PNG 인코더, 컨테이너 구조,
호출 형태와 직렬 스케줄러는 정상 표시된다.

공식팀 재현 절차와 영문 설명은 저장소 루트의
`SDK-0.0.12-REPRO.md`에 보존한다. Even Hub가 다른 기기에서 실행되면
로컬 URL의 `localhost`를 개발 PC의 접근 가능한 LAN 주소로 바꾼다.
