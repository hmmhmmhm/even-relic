# Even Hub G2 및 R1 앱 개발 조사

- 확인일: 2026-07-25
- 대상 환경: Windows PC, iPhone, Even G2, Even R1, G2 충전 독
- 조사 범위: 앱 구조, 로컬 및 실기기 테스트, SDK 권한, 기기 데이터, AI 및 STT, R1 센서, 오디오 채널, WebView, 배포 방식, 유료 판매, 심사, IMU, 한국 커뮤니티
- 기준 자료: Even Realities 개발자 포털과 약관, 지원 문서, 공식 GitHub 저장소, 공개 npm 패키지, 공개 앱 소스와 커뮤니티 글

## 결론

현재 보유한 장비만으로 Even Hub 앱을 개발하고 실기기에서 테스트할 수 있다. 충전 독이나 USB 케이블은 앱 설치 또는 디버깅에 사용하지 않는다. Windows에서 웹 앱을 실행한 뒤 iPhone의 Even Realities 앱으로 개발용 QR 코드를 스캔하면 된다. G2와 R1은 iPhone에 연결된 상태에서 화면 출력과 입력 장치로 동작한다.

공식 개발 방식은 TypeScript와 Vite를 사용하는 웹 앱에 가깝다. 다만 웹 페이지 전체가 안경에 표시되는 구조는 아니다. 앱 로직과 휴대폰용 UI는 iPhone의 WebView에서 실행된다. 안경 화면은 Even Hub SDK의 브리지를 통해 텍스트, 목록 또는 이미지 컨테이너로 따로 구성한다.

유료 플러그인과 구독은 약관에 등장하지만 Even Hub가 결제와 정산을 대행하는 공개 체계는 확인되지 않았다. 공개된 앱 심사 처리 기한도 없다. IMU는 `x`, `y`, `z`만 노출되며 공식 좌표계와 단위, 정확도 사양이 없어 실기기 보정이 필요하다. 공식 한국 커뮤니티나 공개적으로 확인되는 한국 Even Hub 앱 개발팀도 아직 찾지 못했다. 지금은 공식 Discord와 GitHub, 커뮤니티 서브레딧 `r/EvenRealities`가 가장 실용적인 소통 창구다.

공개 SDK 0.0.12에는 Even AI, LLM, STT 또는 TTS를 직접 호출하는 API가 없다. G2 마이크의 16 kHz 모노 PCM을 받아 외부 또는 자체 STT와 AI 백엔드로 보내는 방식이 현재의 구현 경로다. R1에는 활동 측정용 IMU가 들어 있지만 플러그인에는 원시 R1 IMU, 반지 각도와 건강 데이터가 공개되지 않는다. G2의 네 마이크도 플러그인에는 채널별 데이터가 아닌 모노 단일 스트림으로 전달되므로 마이크 배열 기반 음원 방향 추정은 현재 공개 API로 구현할 수 없다.

## 전체 구조

```text
Windows PC
TypeScript 및 Vite 개발 서버
        |
        | Wi-Fi 또는 HTTPS
        v
iPhone
WKWebView에서 앱 로직 실행
Even Hub SDK Bridge
        |
        | Bluetooth
        v
G2 및 R1
화면 출력, 제스처 입력, 마이크, IMU
```

각 구성 요소의 역할은 다음과 같다.

| 구성 요소 | 역할 |
| --- | --- |
| Windows PC | TypeScript 코드 작성, Vite 개발 서버 실행, 빌드 및 패키징 |
| iPhone | 앱의 WebView 실행, 네트워크 통신, 권한 처리, G2 및 R1과의 연결 |
| G2 | 576 x 288 안경 화면, 터치 입력, 마이크, IMU |
| R1 | 누르기, 더블 누르기, 위아래 스와이프 입력 |
| 충전 독 | 충전 용도이며 Even Hub 앱 전송이나 디버깅에는 사용하지 않음 |

## 앱의 형태

공식 스타터 템플릿은 다음 요소를 사용한다.

- HTML
- TypeScript
- Vite
- `@evenrealities/even_hub_sdk`
- `@evenrealities/evenhub-cli`
- `@evenrealities/evenhub-simulator`
- 앱 메타데이터를 담는 `app.json`

Vite는 필수 프레임워크라기보다 공식 템플릿의 기본 선택이다. React나 Vue도 최종 결과물을 정적 웹 자산으로 빌드하고 SDK 브리지를 올바르게 호출할 수 있다면 사용할 수 있다. 첫 앱은 공식 `minimal` 템플릿으로 시작하는 편이 단순하다.

안경 화면에는 일반 HTML과 CSS가 그대로 표시되지 않는다. SDK가 제공하는 다음 컨테이너를 만들어 G2로 보낸다.

- 텍스트 컨테이너
- 목록 컨테이너
- 이미지 컨테이너

전화기 화면에는 일반 WebView UI를 구성할 수 있다. 안경 화면은 576 x 288 해상도와 4-bit 그레이스케일 표현을 사용하며, 임의의 CSS 레이아웃이나 폰트를 사용할 수 없다.

## Windows 개발 환경

### 권장 준비물

- Node.js 18 이상
- Git
- 최신 Even Realities iOS 앱
- Even Hub 개발자 계정
- iPhone과 페어링된 G2 및 R1

### 공식 템플릿으로 시작하기

PowerShell에서 다음과 같이 실행한다.

```powershell
git clone https://github.com/even-realities/evenhub-templates.git
Copy-Item -Recurse .\evenhub-templates\minimal .\my-g2-app
Set-Location .\my-g2-app

npm install
npm run dev
```

공식 `minimal` 템플릿의 Vite 설정은 LAN에서 접속할 수 있도록 `host: true`를 사용한다. 기본 포트는 5173이다.

## 실기기 테스트

### 같은 Wi-Fi에서 테스트

1. Windows PC와 iPhone을 같은 Wi-Fi에 연결한다.
2. G2와 R1이 iPhone의 Even Realities 앱에 연결되었는지 확인한다.
3. Windows에서 `npm run dev`를 실행한다.
4. `ipconfig`로 Windows PC의 LAN IPv4 주소를 확인한다.
5. 해당 주소로 개발용 QR 코드를 만든다.
6. iPhone의 Even Realities 앱에서 Developer Center를 열고 QR 코드를 스캔한다.
7. 플러그인을 실행하고 G2와 R1에서 동작을 확인한다.

PC 주소가 `192.168.0.20`인 경우 예시는 다음과 같다.

```powershell
npx evenhub qr --url http://192.168.0.20:5173
```

연결되지 않으면 iPhone Safari에서 같은 URL을 먼저 열어 본다.

```text
http://192.168.0.20:5173
```

Safari에서도 열리지 않는다면 다음 항목을 확인한다.

- Windows 방화벽에서 Node.js의 사설 네트워크 접근이 허용되었는지 확인한다.
- iOS에서 Even Realities 앱의 로컬 네트워크 권한을 허용한다.
- 공유기의 AP isolation 또는 클라이언트 격리 기능이 켜져 있지 않은지 확인한다.
- Vite 서버가 `localhost`에만 바인딩되지 않았는지 확인한다.

### 인터넷을 통한 테스트

`evenhub qr --url`에는 iPhone에서 접근할 수 있는 공개 HTTPS 주소도 넣을 수 있다. 따라서 개발 서버를 임시 호스팅하거나 보안 터널을 사용하면 같은 LAN 밖에서도 앱 URL을 불러올 수 있다.

다만 실제 G2와 R1은 Bluetooth로 연결된 iPhone 근처에 있어야 한다. Even Hub 개발은 케이블 없이 진행할 수 있지만, 인터넷을 통해 멀리 떨어진 G2에 직접 연결하는 구조는 아니다.

### 충전 독

충전 독은 Even Hub 앱 개발, 설치, 디버깅에 필요하지 않다. 앱 코드는 Windows에서 제공되고 iPhone의 Even Realities 앱이 이를 불러온다. 안경과 반지는 iPhone을 통해 앱과 통신한다.

## 시뮬레이터 테스트

공식 템플릿에는 Windows에서 실행할 수 있는 시뮬레이터가 포함되어 있다. 두 개의 PowerShell 창에서 다음 명령을 각각 실행한다.

```powershell
npm run dev
```

```powershell
npm run simulate
```

시뮬레이터에서 확인할 수 있는 항목은 다음과 같다.

- 안경 화면 레이아웃
- 텍스트, 목록, 이미지 컨테이너
- 누르기와 더블 누르기
- 위아래 스와이프
- 컴퓨터 마이크를 사용한 기본 오디오 흐름
- 앱 콘솔과 네트워크 오류

다음 항목은 실제 하드웨어에서 확인해야 한다.

- 실제 G2의 글자 가독성과 밝기
- 실제 IMU 데이터
- R1, 왼쪽 안경다리, 오른쪽 안경다리 입력 구분
- 배터리, 착용, 충전, 케이스 상태 변화
- 펌웨어의 목록 스크롤 감각
- 이미지 메모리 제한

시뮬레이터는 화면과 앱 로직을 빠르게 확인하는 용도이며 실기기 검증을 완전히 대신하지는 않는다.

## `app.json` 권한

2026-07-25에 확인한 공식 공개 자료에서는 다음 여섯 가지 권한을 선언할 수 있다.

| 권한 이름 | 접근 범위 | 주요 반환 데이터 또는 제약 |
| --- | --- | --- |
| `network` | 외부 HTTP 및 WebSocket 통신 | `whitelist`에 허용 URL을 선언해야 함 |
| `location` | iPhone 위치 서비스 | 위도, 경도, 정확도, 고도, 속도, 방향, 시각 |
| `g2-microphone` | G2 마이크 배열 | PCM s16le, 16 kHz, mono |
| `phone-microphone` | iPhone 마이크 | PCM s16le, 16 kHz, mono |
| `album` | iPhone 사진 앨범 | 사진 한 장, 파일명, MIME 타입, 크기, base64 |
| `camera` | iPhone 카메라 | 촬영한 사진 한 장과 관련 메타데이터 |

권한은 문자열 배열이 아니라 객체 배열로 작성한다. 각 권한에는 사용자에게 표시할 설명인 `desc`가 필요하다.

```json
{
  "permissions": [
    {
      "name": "network",
      "desc": "날씨 정보를 가져옵니다.",
      "whitelist": [
        "https://api.example.com"
      ]
    },
    {
      "name": "g2-microphone",
      "desc": "음성 명령을 인식합니다."
    }
  ]
}
```

`network` 허용 목록은 CORS를 우회하지 않는다. API 서버도 WebView 요청을 허용하는 CORS 헤더를 반환해야 한다. 개발 단계의 Vite 프록시는 로컬 테스트에는 사용할 수 있지만 패키징된 앱에서는 동작하지 않는다.

`VITE_API_KEY`와 같은 환경 변수는 빌드된 JavaScript에 포함된다. 비밀 API 키를 플러그인에 직접 넣지 말고 별도의 백엔드나 제한된 사용자 토큰을 사용하는 편이 안전하다.

## SDK에서 얻을 수 있는 정보

### 마이크

`audioControl`에서 G2 마이크와 iPhone 마이크 중 하나를 선택할 수 있다.

- G2 마이크: `AudioInputSource.Glasses`
- iPhone 마이크: `AudioInputSource.Phone`
- 형식: signed 16-bit little-endian PCM
- 샘플 레이트: 16 kHz
- 채널: mono

G2 마이크를 사용하려면 안경 쪽 시작 페이지 컨테이너를 먼저 만들어야 한다. 오디오 데이터는 `onEvenHubEvent`의 `audioEvent.audioPcm`으로 전달된다. SDK가 음성 인식 결과를 제공하는 것은 아니므로 별도의 STT 서비스나 로컬 모델이 필요하다.

### 위치

위치 정보는 G2가 아니라 iPhone의 위치 서비스에서 가져온다. 일회성 조회와 연속 업데이트를 지원한다.

- `latitude`
- `longitude`
- `accuracy`
- `altitude`
- `speed`
- `heading`
- `timestamp`

### IMU

`imuControl`로 G2의 IMU 보고를 시작하거나 중지할 수 있다. 공개 SDK는 `x`, `y`, `z` 세 값을 전달한다.

공개 타입에는 다음 항목이 명확히 정의되어 있지 않다.

- 각 축의 물리 단위
- 축의 방향, 부호, 원점과 오른손 또는 왼손 좌표계 여부
- 가속도계와 자이로스코프 값의 분리 방식
- quaternion
- 샘플별 타임스탬프
- 측정 범위, 분해능, 바이어스, 노이즈, 드리프트와 정확도

공식 문서는 `ImuReportPace.P100`부터 `P1000`까지의 값을 프로토콜 pacing code로 설명한다. 숫자를 그대로 100 Hz 또는 100 ms라고 단정해서는 안 된다. 이벤트에 센서 타임스탬프가 없으므로 실제 도착 간격은 앱에서 `performance.now()` 또는 `Date.now()`로 따로 기록해야 한다.

따라서 정밀한 자세 추정이나 제스처 인식 기능은 실기기에서 값의 의미와 범위를 먼저 측정해야 한다. 현재 `app.json`의 공식 권한 목록에는 별도 IMU 권한이 없다. 시뮬레이터의 IMU 데이터는 실제 센서 측정을 대신하지 못하므로 좌표계 확인은 G2 실기기가 필요하다.

### IMU 좌표계와 정확도 추가 조사

#### 공식적으로 확인되는 범위

G2 하드웨어 소개에는 IMU에 지자기 센서가 추가되었다고 적혀 있다. 그러나 공개 Even Hub SDK가 나침반 원시값, 가속도, 각속도 또는 융합 자세 중 무엇을 `x`, `y`, `z`로 보내는지는 명시하지 않는다. 하드웨어에 센서가 있다는 사실과 플러그인 API로 그 센서가 노출된다는 사실은 구분해야 한다.

현재 공식 자료만으로는 다음 질문에 답할 수 없다.

- 안경을 정면으로 착용했을 때 각 축이 앞, 오른쪽, 위쪽 중 어느 방향인지
- 값의 단위가 `g`, `m/s²`, `deg/s`, `rad/s` 또는 정규화된 무차원 값인지
- 정지 상태에서 중력 벡터를 받는지, 회전 속도나 융합된 방향을 받는지
- 공장 보정 여부와 기기 간 편차
- 정적 및 동적 정확도, 반복 정밀도, 지연과 샘플 누락률

그러므로 현재로서는 공식 좌표계 표를 만들거나 숫자로 정확도를 제시할 근거가 없다.

#### 공개 구현에서 확인한 경험적 해석

공개 앱 소스는 실제 활용 가능성을 보여 주지만 제조사 사양은 아니다.

| 공개 프로젝트 | IMU 사용 방식 | 해석할 때 주의할 점 |
| --- | --- | --- |
| `level-even-g2` | G2 한 대에서 고개를 끄덕일 때 얻은 두 중력 샘플의 외적으로 안경의 좌우 방향을 경험적으로 추정하고 장치 좌표계의 단위 벡터를 약 `(0.46, 0.88, 0.15)`로 사용 | 센서가 안경다리 안에서 머리 좌표계와 비스듬히 놓였을 가능성을 보여 주지만 한 기기에서 얻은 값이다 |
| `even-g2-posture` | `x`를 지수 이동 평균으로 평활화하고 기본 임계값 `-0.22` 이하가 이어지면 구부정한 자세로 판단 | `x`를 사실상 숙임 지표로 쓰지만 단위와 절대 각도는 주장하지 않는다 |
| `eyefit-g2` | 최근 1초의 축별 최댓값과 최솟값 차이가 `0.3` 이상이면 머리 회전이 있었다고 판정 | 위아래 움직임을 `x`, 좌우 움직임을 `y`처럼 취급하는 코드 주석이 있으나 세 축 중 하나라도 움직이면 통과시키는 느슨한 검증이다 |
| `pickleball-even-g2` | `sqrt(x²+y²+z²)`가 경험적 임계값 `2.5`를 넘으면 오디오로 감지한 타격을 보조 확인 | 코드 주석은 `g-force`라고 부르지만 공식 단위 확인 없이 경험적으로 튜닝한 값이다 |

특히 `level-even-g2`의 화면상 허용 오차 `0.1°`는 표시 기준일 뿐 측정 정확도 검증 결과가 아니다. 공개 앱의 임계값을 새 앱에 그대로 복사하기보다 사용자의 G2에서 다시 측정해야 한다.

#### 실제 G2에서 좌표계와 품질을 확인하는 방법

1. `P100`, `P500`, `P1000` 각각에서 `x`, `y`, `z`와 수신 시각을 60초 이상 기록한다.
2. 안경을 수평 테이블에 둔 정지 상태에서 축별 평균, 표준편차, 최솟값과 최댓값을 구한다.
3. 안경을 쓴 뒤 정면, 고개 숙임과 젖힘, 좌우 회전, 좌우 기울임을 각각 따로 수행한다.
4. 각 동작에서 크게 변하는 축, 부호, 값의 범위와 원위치 복귀 오차를 기록한다.
5. 같은 동작을 최소 5회 반복해 반복 정밀도와 기기 내부 흔들림을 구분한다.
6. 앱을 다시 실행하거나 안경을 재연결한 뒤 영점과 축 반응이 유지되는지 확인한다.
7. 수신 간격의 중앙값, 95백분위수와 누락 구간을 계산해 pacing code별 실제 전달 속도를 확인한다.

이 실험으로 얻는 값은 보유한 G2와 현재 펌웨어, iPhone 환경의 종단 간 성능이다. 제조사가 보증하는 절대 정확도와는 다르지만 제스처 임계값과 평활화 계수를 정하는 데는 더 유용하다.

#### 가능한 활용 사례

- 고개 끄덕임과 좌우 흔들기를 이용한 간단한 확인 및 취소 제스처
- 구부정한 자세가 일정 시간 이어졌을 때 알림
- 머리 기울기에 반응하는 수평계나 간단한 계기판
- 오디오와 움직임을 결합한 라켓 타격, 달리기 충격 등의 이벤트 보조 판정
- 고개 움직임이 있었는지 확인하는 시선 휴식 또는 운동 안내
- 사용자가 정면 자세를 보정한 뒤 상대적인 스크롤이나 메뉴 선택

절대 방위, 정밀 내비게이션, 의료 진단, 충돌 판정처럼 오차 비용이 큰 기능에는 현재 공개 API만으로 부족하다. 특히 Even Hub 약관은 건강 및 의료 관련 플러그인의 공개 게시를 제한하므로 자세 교정이나 운동 앱은 기능 표현과 심사 가능성을 별도로 확인해야 한다.

### G2 및 R1 입력

G2 터치패드와 R1은 같은 기본 제스처를 제공한다.

- 누르기
- 더블 누르기
- 위로 스와이프
- 아래로 스와이프

시스템 이벤트의 `eventSource`로 입력 출처를 구분할 수 있다.

| 값 | 입력 출처 |
| --- | --- |
| `0` | 미지정 |
| `1` | 오른쪽 안경다리 |
| `2` | R1 |
| `3` | 왼쪽 안경다리 |

앱의 foreground 진입, background 진입, 비정상 종료, 시스템 종료 이벤트도 받을 수 있다.

### 기기 정보

`getDeviceInfo()`와 기기 상태 이벤트에서 다음 정보를 얻을 수 있다.

- 모델: G1, G2, Ring1
- 시리얼 번호
- 연결 상태
- 착용 여부
- 배터리 잔량
- 충전 여부
- 충전 케이스 안에 있는지 여부

공개 TypeScript API에서는 여러 기기를 한 번에 열거하는 별도의 목록 API가 확인되지 않았다. R1은 입력 출처와 기기 모델로 식별할 수 있지만 R1의 원시 센서 또는 건강 데이터는 노출되지 않는다.

### 사용자 정보

`getUserInfo()`는 다음 계정 정보를 제공한다.

- 사용자 UID
- 표시 이름
- 아바타 URL
- 국가 코드

이 정보는 앱 기능에 꼭 필요한 경우에만 사용하고 개인정보 처리 방침에 명시해야 한다.

### 앱 저장소

다음 SDK 저장소 API를 사용할 수 있다.

- `setLocalStorage(key, value)`
- `getLocalStorage(key)`

값은 문자열로 저장한다. Even Realities 앱에 보관되므로 앱 재시작 후에도 사용할 수 있다. 일반 브라우저 `localStorage`와 IndexedDB는 WebView 재시작 후 유지가 안정적이지 않을 수 있으므로 영속 데이터에는 SDK 저장소를 우선 사용하는 것이 좋다.

### 화면 및 이미지

SDK는 다음 작업을 지원한다.

- 시작 페이지 컨테이너 생성
- 페이지 전체 재구성
- 텍스트 일부 업데이트
- 이미지 원시 데이터 업데이트
- 앱 종료 요청

전화기 카메라나 앨범에서 받은 이미지는 안경 크기에 맞게 축소하고 그레이스케일로 변환한 뒤 보내야 한다. 큰 원본 사진을 그대로 보내면 전송량과 안경 메모리가 문제가 될 수 있다.

## AI, STT와 오디오 처리

### SDK가 AI와 STT를 제공하는지 여부

2026-07-25에 확인한 `@evenrealities/even_hub_sdk` 0.0.12의 공개 메서드 목록에는 AI 모델, Even AI, 음성 인식, 전사, 프롬프트, 채팅 응답 생성 또는 TTS 호출이 없다. 공식 개발 문서도 현재 공개된 개발 표면은 플러그인이고 `AI skills`는 앞으로 제공할 기능이라고 설명한다. 제품에 내장된 Even AI 기능과 플러그인 개발자가 호출할 수 있는 API는 구분해야 한다.

공식 ASR 템플릿도 STT 엔진을 포함하지 않는다. 템플릿의 `startSttStream()`은 개발자가 공급자를 연결하도록 비워 둔 스텁이며, Deepgram, AssemblyAI, Whisper, Soniox 또는 자체 서버 등을 예로 든다. 현재의 일반적인 흐름은 다음과 같다.

```text
G2 마이크
16 kHz, signed 16-bit little-endian, mono PCM
        |
        v
Even Hub WebView
audioEvent.audioPcm
        |
        | WebSocket 또는 HTTPS
        v
개발자 백엔드 또는 STT 서비스
        |
        v
전사문 또는 LLM 응답
        |
        v
G2 텍스트 및 이미지 컨테이너
```

외부 서비스에 연결하려면 `network` 권한과 STT 및 AI 호스트의 허용 목록이 필요하다. CORS도 서버에서 별도로 허용해야 한다. `VITE_STT_API_KEY`처럼 빌드 시 주입한 키는 패키지의 JavaScript에서 추출할 수 있으므로 실제 출시 앱에서는 비밀 키를 백엔드에 두는 편이 안전하다.

WASM 기반 로컬 STT나 소형 로컬 모델을 WebView에서 실행하는 것은 웹 기술상 실험할 수 있다. 다만 iPhone의 메모리, 발열, 배터리, 앱의 백그라운드 전환과 모델 파일 크기 제약이 있고 Even이 제공하는 기능은 아니다. G2에는 스피커가 없고 공개 SDK에도 오디오 출력 API가 없으므로 답변은 안경에 글로 표시하거나 전화기 쪽 별도 출력 경로를 사용해야 한다.

### G2 네 개 마이크와 음원 방향 추정

G2 하드웨어에는 네 개의 마이크가 있지만 공식 개발 문서는 플러그인 입력을 `4-mic array, single stream, 16 kHz PCM`으로 명시한다. SDK 이벤트도 다음 두 값만 제공한다.

- `source`: `glasses` 또는 `phone`
- `audioPcm`: 16 kHz signed 16-bit little-endian 모노 PCM 한 스트림

여기서 `source`는 G2의 1번부터 4번 마이크를 구분하는 값이 아니다. G2와 iPhone 중 어느 입력원을 열었는지를 나타낸다. 마이크별 채널, 마이크 배치 좌표, 위상, 샘플별 시각, 빔포밍 방향과 같은 메타데이터는 공개되지 않는다.

마이크 배열로 소리의 방향을 구하는 작업은 보통 음원 도래 방향, 즉 DOA 추정이라고 한다. 마이크 쌍 사이의 도달 시간차인 TDOA나 위상차를 계산하려면 동기화된 개별 채널이 필요하다. 네 채널이 하나의 모노 스트림으로 합쳐진 뒤에는 이 차이를 복원할 수 없다. 따라서 현재 Even Hub SDK로는 네 마이크를 직접 사용한 DOA, 빔포밍 또는 삼각측량을 구현할 수 없다.

작은 단일 배열에서는 충분한 채널이 있어도 주로 방향각을 추정하며, 음원까지의 거리와 3차원 위치를 한 번에 구하는 문제는 더 어렵다. 방 안의 반사음, 여러 음원, 안경 착용 각도와 마이크 간격도 오차를 키운다.

대신 모노 스트림으로는 다음 기능을 만들 수 있다.

- 음성 구간 검출
- 키워드 및 음향 이벤트 분류
- STT와 실시간 자막
- 음량, 피크와 시작 시점 감지
- 음악의 음높이 또는 대략적인 주파수 분석

실험적인 우회 방법으로는 사용자가 고개를 천천히 돌리는 동안 모노 음량이나 특정 음향 특징과 G2 IMU 값을 함께 기록하는 방식이 있다. 정지한 단일 음원과 충분한 보정이 있다는 가정 아래 상대적으로 소리가 강해지는 머리 방향을 찾는 방식이다. 이는 네 마이크의 시간차를 이용한 즉시 방향 추정이 아니며, 자동 이득 조정, 잡음 억제, 반사음과 IMU 좌표계 불확실성 때문에 정밀 기능으로 간주하면 안 된다.

## R1 센서와 반지 각도

R1 하드웨어에는 활동량과 걸음 수 계산에 쓰이는 IMU가 있다. PPG, 혈중 산소, HRV와 NTC 온도 센서도 제품 기능에 사용된다. 그러나 하드웨어에 센서가 있다는 사실이 플러그인 API에 원시 센서가 공개되었다는 뜻은 아니다.

현재 공개 SDK에서 R1에 관해 확인되는 것은 다음 정도다.

- 누르기, 더블 누르기, 위아래 스와이프
- `eventSource = 2`를 통한 R1 입력 출처 구분
- `DeviceModel.Ring1` 모델 값

다음 값은 공개 API에서 확인되지 않는다.

- R1의 가속도계 또는 자이로스코프 원시값
- 반지의 절대 또는 상대 각도
- quaternion, yaw, pitch, roll
- 손가락 자세 또는 공간 위치
- R1의 심박수, HRV, 혈중 산소, 체온, 수면과 걸음 수

`imuControl()`과 `IMU_DATA_REPORT`는 공식 SDK 레퍼런스에서 G2 안경의 IMU로 설명된다. R1 입력 이벤트에 연속적인 회전값이 붙지 않으므로 누르기와 스와이프만으로 반지 각도를 추정할 수도 없다. R1 각도나 원시 건강 데이터를 쓰는 앱은 현재 공개 플러그인 SDK 범위를 벗어난다.

## iOS WebView에서 쓸 수 있는 기능

Even Hub 플러그인은 Even Realities 앱이 호스팅하는 Flutter WebView 안의 일반 HTML 및 TypeScript 웹 페이지다. 따라서 전화기 화면에서는 HTML, CSS, DOM과 일반 JavaScript 로직을 사용할 수 있다. 그러나 모든 Safari API가 Even Hub에서 동일하게 보장되는 것은 아니다. iOS 버전, WebView 설정, 보안 컨텍스트, 앱 권한과 background 전환 방식에 따라 달라진다.

현재 기준으로는 다음처럼 구분하는 편이 안전하다.

| 구분 | 기능 | 판단 |
| --- | --- | --- |
| 기본 웹 기능 | HTML, CSS, DOM, ES 모듈, Promise, 타이머, JSON, URL, Canvas와 SVG | 전화기 WebView UI에서 사용 가능 |
| 네트워크 | `fetch`, `WebSocket` | `network` 권한, 허용 목록과 서버 CORS가 필요 |
| 계산 | Web Worker, WebAssembly, Web Crypto | iOS WebKit 버전에 따라 쓸 수 있지만 실기기 기능 감지가 필요 |
| 브라우저 저장소 | `localStorage`, IndexedDB, Cache API | 존재 여부와 유지 기간을 보장하지 말고 영속 설정은 SDK 저장소 우선 |
| 미디어 재생 | `<audio>`, `<video>` | 전화기에서만 의미가 있고 자동 재생 및 사용자 제스처 제한을 받을 수 있음 |
| 전화기 센서와 미디어 입력 | 위치, 카메라, 앨범, G2 및 전화기 마이크 | 일반 브라우저 API보다 Even Hub SDK와 매니페스트 권한을 사용 |
| 백그라운드 | 타이머, 오디오, 네트워크, 상태 유지 | 일반 웹 페이지처럼 계속 산다고 가정하면 안 되며 SDK의 상태 저장 및 복원 흐름 사용 |
| 조건부 기능 | Service Worker, Push, Notifications, Clipboard, Share, 파일 다운로드 | Even이 호환성을 보증하는 표가 없으므로 핵심 기능에 의존하지 말고 실기기 확인 |
| 사용할 수 없는 웹 하드웨어 API | Web Bluetooth, WebUSB, WebSerial, WebHID, WebNFC | iOS WebKit에서 지원하지 않으며 G2 또는 R1에 직접 연결하는 데도 사용할 수 없음 |

전화기 WebView의 DOM과 Canvas가 G2에 자동으로 미러링되지는 않는다. G2 출력은 SDK의 텍스트, 목록과 이미지 컨테이너를 별도로 만들어야 한다. 브라우저의 `navigator.geolocation`이나 `getUserMedia()`가 특정 iOS 버전에서 존재하더라도, Even Hub가 공식적으로 권한과 생명주기를 연결한 경로는 SDK의 위치, 카메라, 앨범과 마이크 API다. 핵심 기능은 SDK 경로로 만드는 편이 이식성과 심사 대응에 유리하다.

Service Worker와 일반 브라우저 저장소는 특히 조심해야 한다. WKWebView에서는 호스트 앱의 app-bound domain 설정, HTTPS 여부와 iOS 버전에 따라 Service Worker 동작이 달라질 수 있다. Even Hub도 foreground WebView와 headless WebView 사이에서 JSON 상태를 스냅샷하고 복원하는 별도 방식을 문서화한다. 따라서 Service Worker가 앱을 계속 실행해 줄 것이라고 가정하지 말고 `setBackgroundState()`와 `onBackgroundRestore()`를 사용해 필요한 상태를 직접 복원해야 한다.

프로젝트 시작 시 다음과 같은 기능 감지 화면을 하나 만들어 실제 iPhone의 로컬, 비공개 및 베타 테스트에서 결과를 저장하는 것이 좋다.

```ts
const capabilities = {
  secureContext: window.isSecureContext,
  fetch: typeof window.fetch === 'function',
  webSocket: typeof window.WebSocket === 'function',
  indexedDb: 'indexedDB' in window,
  serviceWorker: 'serviceWorker' in navigator,
  mediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
  webAssembly: typeof WebAssembly === 'object',
  webCrypto: Boolean(crypto?.subtle),
  webBluetooth: 'bluetooth' in navigator,
}
```

로컬 QR 테스트는 HTTP 주소를 쓰는 경우가 많아 secure context가 필요한 API가 패키징된 HTTPS 또는 베타 환경과 다르게 보일 수 있다. 기능 감지와 실기기 검증은 최종 배포 형태에서도 한 번 더 해야 한다.

## 공개 SDK에서 확인되지 않은 기능

현재 공식 공개 SDK는 다음 기능을 제공하지 않는다.

- 앱에서 G2 또는 R1로 직접 Bluetooth 연결
- G2의 카메라
- 스피커 또는 오디오 출력
- Even AI, LLM, STT와 TTS 호출
- R1 원시 모션 센서
- R1 각도와 자세
- R1 건강 및 생체 정보
- G2 마이크별 네 개의 원시 오디오 채널
- 마이크 배열의 빔포밍 또는 음원 방향 메타데이터
- iPhone 연락처
- iPhone 캘린더
- iPhone 알림 내역
- HealthKit
- 안경 화면의 일반 HTML 및 CSS 렌더링
- 임의 폰트와 텍스트 정렬
- 배경색과 일반적인 UI 애니메이션
- 컬러 이미지

이미지 컨테이너를 통한 비트맵 표시는 가능하지만 일반 Canvas처럼 안경 화면의 픽셀을 자유롭게 그리는 API는 아니다.

## 패키징과 게시

개발이 끝나면 앱을 빌드하고 `.ehpk` 파일로 패키징한다.

```powershell
npm run build
npx evenhub pack app.json dist -o my-app.ehpk
```

생성한 파일은 Even Hub 개발자 포털에 올려 검토와 게시 절차를 진행한다.

공식 지원 문서 일부에는 업로드 파일을 `.ehp`로 표기하지만 현재 공개 CLI와 공식 템플릿은 `.ehpk`를 사용한다. 실제 업로드에서는 현재 설치된 CLI와 개발자 포털이 요구하는 확장자를 우선해야 한다.

## 유료 판매 정책

### 약관에서 확인되는 내용

2026-03-24에 갱신된 Even Hub 이용 약관은 사용자가 플러그인을 사용, 라이선스, 구독 또는 다운로드할 수 있다고 설명한다. 개발자 플러그인의 사용료 지급 의무는 사용자와 개발자 사이에 있다고 명시한다. 개발자 약관도 개발자의 판매 활동은 개발자가 독립적으로 수행하고 위험과 책임을 부담한다고 정한다.

이를 종합하면 유료 라이선스나 구독 사업 자체는 약관이 예상하는 사용 형태다. 그러나 이것이 Even Hub 안에 결제 버튼과 정산 기능이 이미 제공된다는 뜻은 아니다.

| 항목 | 공개 자료에서 확인한 상태 |
| --- | --- |
| 유료 사용 또는 구독 개념 | 이용 약관에 있음 |
| Even Hub 자체 결제 SDK와 체크아웃 | 확인되지 않음 |
| 가격 설정 화면 | 확인되지 않음 |
| Even의 판매 수수료와 수익 배분율 | 확인되지 않음 |
| 지급 주기, 최소 지급액, 지원 통화 | 확인되지 않음 |
| 환불, 취소, 분쟁 처리 절차 | 개발자 플러그인용 세부 정책을 찾지 못함 |
| 부가가치세와 국가별 세금 처리 | 공개 정산 문서가 없으며 개발자 책임 범위로 보임 |
| 외부 계정과 자체 구독 | 제3자 플러그인이 별도 계정 체계를 둘 수 있다고 약관이 예정하지만 허용되는 결제 방식은 별도 확인 필요 |

따라서 현재 가장 정확한 표현은 "유료 판매는 약관상 가능성을 열어 두었지만 공개된 마켓 결제 및 정산 체계는 없다"이다. 외부 웹 결제, iOS 인앱 결제, 초대 코드 또는 자체 구독 중 어느 방식을 허용하는지는 출시 전에 Even Realities의 서면 답변을 받는 편이 안전하다.

### 유료 앱을 만들 때 알아야 할 조건

- 개발자는 플러그인의 기능, 보안, 가용성, 고객 지원과 자체 약관을 책임진다.
- 권한이나 개인정보를 쓰면 개인정보 처리방침에 수집 항목, 목적과 처리 방식을 구체적으로 적어야 한다.
- `.ehpk`는 추출할 수 있으므로 API 키, 결제 비밀키와 라이선스 판정 로직을 번들에 넣으면 안 된다. 유료 권한은 서버에서 검증하는 구조가 필요하다.
- 게시된 플러그인과 개발자 콘텐츠에는 Even Realities가 플랫폼 운영, 배포, 개선과 홍보에 사용할 수 있는 광범위한 비독점, 양도 가능, 재허락 가능, 무상, 전 세계 라이선스가 부여된다. 개발자의 기존 지식재산권 자체가 이전되는 것은 아니지만 계약 범위는 출시 전에 검토할 필요가 있다.
- 금융 상품 및 서비스, 건강 및 의료, 교육 및 훈련, 인스턴트 메시징, 아동 대상 서비스와 기타 위험하다고 판단되는 앱은 현재 게시 대상에서 제외된다.
- 공개 후 보안 검사와 지원 부담도 개발자에게 남는다. 약관은 게시된 플러그인을 최소 6개월마다 보안 점검하도록 요구한다.

처음에는 무료 또는 비공개 베타로 제품을 검증하고, 결제 구현 전에 개발자 지원 채널에 다음 사항을 문서로 문의하는 것이 좋다.

1. 한국 개발자의 유료 플러그인 등록 가능 여부
2. 허용되는 결제 사업자와 결제 흐름
3. Even Hub 안에서 가격을 표시할 수 있는지 여부
4. 수수료, 환불, 부가가치세, 영수증과 정산 책임
5. 구독 해지와 계정 삭제 시 플러그인 이용권 처리 방식

## 앱 심사 절차와 기간

### 공식 절차

개발자 포털의 앱 상태는 `Draft`, `Test`, `Submitted`, `Released` 순서로 진행된다. 제출하면 자동으로 심사자에게 배정된다. 심사자는 설치와 실행을 포함한 수동 QA를 수행한 뒤 승인하거나 반려한다. 주요 확인 항목은 다음과 같다.

- 매니페스트와 버전
- 아이콘, 배너와 스크린샷
- 요청한 모든 권한을 설명하는 개인정보 처리방침
- 최초 실행과 설정 흐름
- 네트워크 요청과 CORS
- iPhone이 잠긴 상태와 앱 생명주기
- 종료 처리와 사용자 안전

`Released` 빌드는 변경할 수 없으며 수정하려면 더 높은 버전으로 새 빌드를 제출해야 한다. 즉, 업데이트도 다시 검토될 수 있다고 계획해야 한다.

### 심사 기간

2026-07-25 현재 공식 앱 제출 문서와 개발자 약관에는 처리 기한, 서비스 수준 약정, 평균 또는 중앙 심사 시간이 없다. 공개 커뮤니티 글에도 평균을 계산할 만큼 신뢰할 수 있는 승인 시각 사례가 없다. 2026년 5월에는 한 개발자가 앱을 제출한 뒤 승인까지 얼마나 걸리는지 알 수 없다고 썼다. 초기 Hub 출시 때에는 수정본이 Even의 검토를 기다린다는 개발자 글도 있었다.

공식 파일럿 프로그램 문서의 `10영업일 이내 응답 예정`은 초기 개발자 접근 신청에 관한 목표다. 완성한 앱의 Publication Review 기간이 아니므로 앱 심사 예상치로 사용하면 안 된다. 커뮤니티에서 언급된 `48시간 이내` 사례도 베타 접근 승인 사례이지 앱 심사가 아니다.

현재 일정은 다음처럼 보수적으로 잡는 편이 좋다.

- 공개 출시일에 심사 완료를 전제로 약속하지 않는다.
- 첫 제출과 업데이트 모두 기간이 정해지지 않은 외부 의존성으로 둔다.
- 공개 심사를 기다리는 동안 로컬 테스트, 비공개 테스트와 베타 배포를 사용한다.
- 베타는 `Released`와 유사한 조건에서 동작하므로 iPhone 잠금 상태, 5분 이상 실행, 네트워크와 종료 흐름을 먼저 검증한다.

## 한국 커뮤니티와 개발자 활동

### 확인 결과

2026-07-25 현재 공개 검색으로 확인되는 Even Realities 공식 한국 커뮤니티, 공식 한국어 Discord, 네이버 카페 또는 한국 전용 개발자 그룹은 찾지 못했다. 네이버 카페 내부는 검색 로봇 제한 때문에 전수 확인하지 못했다. 공개 검색으로 노출되지 않는 비공개 채팅방이나 소규모 모임도 있을 수 있다.

현재 확인되는 공식 및 대표 글로벌 채널은 다음과 같다.

| 채널 | 용도 | 한국어 전용 여부 |
| --- | --- | --- |
| 공식 Even Realities Discord | 개발 질문, 버그 제보, 기능 의견, 개발자 간 교류 | 아님 |
| 커뮤니티 서브레딧 `r/EvenRealities` | 제품과 Even Hub 사용 경험, 개발 논의 | 아님 |
| Even Realities GitHub | 공식 템플릿, SDK 보조 자료, 이슈와 공개 코드 | 아님 |

한국어권의 공개 흔적은 아직 소수다.

- 한국 App Store에는 G2 핵심 기능의 한국어 지원 경험을 적은 사용자 리뷰가 있다.
- 한국에 거주한다고 공개한 엔지니어 Hyeong Jun Huh가 2026-07-14에 G2 실사용과 WebView 기반 플러그인 구조를 한국어로 정리했다.
- 해당 글에서 연결한 Discord는 일반 창업가 및 개발자 커뮤니티이며 Even Realities 전용 한국 커뮤니티는 아니다.
- 이 작성자의 공개 GitHub에서는 Even Hub SDK를 사용한 저장소나 공개 플러그인을 확인하지 못했다. 따라서 G2를 보유한 한국 거주 엔지니어임은 확인되지만 공개 Even Hub 앱 개발자라고 단정할 근거는 부족하다.

GitHub에서 `"Even G2"` 저장소 검색 상위 100개와 저장소 소유자의 공개 프로필 위치도 표본 조사했다. `Korea`, `Seoul`, `한국`, `대한민국`으로 자신을 표시한 소유자는 나오지 않았다. 위치를 공개하지 않은 개발자, 조직 계정, 비공개 저장소와 검색어가 다른 프로젝트는 빠질 수 있으므로 "한국 개발자가 없다"는 증거로 해석하면 안 된다.

현재 상태는 다음처럼 정리할 수 있다.

- 한국 사용자와 개발자의 관심은 확인된다.
- 한국어로 된 실사용 및 개발 구조 소개도 나오기 시작했다.
- 공개적으로 검증되는 전용 커뮤니티와 한국어 Even Hub 오픈소스 생태계는 아직 매우 작다.
- 당장 기술 지원을 받으려면 공식 Discord의 개발자 채널과 공식 GitHub를 이용하는 것이 가장 빠르다.
- 한국 사용자가 늘면 공식 Discord 안에 한국어 스레드나 채널을 요청하고, 공개 GitHub 조직 또는 문서 저장소로 자료를 모으는 방식이 현실적이다.

## 현재 확인한 공개 패키지

2026-07-25에 npm registry에서 확인한 버전은 다음과 같다.

| 패키지 | 확인 버전 |
| --- | --- |
| `@evenrealities/even_hub_sdk` | `0.0.12` |
| `@evenrealities/evenhub-cli` | `0.1.13` |

템플릿이 더 낮은 최소 버전을 참조할 수 있으므로 실제 프로젝트에서는 설치된 SDK 버전과 `app.json`의 `min_sdk_version`을 맞춰야 한다.

## 권장 첫 실험

처음에는 다음 기능만 넣은 작은 앱으로 전체 경로를 확인하는 것이 좋다.

1. `minimal` 템플릿에서 G2에 한 줄 텍스트를 표시한다.
2. R1 누르기로 표시 문구를 변경한다.
3. 더블 누르기로 앱 종료 확인창을 연다.
4. 시뮬레이터에서 화면과 이벤트를 확인한다.
5. 같은 Wi-Fi의 iPhone에서 QR 코드를 스캔한다.
6. 실제 G2와 R1에서 입력 출처와 화면을 검증한다.

이 흐름이 성공하면 마이크, 위치, 네트워크 API, 이미지 순서로 기능을 늘리는 편이 문제를 분리하기 쉽다.

## 추가 확인이 필요한 항목

- Even Hub가 허용하는 실제 결제 흐름과 결제 사업자
- 가격 설정, 수수료, 환불, 세금과 정산 방식
- 한국 개인 또는 사업자 계정의 유료 게시 가능 여부
- R1의 배터리 상태를 G2와 별도로 조회할 수 있는지 여부
- 제조사가 보증하는 IMU `x`, `y`, `z`의 물리 단위, 좌표계와 정확도
- iOS에서 background 전환 시 마이크와 위치 업데이트의 실제 동작
- 앱 심사의 공식 처리 목표와 실제 승인 기간 통계
- 공식 또는 자생적인 한국어 Even Realities 개발자 그룹의 출현 여부
- G2 펌웨어의 네 마이크 전처리, 자동 이득 조정과 잡음 억제 방식
- iOS 버전과 Even Realities 앱 버전별 WebView 기능 감지 결과

## 출처

모든 링크는 2026-07-25에 확인했다.

- [Even Hub 개발자 포털](https://hub.evenrealities.com/)
- [Even Hub 개발 문서 개요](https://hub.evenrealities.com/docs)
- [Even Hub 지원 문서](https://support.evenrealities.com/hc/en-us/articles/15688149217167-Even-Hub)
- [Even Hub 이용 약관](https://support.evenrealities.com/hc/en-us/articles/15606749676175-Even-Hub-Terms-of-Service)
- [Even Hub 개발자 플랫폼 약관](https://support.evenrealities.com/hc/en-us/articles/15606676690703-Even-Hub-Developer-Platform-Terms-of-Service)
- [Even Hub 개발자 데이터 처리 계약](https://support.evenrealities.com/hc/en-us/articles/15606721200911-Even-Hub-Developer-Platform-Data-Processing-Agreement)
- [앱 제출 및 심사 문서](https://hub.evenrealities.com/docs/ship/app-submission)
- [패키징 문서](https://hub.evenrealities.com/docs/ship/packaging)
- [테스트 방식 개요](https://hub.evenrealities.com/docs/test)
- [베타 테스트 문서](https://hub.evenrealities.com/docs/test/beta-testing)
- [Even Hub 파일럿 프로그램](https://support.evenrealities.com/hc/en-us/articles/15016109505679-Even-Hub-Pilot-Program)
- [공식 Device APIs 문서](https://hub.evenrealities.com/docs/build/device-apis)
- [G2 센서 설계 소개](https://www.evenrealities.com/zh-Hant-NO/blogs/even-insider/how-we-shaped-even-g2-from-the-outside-in)
- [Even Realities 공식 GitHub](https://github.com/even-realities)
- [공식 Even Hub 스타터 템플릿](https://github.com/even-realities/evenhub-templates)
- [공식 minimal 템플릿](https://github.com/even-realities/evenhub-templates/tree/main/minimal)
- [공식 ASR 템플릿](https://github.com/even-realities/evenhub-templates/tree/main/asr)
- [공식 ASR 템플릿의 STT 연결 설명](https://github.com/even-realities/evenhub-templates/blob/main/asr/README.md)
- [Everything EvenHub 개발 자료](https://github.com/even-realities/everything-evenhub)
- [전체 SDK 메서드 및 이벤트 레퍼런스](https://github.com/even-realities/everything-evenhub/blob/main/plugins/everything-evenhub/skills/sdk-reference/SKILL.md)
- [WebView background 상태 저장 및 복원 레퍼런스](https://github.com/even-realities/everything-evenhub/blob/main/plugins/everything-evenhub/skills/background-state/SKILL.md)
- [기기 기능 레퍼런스](https://github.com/even-realities/everything-evenhub/blob/main/plugins/everything-evenhub/skills/device-features/SKILL.md)
- [입력 이벤트 레퍼런스](https://github.com/even-realities/everything-evenhub/blob/main/plugins/everything-evenhub/skills/handle-input/SKILL.md)
- [패키징 및 권한 레퍼런스](https://github.com/even-realities/everything-evenhub/blob/main/plugins/everything-evenhub/skills/build-and-deploy/SKILL.md)
- [시뮬레이터 레퍼런스](https://github.com/even-realities/everything-evenhub/blob/main/plugins/everything-evenhub/skills/test-with-simulator/SKILL.md)
- [Even Hub SDK npm 패키지](https://www.npmjs.com/package/@evenrealities/even_hub_sdk)
- [Even Hub CLI npm 패키지](https://www.npmjs.com/package/@evenrealities/evenhub-cli)
- [Even Hub Simulator npm 패키지](https://www.npmjs.com/package/@evenrealities/evenhub-simulator)
- [Even R1 센서 사양](https://support.evenrealities.com/hc/en-us/articles/13500531254159-Specs)
- [Even R1 조작 및 건강 데이터 안내](https://support.evenrealities.com/hc/en-us/articles/13772400722063-How-to-Control)
- [WebKit에서 의도적으로 제공하지 않는 하드웨어 Web API 목록](https://webkit.org/tracking-prevention/)
- [마이크 쌍의 TDOA를 사용하는 음원 방향 추정 연구](https://pure.kaist.ac.kr/en/publications/microphone-pair-training-for-robust-sound-source-localization-wit/)
- [공개 수평계 앱 `level-even-g2`](https://github.com/nickustinov/level-even-g2)
- [공개 자세 알림 앱 `even-g2-posture`](https://github.com/unicco/even-g2-posture)
- [공개 머리 운동 앱 `eyefit-g2`](https://github.com/aleapc/eyefit-g2)
- [공개 피클볼 보조 앱 `pickleball-even-g2`](https://github.com/hitching/pickleball-even-g2)
- [공개 IMU 기록 실험 `locate-sound`](https://github.com/KevinBalkoski/locate-sound/blob/main/src/spikes/imu-logger.ts)
- [공식 Even Realities Discord 초대](https://discord.gg/Y4jHMCU4sv)
- [Reddit `r/EvenRealities`](https://www.reddit.com/r/EvenRealities/)
- [한국어 G2 실사용 및 개발 구조 리뷰](https://cse.ac/jun/even-g2-review/)
- [한국 App Store의 Even Realities 앱](https://apps.apple.com/kr/app/even-realities/id6747017725)
- [앱 심사 기간을 알 수 없다고 언급한 공개 개발자 글](https://www.reddit.com/r/EvenRealities/comments/1t6epob/has_anyone_built_a_flight_tracker_for_the_even/)
