# Even Hub SDK 0.0.12 재현 브랜치 설계

## 목적

Even Realities 팀이 G2 이미지 전송 실패를 같은 조건에서 검토할 수 있도록,
물리 G2에서 실제로 `sendFailed`가 발생했던 SDK 0.0.12 애플리케이션
상태를 독립 브랜치와 실행 URL로 보존한다.

## 기준 상태

- 브랜치: `0.0.12-reproduce`
- 기준 커밋: `7c1053a`
- SDK: `@evenrealities/even_hub_sdk` 정확히 `0.0.12`
- 앱 최소 SDK: `0.0.12`
- 재현 경로: `/hud-canvas-fast`
- 재현 서버: Tailscale `100.96.68.73:4177`
- Build 표식: `sdk-0012-repro-033`

기준 커밋은 물리 실패 직전 자동 검증까지 끝낸 정확한 0.0.12 상태다.
재현 브랜치에서는 Canvas 렌더러, 페이지 컨테이너, PNG 인코더와 이미지
전송 스케줄러를 수정하지 않는다.

## 재현 전송 계약

1. `createStartUpPageContainer()`로 이벤트 레이어 하나와 이미지 컨테이너
   네 개를 생성한다.
2. 576×288 Canvas를 네 개의 288×144 표준 PNG로 인코딩한다.
3. 타일을 `3 → 5 → 2 → 4` 순서로 하나씩 직렬 전송한다.
4. 각 타일은 다음 형태로 전송한다.

```ts
await bridge.updateImageRawData(new ImageRawDataUpdate({
  containerID: tile.id,
  containerName: tile.name,
  imageData: bytes,
}));
```

동시 전송, 전송 큐, 자동 재시도와 실패 후 다음 타일 전송은 사용하지 않는다.
첫 타일이 실패하면 해당 실행은 즉시 실패로 끝난다.

## 확인된 비교 결과

- SDK 0.0.11: 같은 앱 구조와 PNG 타일이 물리 G2에 정상 표시된다.
- SDK 0.0.12: 최초 `relicTR` 호출이 약 7ms 만에 `sendFailed`를 반환하고
  안경에는 아무 화면도 표시되지 않는다.
- 호출자가 만드는 `ImageRawDataUpdate` 필드는 동일하다.
- 직렬화 결과에서 확인된 SDK 차이는 0.0.12가 자동으로 추가하는
  `compressMode: 2`다.

이 관찰은 원인 확정이 아니라 비교 증거로만 전달한다. 압축 모드와 현재
Even 앱 또는 펌웨어의 호환 여부는 Even Realities 팀이 판단한다.

## 브랜치 변경 범위

재현성을 유지하기 위해 다음 변경만 허용한다.

- QR 스크립트의 포트를 4177로 분리하고 Build 표식을
  `sdk-0012-repro-033`으로 변경
- QR·SDK·직렬화 계약 테스트 갱신
- 공식팀용 영문 `SDK-0.0.12-REPRO.md` 추가
- 실제 물리 로그와 재현 절차 문서 보강

`src/fast-canvas-transport.ts`, `src/g2-canvas.ts`, HUD 렌더러와 전송 순서는
기준 커밋에서 변경하지 않는다.

## 검증과 운영

- 모든 테스트는 파일 병렬화 없이 직렬 실행한다.
- `npm test`, `npm run typecheck`, `npm run build`, 빌드 후
  `npm run test:sites`를 실행한다.
- SDK 0.0.12 설치와 `compressMode: 2` 직렬화를 단위 테스트로 확인한다.
- 4176의 SDK 0.0.11 서버는 계속 유지한다.
- 재현 브랜치는 4177에서 별도 Vite 서버로 실행한다.
- Tailscale URL은 사용자 물리 확인용이며 외부 공식팀은 저장소를
  복제해 같은 경로를 실행한다.

## 완료 기준

- `0.0.12-reproduce` 브랜치가 GitHub에 푸시되어 있다.
- 영문 문서만 읽고 설치, 실행, QR 스캔과 예상 실패 로그를 재현할 수 있다.
- 4177 테스트 URL이 HTTP 200을 반환한다.
- 4176 SDK 0.0.11 테스트 서버가 중단되지 않는다.
- 사용자에게 GitHub 브랜치 링크, 테스트 URL과 공식 전달용 영문 메시지를
  함께 제공한다.
