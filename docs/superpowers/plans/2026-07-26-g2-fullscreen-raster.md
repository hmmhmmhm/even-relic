# G2 Fullscreen Raster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan.

**Goal:** 검증된 8-bit RGB PNG 전송 경로를 이용해 RELIC HUD를 G2의 576×288 표시 영역 전체에 2×2 정적 타일로 표시한다.

**Architecture:** 기존 공식 이미지 예제의 진단용 복제본을 하드웨어 검증 전용 앱으로 유지한다. 576×288 HUD 원본을 빌드 전에 288×144 PNG 네 장으로 만들고, 앱은 빈 이벤트 캡처 레이어 하나와 이미지 컨테이너 네 개를 생성한다. 사용자가 한 번 탭하면 타일을 TL→TR→BL→BR 순서로 직렬 전송하며, 진행 상황과 오류는 iPhone WebView에만 표시한다.

**Tech Stack:** TypeScript, Vite 5, Vitest, `@evenrealities/even_hub_sdk` 0.0.10, EvenHub CLI, ffmpeg

---

## 작업 범위와 경로

구현 작업 디렉터리:

`C:\Users\haminlee\Documents\personal-agent\evenhub-templates-diagnostic\image`

HUD 원본:

`C:\Users\haminlee\Documents\personal-agent\even-relic\docs\design\selected-peripheral-focus.png`

설계 문서:

`C:\Users\haminlee\Documents\personal-agent\even-relic\docs\superpowers\specs\2026-07-26-g2-fullscreen-raster-design.md`

RELIC 폴더에는 Git 저장소가 없고 진단 프로젝트는 공식 저장소의 실험용 복제본이다. 이번 하드웨어 검증 단계에서는 커밋이나 푸시를 하지 않아 공식 원격 저장소에 영향을 주지 않는다.

### Task 1: 정적 8-bit RGB 타일 네 장 생성

**Files:**

- Create: `public/relic-tiles/relic-tl.png`
- Create: `public/relic-tiles/relic-tr.png`
- Create: `public/relic-tiles/relic-bl.png`
- Create: `public/relic-tiles/relic-br.png`
- Create: `scripts/verify-fullscreen-tiles.mjs`
- Modify: `package.json`

**Step 1: 타일 검사 스크립트를 먼저 작성한다**

`scripts/verify-fullscreen-tiles.mjs`:

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const files = [
  'public/relic-tiles/relic-tl.png',
  'public/relic-tiles/relic-tr.png',
  'public/relic-tiles/relic-bl.png',
  'public/relic-tiles/relic-br.png',
]

for (const file of files) {
  const png = readFileSync(file)
  assert.deepEqual(
    [...png.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    `${file}: PNG signature`,
  )
  assert.equal(png.readUInt32BE(16), 288, `${file}: width`)
  assert.equal(png.readUInt32BE(20), 144, `${file}: height`)
  assert.equal(png[24], 8, `${file}: bit depth`)
  assert.equal(png[25], 2, `${file}: RGB color type`)
}

console.log('Verified 4 fullscreen tiles: 288x144, 8-bit RGB')
```

`package.json`의 `scripts`에 다음 항목을 추가한다.

```json
"verify:tiles": "node scripts/verify-fullscreen-tiles.mjs"
```

**Step 2: 검사 실패를 확인한다**

Run:

```powershell
npm run verify:tiles
```

Expected: 아직 타일 파일이 없으므로 `ENOENT`로 실패한다.

**Step 3: HUD 원본을 네 타일로 생성한다**

Run:

```powershell
New-Item -ItemType Directory -Force public\relic-tiles
ffmpeg -y -i ..\..\even-relic\docs\design\selected-peripheral-focus.png -vf "scale=576:288,crop=288:144:0:0,format=rgb24" -frames:v 1 public\relic-tiles\relic-tl.png
ffmpeg -y -i ..\..\even-relic\docs\design\selected-peripheral-focus.png -vf "scale=576:288,crop=288:144:288:0,format=rgb24" -frames:v 1 public\relic-tiles\relic-tr.png
ffmpeg -y -i ..\..\even-relic\docs\design\selected-peripheral-focus.png -vf "scale=576:288,crop=288:144:0:144,format=rgb24" -frames:v 1 public\relic-tiles\relic-bl.png
ffmpeg -y -i ..\..\even-relic\docs\design\selected-peripheral-focus.png -vf "scale=576:288,crop=288:144:288:144,format=rgb24" -frames:v 1 public\relic-tiles\relic-br.png
```

Expected: `public/relic-tiles`에 PNG 네 장이 생성된다.

**Step 4: 타일 메타데이터 검사를 통과시킨다**

Run:

```powershell
npm run verify:tiles
```

Expected:

```text
Verified 4 fullscreen tiles: 288x144, 8-bit RGB
```

### Task 2: 레이아웃과 직렬 전송 로직을 테스트 주도로 작성

**Files:**

- Create: `src/fullscreen.test.ts`
- Create: `src/fullscreen.ts`

**Step 1: 실패하는 단위 테스트를 작성한다**

`src/fullscreen.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  FULLSCREEN_TILES,
  createFullscreenPage,
  sendFullscreenTiles,
  type LoadedFullscreenTile,
} from './fullscreen'

function loadedTiles(): LoadedFullscreenTile[] {
  return FULLSCREEN_TILES.map(tile => ({
    ...tile,
    bytes: new Uint8Array([tile.containerID]),
  }))
}

describe('G2 fullscreen raster', () => {
  it('covers 576x288 with exactly four 288x144 images', () => {
    expect(FULLSCREEN_TILES).toEqual([
      {
        containerID: 2,
        containerName: 'relicTL',
        xPosition: 0,
        yPosition: 0,
        width: 288,
        height: 144,
        file: 'relic-tiles/relic-tl.png',
      },
      {
        containerID: 3,
        containerName: 'relicTR',
        xPosition: 288,
        yPosition: 0,
        width: 288,
        height: 144,
        file: 'relic-tiles/relic-tr.png',
      },
      {
        containerID: 4,
        containerName: 'relicBL',
        xPosition: 0,
        yPosition: 144,
        width: 288,
        height: 144,
        file: 'relic-tiles/relic-bl.png',
      },
      {
        containerID: 5,
        containerName: 'relicBR',
        xPosition: 288,
        yPosition: 144,
        width: 288,
        height: 144,
        file: 'relic-tiles/relic-br.png',
      },
    ])

    const page = createFullscreenPage()
    expect(page.containerTotalNum).toBe(5)
    expect(page.textObject).toHaveLength(1)
    expect(page.imageObject).toHaveLength(4)
  })

  it('sends TL, TR, BL, BR sequentially', async () => {
    const calls: string[] = []
    await sendFullscreenTiles(
      {
        updateImageRawData: async update => {
          calls.push(`SEND:${update.containerName}`)
          return 0
        },
      },
      loadedTiles(),
      status => calls.push(status),
    )

    expect(calls).toEqual([
      'relicTL SEND (1/4)',
      'SEND:relicTL',
      'relicTL RESULT: success (1/4)',
      'relicTR SEND (2/4)',
      'SEND:relicTR',
      'relicTR RESULT: success (2/4)',
      'relicBL SEND (3/4)',
      'SEND:relicBL',
      'relicBL RESULT: success (3/4)',
      'relicBR SEND (4/4)',
      'SEND:relicBR',
      'relicBR RESULT: success (4/4)',
    ])
  })

  it('stops immediately after the first failed tile', async () => {
    const sent: string[] = []
    await expect(sendFullscreenTiles(
      {
        updateImageRawData: async update => {
          sent.push(update.containerName ?? '')
          return sent.length === 2 ? 3 : 0
        },
      },
      loadedTiles(),
      () => undefined,
    )).rejects.toThrow('relicTR failed: sendFailed')

    expect(sent).toEqual(['relicTL', 'relicTR'])
  })
})
```

**Step 2: 새 테스트가 실패하는지 확인한다**

Run:

```powershell
npm test -- src/fullscreen.test.ts
```

Expected: `./fullscreen` 모듈을 찾을 수 없어 실패한다.

**Step 3: 최소 구현을 작성한다**

`src/fullscreen.ts`:

```ts
import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  TextContainerProperty,
} from '@evenrealities/even_hub_sdk'

export const FULLSCREEN_TILES = [
  {
    containerID: 2,
    containerName: 'relicTL',
    xPosition: 0,
    yPosition: 0,
    width: 288,
    height: 144,
    file: 'relic-tiles/relic-tl.png',
  },
  {
    containerID: 3,
    containerName: 'relicTR',
    xPosition: 288,
    yPosition: 0,
    width: 288,
    height: 144,
    file: 'relic-tiles/relic-tr.png',
  },
  {
    containerID: 4,
    containerName: 'relicBL',
    xPosition: 0,
    yPosition: 144,
    width: 288,
    height: 144,
    file: 'relic-tiles/relic-bl.png',
  },
  {
    containerID: 5,
    containerName: 'relicBR',
    xPosition: 288,
    yPosition: 144,
    width: 288,
    height: 144,
    file: 'relic-tiles/relic-br.png',
  },
] as const

export type LoadedFullscreenTile = typeof FULLSCREEN_TILES[number] & {
  bytes: Uint8Array
}

type ImageBridge = {
  updateImageRawData: (update: ImageRawDataUpdate) => Promise<unknown>
}

export function createFullscreenPage() {
  const eventLayer = new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: 576,
    height: 288,
    borderWidth: 0,
    borderColor: 0,
    paddingLength: 0,
    containerID: 1,
    containerName: 'eventLayer',
    content: ' ',
    isEventCapture: 1,
  })
  const images = FULLSCREEN_TILES.map(tile => (
    new ImageContainerProperty(tile)
  ))
  return new CreateStartUpPageContainer({
    containerTotalNum: 5,
    textObject: [eventLayer],
    imageObject: images,
  })
}

export async function loadFullscreenTiles(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<LoadedFullscreenTile[]> {
  return Promise.all(FULLSCREEN_TILES.map(async tile => {
    const response = await fetcher(`${baseUrl}${tile.file}`)
    if (!response.ok) {
      throw new Error(`${tile.containerName} HTTP ${response.status}`)
    }
    return {
      ...tile,
      bytes: new Uint8Array(await response.arrayBuffer()),
    }
  }))
}

export async function sendFullscreenTiles(
  bridge: ImageBridge,
  tiles: LoadedFullscreenTile[],
  report: (status: string) => void,
) {
  for (const [index, tile] of tiles.entries()) {
    const progress = `(${index + 1}/${tiles.length})`
    report(`${tile.containerName} SEND ${progress}`)
    const rawResult = await bridge.updateImageRawData(
      new ImageRawDataUpdate({
        containerID: tile.containerID,
        containerName: tile.containerName,
        imageData: tile.bytes,
      }),
    )
    const result = ImageRawDataUpdateResult.normalize(rawResult)
    report(`${tile.containerName} RESULT: ${result} ${progress}`)
    if (!ImageRawDataUpdateResult.isSuccess(result)) {
      throw new Error(`${tile.containerName} failed: ${result}`)
    }
  }
}
```

**Step 4: 새 단위 테스트를 통과시킨다**

Run:

```powershell
npm test -- src/fullscreen.test.ts
```

Expected: 3 tests passed.

### Task 3: 한 번 탭하면 네 타일을 전송하는 실제 페이지 연결

**Files:**

- Modify: `src/main.ts`

**Step 1: 기존 진단 페이지를 풀스크린 전송 페이지로 교체한다**

`src/main.ts`:

```ts
import {
  OsEventTypeList,
  RebuildPageContainer,
  StartUpPageCreateResult,
  waitForEvenAppBridge,
} from '@evenrealities/even_hub_sdk'
import { getEventKind } from './diagnostic'
import {
  createFullscreenPage,
  loadFullscreenTiles,
  sendFullscreenTiles,
} from './fullscreen'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <main style="margin:auto;padding:24px;max-width:640px;text-align:center;">
    <h1 style="font-size:18px;font-weight:600;margin:0 0 8px;">
      RELIC G2 FULLSCREEN
    </h1>
    <output id="status" style="display:block;color:#7cffb2;font:14px monospace;">
      CONNECTING
    </output>
    <p style="color:#919191;font-size:13px;margin:12px 0 0;">
      READY가 보이면 안경 또는 R1을 한 번 탭하세요. 두 번 탭하면 종료합니다.
    </p>
  </main>
`

const output = document.querySelector<HTMLOutputElement>('#status')!
function report(status: string) {
  output.textContent = status
  console.log(status)
}

const bridge = await waitForEvenAppBridge()
const page = createFullscreenPage()
const created = StartUpPageCreateResult.normalize(
  await bridge.createStartUpPageContainer(page),
)

if (created === StartUpPageCreateResult.invalid) {
  const rebuilt = await bridge.rebuildPageContainer(new RebuildPageContainer({
    containerTotalNum: page.containerTotalNum,
    textObject: page.textObject,
    imageObject: page.imageObject,
  }))
  if (!rebuilt) throw new Error('PAGE REBUILD FAILED')
} else if (created !== StartUpPageCreateResult.success) {
  throw new Error(`PAGE CREATE FAILED: ${created}`)
}

report('READY - TAP TO SEND')

let sending = false
let sent = false
let cleanedUp = false

async function sendOnce() {
  if (sending || sent) return
  sending = true
  try {
    report('LOADING 4 TILES')
    const tiles = await loadFullscreenTiles(import.meta.env.BASE_URL)
    await sendFullscreenTiles(bridge, tiles, report)
    sent = true
    report('FULLSCREEN RESULT: success')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    report(`FULLSCREEN RESULT: ${message}`)
    console.error(error)
  } finally {
    sending = false
  }
}

function cleanup() {
  if (cleanedUp) return
  cleanedUp = true
  unsubscribe()
}

const unsubscribe = bridge.onEvenHubEvent(event => {
  const kind = getEventKind(event)
  if (kind === 'double') {
    void bridge.shutDownPageContainer(1)
    return
  }
  if (kind === 'click') {
    void sendOnce()
    return
  }

  const sysType = event.sysEvent?.eventType ?? null
  if (
    sysType === OsEventTypeList.SYSTEM_EXIT_EVENT
    || sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT
  ) {
    cleanup()
  }
})

window.addEventListener('beforeunload', cleanup)
```

**Step 2: 전체 테스트와 빌드를 실행한다**

Run:

```powershell
npm test
npm run verify:tiles
npm run build
```

Expected:

- 기존 진단 테스트 3개와 풀스크린 테스트 3개가 모두 통과한다.
- PNG 네 장의 형식 검사가 통과한다.
- TypeScript 검사와 Vite production build가 성공한다.

### Task 4: 새 포트와 새 QR로 실제 G2 검증

**Files:**

- Modify: `package.json`

**Step 1: 캐시를 분리할 전용 명령을 추가한다**

`package.json`의 `scripts`에 다음 항목을 추가한다.

```json
"dev:fullscreen": "vite --host 0.0.0.0 --port 5178 --strictPort",
"qr:fullscreen": "evenhub qr --url http://100.84.176.81:5178 --external"
```

Tailscale 주소가 바뀌었으면 `100.84.176.81`을 `tailscale ip -4` 결과로 교체한다.

**Step 2: 기존 5177 개발 서버만 종료한다**

Run:

```powershell
$listener = Get-NetTCPConnection -LocalPort 5177 -State Listen -ErrorAction SilentlyContinue
if ($listener) { Stop-Process -Id $listener.OwningProcess }
```

Expected: 5177의 진단 서버만 종료되고 4173 RELIC 서버와 5174 공식 원본 서버는 그대로 유지된다.

**Step 3: 5178 서버를 실행한다**

Run:

```powershell
npm run dev:fullscreen
```

Expected: Vite가 `http://localhost:5178`과 Tailscale 접근 주소를 표시하며 계속 실행된다.

**Step 4: 별도 터미널에서 QR을 생성한다**

Run:

```powershell
npm run qr:fullscreen
```

Expected: iPhone Even 앱에서 스캔할 QR이 표시된다.

**Step 5: 실제 안경에서 검증한다**

1. 기존 RELIC/진단 EvenHub 앱을 안경에서 종료한다.
2. iPhone Even 앱으로 새 QR을 스캔한다.
3. iPhone 화면에 `READY - TAP TO SEND`가 나타날 때까지 기다린다.
4. 안경 또는 R1을 한 번 탭한다.
5. iPhone에서 `relicTL`, `relicTR`, `relicBL`, `relicBR` 결과가 모두 `success`인지 확인한다.
6. 안경의 576×288 영역 전체에 HUD가 이어져 보이는지 확인한다.
7. 이음선, 잘림, 밝기, 글자 판독성, 주변 시야 방해 정도를 기록한다.

Expected final phone status:

```text
FULLSCREEN RESULT: success
```

실패하면 iPhone에 표시된 최초 실패 타일과 결과(`imageException`, `imageSizeInvalid`, `sendFailed`)를 그대로 기록한다. 후속 타일은 전송되지 않아야 한다.

## 최종 검증 체크리스트

- [ ] 네 PNG가 각각 288×144, 8-bit RGB다.
- [ ] 이미지 컨테이너가 SDK 상한인 정확히 네 개다.
- [ ] 빈 이벤트 캡처 텍스트 레이어를 포함해 총 컨테이너 수가 다섯 개다.
- [ ] 한 번 탭해야만 전송이 시작된다.
- [ ] 두 번째 단일 탭은 다시 전송하지 않는다.
- [ ] TL→TR→BL→BR 순서가 직렬로 유지된다.
- [ ] 최초 실패 후 전송이 멈춘다.
- [ ] 두 번 탭하면 종료된다.
- [ ] 테스트, 타일 검사, production build가 모두 통과한다.
- [ ] 5178 서버가 하나만 리슨한다.
- [ ] 실제 G2에서 화면 전체를 채운 HUD가 보인다.
