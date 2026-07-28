# Investigate Even Hub G2 and R1 App Development

- Confirmation date: 2026-07-25
- Target environment: Windows PC, iPhone, Even G2, Even R1, G2 charging dock
- Investigation scope: App structure, local and real-time device testing, SDK permissions, device data, AI and STT, R1 sensor, audio channel, WebView, distribution method, paid sales, screening, IMU, Korean community
- Reference materials: Even Realities developer portal and terms and conditions, support documentation, official GitHub repository, public npm packages, public app source and community posts

## Conclusion

You can develop an Even Hub app using only the equipment you currently have and test it on actual devices. Do not use the charging dock or USB cable for installing or debugging apps. Simply run the web app on Windows and scan the development QR code with the Even Realities app on your iPhone. G2 and R1 operate as screen output and input devices when connected to the iPhone.

The official development method is closer to a web app using TypeScript and Vite. However, the entire web page is not displayed on the glasses. The app logic and mobile phone UI run in the iPhone's WebView. The glasses screen is separately configured as a text, list, or image container through the bridge of the Even Hub SDK.

Paid plugins and subscriptions appear in the terms and conditions, but the public system through which Even Hub handles payment and settlement has not been confirmed. There is no deadline for processing public app reviews. The IMU only exposes `x`, `y`, and `z`, and does not have an official coordinate system, units, or accuracy specifications, so calibration of the actual device is necessary. I have yet to find an official Korean community or a publicly confirmed Korean Even Hub app development team. Currently, the official Discord, GitHub, and the community subreddit `r/EvenRealities` are the most practical communication channels.

There is no API in public SDK 0.0.12 to call Even AI, LLM, STT or TTS directly. The current implementation path is to receive the 16 kHz mono PCM from the G2 microphone and send it to an external or internal STT and AI backend. Although the R1 includes an IMU for activity tracking, the plugin does not reveal the raw R1 IMU, ring angle and health data. Since the G2's four microphones are delivered to the plug-in as a mono single stream rather than channel-specific data, microphone array-based sound source direction estimation cannot currently be implemented with the public API.

## Entire structure

```text
Windows PC
TypeScript and Vite Development Server
        |
        | Wi-Fi or HTTPS
        v
iPhone
Running app logic in WKWebView
Even Hub SDK Bridge
        |
        | Bluetooth
        v
G2 and R1
Screen output, gesture input, microphone, IMU
```

The role of each component is as follows.

| Components | Role |
| --- | --- |
| Windows PC | Write TypeScript code, run, build and package Vite development server |
| iPhone | Executing the app's WebView, network communication, permission handling, connection with G2 and R1 |
| G2 | 576 x 288 glasses screen, touch input, microphone, IMU |
| R1 | Press, double press, swipe up and down to enter |
| charging dock | For charging purposes only, not for transferring or debugging Even Hub apps |

## Type of app

The official starter template uses the following elements:

- HTML
- TypeScript
- Vite
- `@evenrealities/even_hub_sdk`
- `@evenrealities/evenhub-cli`
- `@evenrealities/evenhub-simulator`
- `app.json` containing app metadata

Vite is more of a default choice for official templates than a required framework. React or Vue can also be used as long as you build the final result as a static web asset and call the SDK bridge correctly. For a first app, it's simpler to start with the official `minimal` template.

Plain HTML and CSS are not displayed on the glasses screen. Create the following container provided by the SDK and send it to G2.

- Text container
- list container
- Image container

A general WebView UI can be configured on the phone screen. The glasses screen uses 576 x 288 resolution and 4-bit grayscale expression, and arbitrary CSS layouts or fonts cannot be used.

## Windows development environment

### Recommended supplies

- Node.js 18 or higher
- Git
- Latest Even Realities iOS app
- Even Hub developer account
- G2 and R1 paired with iPhone

### Get started with official templates

Run the following in PowerShell:

```powershell
git clone https://github.com/even-realities/evenhub-templates.git
Copy-Item -Recurse .\evenhub-templates\minimal .\my-g2-app
Set-Location .\my-g2-app

npm install
npm run dev
```

The official `minimal` template's Vite configuration uses `host: true` to allow connection from a LAN. The default port is 5173.

## Actual device test

### Tested on the same Wi-Fi

1. Connect your Windows PC and iPhone to the same Wi-Fi.
2. Make sure G2 and R1 are connected to the Even Realities app on iPhone.
3. Run `npm run dev` on Windows.
4. Check the LAN IPv4 address of your Windows PC with `ipconfig`.
5. Create a QR code for development using the address.
6. Open Developer Center in the Even Realities app on your iPhone and scan the QR code.
7. Run the plugin and check operation on G2 and R1.

If the PC address is `192.168.0.20`, an example is as follows.

```powershell
npx evenhub qr --url http://192.168.0.20:5173
```

If it doesn't connect, try opening the same URL in iPhone Safari first.

```text
http://192.168.0.20:5173
```

If it doesn't open in Safari, check the following items.

- Check whether Node.js is allowed to access the private network in the Windows firewall.
- Allow local network permissions for the Even Realities app on iOS.
- Check that the AP isolation or client isolation function of the router is not turned on.
- Check that the Vite server is not bound only to `localhost`.

### Testing via Internet

In `evenhub qr --url`, you can also enter a public HTTPS address that can be accessed from iPhone. So, by temporarily hosting a development server or using a secure tunnel, you can load your app URL from outside the same LAN.

However, the actual G2 and R1 must be near the iPhone connected via Bluetooth. Even Hub development can be carried out without a cable, but it is not structured to connect directly to a distant G2 through the Internet.

### Charging dock

The charging dock is not required for Even Hub app development, installation, or debugging. The app code is provided on Windows and loaded by the Even Realities app on iPhone. The glasses and ring communicate with the app through the iPhone.

## Simulator testing

The official template includes a simulator that can run on Windows. Run the following commands in each of the two PowerShell windows:

```powershell
npm run dev
```

```powershell
npm run simulate
```

The items that can be checked in the simulator are as follows.

- Glasses screen layout
- Text, list, image containers
- Tap and double tap
- Swipe up and down
- Basic audio flow using computer microphone
- App console and network errors

The following items must be checked on actual hardware.

- Actual G2 text readability and brightness
- Actual IMU data
- R1, left temple, right temple input classification
- Battery, wearing, charging, case status changes
- Sense of scrolling list of firmware
- Image memory limitations

The simulator is used to quickly check the screen and app logic and does not completely replace actual device verification.

## `app.json` permissions

The official public release, confirmed on 2026-07-25, declares the following six powers:

| permission name | reach range | Key return data or constraints |
| --- | --- | --- |
| `network` | External HTTP and WebSocket communication | Allowed URLs must be declared in `whitelist` |
| `location` | iPhone Location Services | Latitude, longitude, accuracy, altitude, speed, direction, time |
| `g2-microphone` | G2 Microphone Array | PCM s16le, 16 kHz, mono |
| `phone-microphone` | iPhone Microphone | PCM s16le, 16 kHz, mono |
| `album` | iPhone Photo Album | One photo, file name, MIME type, size, base64 |
| `camera` | iPhone Camera | A photo taken and its associated metadata |

Permissions are written as an object array, not a string array. Each permission requires `desc`, a description to be displayed to the user.

```json
{
  "permissions": [
    {
      "name": "network",
      "desc": "Get weather information.",
      "whitelist": [
        "https://api.example.com"
      ]
    },
    {
      "name": "g2-microphone",
      "desc": "Recognizes voice commands."
    }
  ]
}
```

The `network` whitelist does not bypass CORS. The API server must also return a CORS header allowing WebView requests. The development-stage Vite proxy can be used for local testing, but does not work with packaged apps.

Environment variables such as `VITE_API_KEY` are included in the built JavaScript. It is safer to use a separate backend or restricted user token rather than putting your secret API key directly into the plugin.

## Information available from SDK

### Microphone

In `audioControl`, you can choose between the G2 microphone and the iPhone microphone.

- G2 Microphone: `AudioInputSource.Glasses`
- iPhone microphone: `AudioInputSource.Phone`
- Format: signed 16-bit little-endian PCM
- Sample rate: 16 kHz
- Channel: mono

To use the G2 microphone, you must first create a glasses-side start page container. Audio data is delivered to `audioEvent.audioPcm` in `onEvenHubEvent`. Since the SDK does not provide voice recognition results, a separate STT service or local model is required.

### Location

Location information comes from the iPhone's location services, not the G2. Supports one-time inquiry and continuous updates.

- `latitude`
- `longitude`
- `accuracy`
- `altitude`
- `speed`
- `heading`
- `timestamp`

### IMU

You can start or stop reporting the G2's IMU with `imuControl`. The public SDK passes three values: `x`, `y`, and `z`.

The following items are not clearly defined in public types.

- Physical units of each axis
- Axis direction, sign, origin and whether right- or left-handed coordinate system
- Separation method of accelerometer and gyroscope values
- quaternion
- Timestamp per sample
- Measurement range, resolution, bias, noise, drift and accuracy

The official document describes the values ​​from `ImuReportPace.P100` to `P1000` as protocol pacing codes. You should not assume that the numbers are 100 Hz or 100 ms. Since the event does not have a sensor timestamp, the actual arrival interval must be recorded separately in the app with `performance.now()` or `Date.now()`.

Therefore, for precise posture estimation or gesture recognition functions, the meaning and range of values ​​must first be measured on an actual device. Currently, there is no separate IMU permission in the official permission list of `app.json`. Since the simulator's IMU data cannot replace actual sensor measurements, a G2 actual device is required to check the coordinate system.

### Further investigation of IMU coordinate system and accuracy

#### Officially confirmed scope

The G2 hardware introduction states that a geomagnetic sensor has been added to the IMU. However, the public Even Hub SDK does not specify whether it sends `x`, `y`, or `z` as compass raw values, acceleration, angular velocity, or fused attitude. It is important to distinguish between the fact that there is a sensor in the hardware and the fact that the sensor is exposed through a plug-in API.

Currently, official data alone cannot answer the following questions:

- When the glasses are worn facing forward, which direction is each axis: forward, right, or upward?
- Is the units of the value `g`, `m/s²`, `deg/s`, `rad/s`, or a normalized dimensionless value?
- Whether it receives the gravity vector at rest, or the rotational speed or fused direction
- Factory calibrated and device to device variations
- Static and dynamic accuracy, repeatability, delay and sample drop rate

Therefore, there is currently no basis to create an official coordinate system table or provide numerical accuracy.

#### Heuristics confirmed in public implementations

Open app sources show real-world usability, but are not manufacturer specifications.

| public project | How IMUs are used | Things to keep in mind when interpreting |
| --- | --- | --- |
| `level-even-g2` | We empirically estimate the left and right directions of the glasses as the outer product of two gravity samples obtained when nodding on one G2, and use the unit vector in the device coordinate system to be approximately `(0.46, 0.88, 0.15)` | This shows the possibility that the sensor may have been placed at an angle to the head coordinate system within the temple of the glasses, but the values ​​were obtained from a single device.
| `even-g2-posture` | `x` is smoothed with an exponential moving average, and if it falls below the default threshold `-0.22`, it is judged to be slouching | It uses `x` as a de facto bow indicator, but does not insist on units or absolute angles |
| `eyefit-g2` | If the difference between the maximum and minimum values ​​for each axis in the last 1 second is more than `0.3`, it is determined that there has been a head rotation | There is a code comment that treats up and down movement as `x` and left and right movement as `y`, but it is a loose verification that passes if any of the three axes moves |
| `pickleball-even-g2` | Secondary check for audio-detected hits if `sqrt(x²+y²+z²)` exceeds the empirical threshold `2.5` | Code comments call it `g-force`, but it is an empirically tuned value without formal unit confirmation |

In particular, the on-screen tolerance of `0.1°` for `level-even-g2` is only a display standard and not a result of verification of measurement accuracy. Rather than copying the public app's thresholds directly to the new app, you should measure them again on the user's G2.

#### How to check coordinate system and quality in real G2

1. Record `x`, `y`, `z` and reception time for more than 60 seconds on each of `P100`, `P500`, and `P1000`.
2. With the glasses at rest on a horizontal table, find the average, standard deviation, minimum and maximum values ​​for each axis.
3. After wearing glasses, perform the front view, head bow and tilt, left and right rotation, and left and right tilt separately.
4. Record the range of axes, signs, and values ​​that change significantly in each operation and the return to original position error.
5. Repeat the same movement at least 5 times to distinguish between repetition precision and internal shaking of the device.
6. Rerun the app or reconnect the glasses and check whether the zero point and axis response are maintained.
7. Check the actual delivery speed for each pacing code by calculating the median, 95th percentile, and missing section of the reception interval.

What you get from this experiment is the end-to-end performance of your G2, current firmware, and iPhone environment. Although it does not provide the absolute accuracy guaranteed by the manufacturer, it is more useful for determining gesture thresholds and smoothing coefficients.

#### Possible use cases

- Simple confirmation and cancellation gestures using head nod and left/right shake
- Notification when slouched posture continues for a certain period of time
- A level or simple dashboard that responds to head tilt
- Assisted judgment of events such as racket hitting and running impact that combines audio and movement
- Guided gaze rest or exercise to check for head movement
- Relative scrolling or menu selection after the user corrects the frontal posture

For functions with high error costs, such as absolute orientation, precision navigation, medical diagnosis, and collision determination, public APIs are currently insufficient. In particular, Even Hub terms and conditions restrict the public posting of health and medical-related plug-ins, so posture correction or exercise apps must separately check function expression and reviewability.

### G2 and R1 inputs

The G2 touchpad and R1 provide the same basic gestures.

- press
- Double press
- Swipe up
- Swipe down

The input source can be distinguished by the `eventSource` of the system event.

| value | input source |
| --- | --- |
| `0` | Unspecified |
| `1` | Right temple of temples |
| `2` | R1 |
| `3` | Left temple of temples |

You can also receive the app's entry into the foreground, entry into the background, abnormal termination, and system shutdown events.

### Device information

The following information can be obtained from `getDeviceInfo()` and device status events.

- Model: G1, G2, Ring1
- Serial number
- Connection status
- Whether to wear it or not
- Battery level remaining
- Whether to charge
- Whether it is in the charging case

In the public TypeScript API, a separate list API that enumerates multiple devices at once has not been identified. R1 can be identified by its input source and device model, but R1's raw sensor or health data is not exposed.

### User Information

`getUserInfo()` provides the following account information.

- User UID
- display name
- Avatar URL
- Country code

This information should be used only when absolutely necessary for the function of the app and should be specified in the privacy policy.

### App Store

You can use the following SDK repository APIs:

- `setLocalStorage(key, value)`
- `getLocalStorage(key)`

The value is stored as a string. Because it is stored in the Even Realities app, it can be used even after restarting the app. General browser `localStorage` and IndexedDB may not be stable after WebView restart, so it is recommended to use SDK storage first for persistent data.

### Screens and Images

The SDK supports the following tasks:

- Create a start page container
- Reorganize entire page
- Some text updates
- Update image raw data
- Request to close the app

Images received from a phone camera or album must be reduced to fit the size of the glasses and converted to grayscale before being sent. If you send a large original photo as is, transmission volume and glasses memory may be problems.

## AI, STT and audio processing

### Whether the SDK provides AI and STT

The public method list of `@evenrealities/even_hub_sdk` 0.0.12, checked on 2026-07-25, does not include AI models, Even AI, speech recognition, transcription, prompts, chat response generation, or TTS calls. The official development document also explains that the currently released development surface is a plugin and ‘AI skills’ are a feature to be provided in the future. A distinction must be made between Even AI functions built into the product and APIs that plug-in developers can call.

The official ASR template also does not include an STT engine. `startSttStream()` in the template is an empty stub for developers to connect providers, examples include Deepgram, AssemblyAI, Whisper, Soniox or your own server. The current general flow is as follows.

```text
G2 microphone
16 kHz, signed 16-bit little-endian, mono PCM
        |
        v
Even Hub WebView
audioEvent.audioPcm
        |
        | WebSockets or HTTPS
        v
Developer backend or STT service
        |
        v
Transcript or LLM response
        |
        v
G2 Text and Image Container
```

Connecting to external services requires `network` permission and whitelisting of STT and AI hosts. CORS must also be separately allowed on the server. Keys injected during build, such as `VITE_STT_API_KEY`, can be extracted from the JavaScript of the package, so it is safer to place the secret key in the backend in the actual released app.

Running WASM-based local STT or small local models in WebView can be experimented with web technologies. However, there are limitations to the iPhone's memory, heat, battery, background switching of apps, and model file size, and this is not a feature provided by Even. Since the G2 does not have speakers and the public SDK does not have an audio output API, answers must be displayed in writing on the glasses or use a separate output path on the phone.

### G2 Four microphones and sound source direction estimation

The G2 hardware has four microphones, but the official development documentation specifies the plug-in input as '4-mic array, single stream, 16 kHz PCM'. SDK events also provide only the following two values:

- `source`: `glasses` or `phone`
- `audioPcm`: 16 kHz signed 16-bit little-endian mono PCM one stream

Here, `source` is not a value that identifies microphones 1 to 4 of the G2. Indicates which input source is opened, G2 or iPhone. Metadata such as channels for each microphone, microphone placement coordinates, phase, time for each sample, and beamforming direction are not disclosed.

The task of determining the direction of sound using a microphone array is usually referred to as estimating the direction of arrival of the sound source, or DOA. Calculating TDOA or phase difference, which is the time difference of arrival between a pair of microphones, requires synchronized individual channels. This difference cannot be restored after the four channels are combined into one mono stream. Therefore, the Even Hub SDK currently cannot implement DOA, beamforming, or triangulation using four microphones directly.

In a small single array, even if there are sufficient channels, the direction angle is mainly estimated, and the problem of obtaining the distance to the sound source and 3D position at once is more difficult. Reflected sounds in the room, multiple sound sources, the angle of wearing glasses and the distance between microphones also increase errors.

Instead, you can create the following functions with a mono stream:

- Voice section detection
- Classification of keywords and sound events
- STT and real-time subtitles
- Detection of volume, peak and start points
- Pitch or approximate frequency analysis of music

Experimental workarounds include recording the G2 IMU values ​​along with mono volume or specific acoustic characteristics while the user slowly turns his or her head. Under the assumption that there is a single stationary sound source and sufficient compensation, it is a method of finding the direction of the head where the sound is relatively stronger. This is not an instantaneous direction estimation using the time difference of the four microphones, and should not be considered a precision function due to automatic gain adjustment, noise suppression, reflections, and IMU coordinate system uncertainty.

## R1 sensor and ring angle

The R1 hardware has an IMU used to calculate activity level and step count. PPG, blood oxygen, HRV and NTC temperature sensors are also used for product functionality. However, the presence of sensors in hardware does not mean that the raw sensors are exposed in the plugin API.

The following is currently confirmed about R1 in the public SDK.

- Tap, double tap, swipe up or down
- Distinguish R1 input source through `eventSource = 2`
- `DeviceModel.Ring1` model value

The following values ​​are not confirmed in the public API.

- Accelerometer or gyroscope raw values ​​of R1
- Absolute or relative angle of the ring
- quaternion, yaw, pitch, roll
-Finger posture or spatial location
- Heart rate, HRV, blood oxygen, body temperature, sleep and steps in R1

`imuControl()` and `IMU_DATA_REPORT` are described as the IMU of G2 glasses in the official SDK reference. Since there is no continuous rotation value attached to the R1 input event, it is not possible to estimate the ring angle just by pressing and swiping. Apps that use R1 angles or raw health data are currently outside the scope of the public plugin SDK.

## Functions available in iOS WebView

The Even Hub plugin is a plain HTML and TypeScript web page inside a Flutter WebView hosted by an Even Realities app. So you can use HTML, CSS, DOM and general JavaScript logic on the phone screen. However, not all Safari APIs are guaranteed to be the same in Even Hub. It varies depending on iOS version, WebView settings, security context, app permissions, and background switching method.

By current standards, it is safer to classify them as follows.

| Category | Features | Judgment |
| --- | --- | --- |
| Basic web features | HTML, CSS, DOM, ES Modules, Promises, Timers, JSON, URL, Canvas and SVG | Available in Phone WebView UI |
| network | `fetch`, `WebSocket` | Requires `network` permission, whitelist and server CORS |
| calculation | Web Worker, WebAssembly, Web Crypto | Can be used depending on iOS WebKit version, but requires detection of actual device function |
| browser storage | `localStorage`, IndexedDB, Cache API | Do not guarantee existence and retention period, but persistence settings take precedence over SDK repositories |
| media playback | `<audio>`, `<video>` | Only makes sense on phones and may be subject to autoplay and user gesture restrictions |
| Phone sensors and media inputs | Location, Camera, Album, G2 and Phone Microphone | Use Even Hub SDK and manifest permissions rather than plain browser API |
| background | Timers, audio, network, stateful | You should not assume that it continues to live like a regular web page, but rather use the SDK's state saving and restoration flow |
| conditional function | Service Worker, Push, Notifications, Clipboard, Share, File Download | Even though there is no table to guarantee compatibility, do not rely on core features and check actual device |
| Web hardware API not available | Web Bluetooth, WebUSB, WebSerial, WebHID, WebNFC | Not supported by iOS WebKit and cannot be used to connect directly to G2 or R1 |

The DOM and Canvas of the phone's WebView are not automatically mirrored on the G2. G2 output requires separate SDK text, list, and image containers. Even though the browser's `navigator.geolocation` or `getUserMedia()` exists in a specific iOS version, the path through which Even Hub officially connects permissions and lifecycle is the SDK's location, camera, album, and microphone APIs. Creating core functions through the SDK route is advantageous for portability and review response.

Service Workers and general browser repositories require special care. In WKWebView, Service Worker behavior may vary depending on the app-bound domain setting of the host app, whether it is HTTPS, and the iOS version. Even Hub also documents a separate way to snapshot and restore JSON state between a foreground WebView and a headless WebView. Therefore, rather than assuming that the Service Worker will continue to run your app, you should use `setBackgroundState()` and `onBackgroundRestore()` to restore the required state yourself.

At the beginning of your project, we recommend creating a feature detection screen like the following to save the results from local, private, and beta testing on a real iPhone.

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

Local QR tests often use HTTP addresses, so APIs that require a secure context may look different from packaged HTTPS or beta environments. Functional detection and actual device verification must be performed one more time in the final distribution form.

## Features not confirmed in public SDK

Currently, the official public SDK does not provide the following features:

- Bluetooth connection directly from the app to your G2 or R1
- G2's camera
- Speaker or audio output
- Even AI, LLM, STT and TTS calls
- R1 raw motion sensor
- R1 angle and posture
- R1 health and biometric information
- Four raw audio channels per G2 microphone
- Beamforming or sound source direction metadata of microphone array
- iPhone contacts
- iPhone Calendar
- iPhone notification history
- HealthKit
- Generic HTML and CSS rendering for glasses screens
- Random fonts and text alignment
- Background colors and general UI animations
- Color image

Although it is possible to display a bitmap through an image container, it is not an API that freely draws pixels on the glasses screen like a regular Canvas.

## Packaging and publishing

Once development is complete, build the app and package it as a `.ehpk` file.

```powershell
npm run build
npx evenhub pack app.json dist -o my-app.ehpk
```

The created file is uploaded to the Even Hub developer portal for review and posting procedures.

Some official support documents refer to upload files as `.ehp`, but the current public CLI and official templates use `.ehpk`. In actual uploads, priority should be given to the extensions required by the currently installed CLI and developer portal.

## Paid Sales Policy

### What is confirmed in the Terms and Conditions

The Even Hub Terms of Use, updated on 2026-03-24, state that users may use, license, subscribe to or download plugins. It states that the obligation to pay the usage fees for developer plug-ins lies between the user and the developer. The developer terms and conditions also stipulate that the developer's sales activities are carried out independently and that the developer bears risks and responsibilities.

To sum up, the paid license or subscription business itself is the form of use expected by the terms and conditions. However, this does not mean that payment buttons and settlement functions are already provided within Even Hub.

| Item | Status confirmed from public data |
| --- | --- |
| Paid usage or subscription concept | In Terms of Use |
| Even Hub's own payment SDK and checkout | Not confirmed |
| Price setting screen | Not confirmed |
| Even's Sales Commission and Revenue Share | Not confirmed |
| Payout cycle, minimum payout, supported currencies | Not confirmed |
| Refund, Cancellation, and Dispute Processing Procedures | Couldn't find detailed policy for developer plugin |
| Value added tax and tax treatment by country | There is no public settlement document and it appears to be the scope of developer liability |
| External accounts and self-subscriptions | The terms and conditions stipulate that third-party plugins can have separate account systems, but acceptable payment methods need to be confirmed separately |

Therefore, the most accurate expression at present is, “Paid sales are a possibility under the terms and conditions, but there is no open market payment and settlement system.” It is best to receive a written response from Even Realities prior to launch regarding whether external web payments, iOS in-app payments, invitation codes, or self-subscriptions will be accepted.

### Conditions you need to know when creating a paid app

- Developers are responsible for the functionality, security, availability, customer support, and their own terms and conditions of the plugin.
- If permission or personal information is used, the collection items, purpose and processing method must be specifically written in the personal information processing policy.
- Since `.ehpk` can be extracted, the API key, payment secret key, and license determination logic should not be included in the bundle. Paid permissions require a verification structure on the server.
- Posted plugins and Developer Content are granted to Even Realities a broad, non-exclusive, transferable, sublicensable, royalty-free, worldwide license to use them to operate, distribute, improve and promote the Platform. Although the developer's existing intellectual property rights themselves are not transferred, the scope of the contract needs to be reviewed before launch.
- Financial products and services, health and medical care, education and training, instant messaging, services aimed at children, and other apps deemed risky are currently excluded from publication.
- After release, the burden of security testing and support remains on the developer. The terms require published plugins to be security checked at least every six months.

It is a good idea to initially validate your product in a free or closed beta, and to document the following in your developer support channel before implementing payments:

1. Whether Korean developers can register paid plugins
2. Accepted payment providers and payment flows
3. Whether prices can be displayed within Even Hub
4. Responsibility for fees, refunds, value-added tax, receipts and settlement
5. How plugin usage rights are handled when canceling subscription and deleting account

## App review process and period

### Official Procedure

The app status in the developer portal progresses in the following order: `Draft`, `Test`, `Submitted`, and `Released`. Once submitted, it is automatically assigned to a reviewer. The reviewer performs manual QA, including installation and execution, and then approves or rejects. The main confirmation items are as follows.

- Manifest and version
- Icons, banners and screenshots
- Privacy policy explaining all permissions requested
- Initial execution and setup flow
- Network requests and CORS
- iPhone locked state and app life cycle
- Termination handling and user safety

`Released` builds cannot be modified and modifications require submitting a new build with a higher version. In other words, you should plan for updates to be reviewed again.

### Review period

As of 2026-07-25, there are no processing deadlines, service level commitments, or average or central review times in the official app submission documentation and developer terms. Even in public community posts, there are no examples of approval times that are reliable enough to calculate the average. In May 2026, a developer wrote that he had no idea how long it would take for an app to be approved after submitting it. At the time of the initial Hub release, there was a developer post saying that the fix was awaiting Even's review.

The official pilot program document's 'expected response within 10 business days' is the goal for early developer access applications. Since this is not the Publication Review period for the completed app, it should not be used as an app review estimate. The ‘within 48 hours’ case mentioned in the community is also a case of beta access approval, not app review.

It is better to set the current schedule conservatively as follows.

- We do not promise to complete screening on the public release date.
- Both the first submission and update are external dependencies with an indefinite period.
- Use local testing, closed testing, and beta distribution while awaiting public review.
- Beta operates under similar conditions to `Released`, so it first verifies iPhone lock status, running for more than 5 minutes, and network and shutdown flow.

## Korean community and developer activities

### Verification result

As of 2026-07-25, no Even Realities official Korean community, official Korean Discord, Naver Cafe, or Korean-only developer group has been found through public searches. It was not possible to fully check the inside of Naver Cafe due to search robot restrictions. There may also be private chat rooms or small gatherings that are not visible through public searches.

The official and representative global channels currently confirmed are as follows.

| Channel | Use | Korean only |
| --- | --- | --- |
| Official Even Realities Discord | Development questions, bug reports, feature opinions, exchanges between developers | Not |
| Community subreddit `r/EvenRealities` | Product and Even Hub usage experience, development discussion | Not |
| Even Realities GitHub | Official templates, SDK support materials, issues and open code | Not |

There are still few public traces in the Korean-speaking world.

- There are user reviews on the Korean App Store that describe their experience with Korean support for G2’s core features.
- Hyeong Jun Huh, an engineer who revealed that he lives in Korea, summarized the actual use of G2 and the WebView-based plugin structure in Korean on 2026-07-14.
- The Discord linked in this article is a general entrepreneur and developer community and is not a Korean community dedicated to Even Realities.
- I could not find any repositories or public plugins using the Even Hub SDK on this author's public GitHub. Therefore, it is confirmed that he is an engineer living in Korea who owns a G2, but there is insufficient evidence to conclude that he is a developer of the public Even Hub app.

We also sampled the top 100 searched `"Even G2"` repositories on GitHub and the public profile locations of the repository owners. Owners who identified themselves as `Korea`, `Seoul`, `Korea`, or `Republic of Korea` did not appear. Developers whose locations are not disclosed, organizational accounts, projects with private repositories and different search terms may be omitted, so this should not be interpreted as evidence that “there are no Korean developers.”

The current state can be summarized as follows.

- Interest from Korean users and developers is confirmed.
- Introductions to practical use and development structures in Korean have also begun to appear.
- The publicly verified dedicated community and the Korean Even Hub open source ecosystem are still very small.
- If you want to receive technical support right away, the fastest way is to use the official Discord developer channel and official GitHub.
- As the number of Korean users increases, it is realistic to request Korean threads or channels within the official Discord and collect data in a public GitHub organization or document repository.

## Currently confirmed public package

The version confirmed in npm registry on 2026-07-25 is as follows.

| package | Check version |
| --- | --- |
| `@evenrealities/even_hub_sdk` | `0.0.12` |
| `@evenrealities/evenhub-cli` | `0.1.13` |

Since the template may refer to a lower minimum version, the actual project must match the installed SDK version with `min_sdk_version` in `app.json`.

## Recommended first experiment

At first, it's a good idea to check the full path with a small app that only has the following features:

1. Display one line of text in G2 in the `minimal` template.
2. Change the display text by pressing R1.
3. Double-click to open the app termination confirmation window.
4. Check the screen and events in the simulator.
5. Scan the QR code on your iPhone on the same Wi-Fi.
6. Verify the input source and screen on the actual G2 and R1.

If this flow is successful, it is easier to isolate the problem by increasing the functionality in that order: microphone, location, network API, and image.

## Items requiring additional confirmation

- Actual payment flows and payment operators accepted by Even Hub
- Pricing, fees, refunds, taxes and settlement methods
- Whether Korean personal or business accounts can post paid posts
- Whether the battery status of R1 can be checked separately from G2
- Physical units, coordinate system and accuracy of IMU `x`, `y`, `z` guaranteed by the manufacturer
- Actual behavior of microphone and location update when switching background in iOS
- Official processing goals and actual approval period statistics for app review
- Emergence of an official or homegrown Korean Even Realities developer group
- Four microphone preprocessing, automatic gain adjustment and noise suppression method in G2 firmware
- WebView function detection results by iOS version and Even Realities app version

## Source

All links were verified on 2026-07-25.

- [Even Hub Developer Portal](https://hub.evenrealities.com/)
- [Even Hub Development Document Overview](https://hub.evenrealities.com/docs)
- [Even Hub Support Document](https://support.evenrealities.com/hc/en-us/articles/15688149217167-Even-Hub)
- [Even Hub Terms of Use](https://support.evenrealities.com/hc/en-us/articles/15606749676175-Even-Hub-Terms-of-Service)
- [Even Hub Developer Platform Terms](https://support.evenrealities.com/hc/en-us/articles/15606676690703-Even-Hub-Developer-Platform-Terms-of-Service)
- [Even Hub Developer Data Processing Agreement](https://support.evenrealities.com/hc/en-us/articles/15606721200911-Even-Hub-Developer-Platform-Data-Processing-Agreement)
- [App submission and review document](https://hub.evenrealities.com/docs/ship/app-submission)
- [Packaging Document](https://hub.evenrealities.com/docs/ship/packaging)
- [Test method overview](https://hub.evenrealities.com/docs/test)
- [Beta Test Document](https://hub.evenrealities.com/docs/test/beta-testing)
- [Even Hub Pilot Program](https://support.evenrealities.com/hc/en-us/articles/15016109505679-Even-Hub-Pilot-Program)
- [Official Device APIs Document](https://hub.evenrealities.com/docs/build/device-apis)
- [Introduction to G2 sensor design](https://www.evenrealities.com/zh-Hant-NO/blogs/even-insider/how-we-shaped-even-g2-from-the-outside-in)
- [Even Realities Official GitHub](https://github.com/even-realities)
- [Official Even Hub Starter Template](https://github.com/even-realities/evenhub-templates)
- [Official minimal template](https://github.com/even-realities/evenhub-templates/tree/main/minimal)
- [Official ASR template](https://github.com/even-realities/evenhub-templates/tree/main/asr)
- [STT connection description in the official ASR template](https://github.com/even-realities/evenhub-templates/blob/main/asr/README.md)
- [Everything EvenHub development materials](https://github.com/even-realities/everything-evenhub)
- [Full SDK method and event reference](https://github.com/even-realities/everything-evenhub/blob/main/plugins/everything-evenhub/skills/sdk-reference/SKILL.md)
- [WebView background state storage and restoration reference](https://github.com/even-realities/everything-evenhub/blob/main/plugins/everything-evenhub/skills/background-state/SKILL.md)
- [Device feature reference](https://github.com/even-realities/everything-evenhub/blob/main/plugins/everything-evenhub/skills/device-features/SKILL.md)
- [Input event reference](https://github.com/even-realities/everything-evenhub/blob/main/plugins/everything-evenhub/skills/handle-input/SKILL.md)
- [Packaging and permissions reference](https://github.com/even-realities/everything-evenhub/blob/main/plugins/everything-evenhub/skills/build-and-deploy/SKILL.md)
- [Simulator Reference](https://github.com/even-realities/everything-evenhub/blob/main/plugins/everything-evenhub/skills/test-with-simulator/SKILL.md)
- [Even Hub SDK npm package](https://www.npmjs.com/package/@evenrealities/even_hub_sdk)
- [Even Hub CLI npm package](https://www.npmjs.com/package/@evenrealities/evenhub-cli)
- [Even Hub Simulator npm package](https://www.npmjs.com/package/@evenrealities/evenhub-simulator)
- [Even R1 sensor specifications](https://support.evenrealities.com/hc/en-us/articles/13500531254159-Specs)
- [Even R1 operation and health data guide](https://support.evenrealities.com/hc/en-us/articles/13772400722063-How-to-Control)
- [List of hardware Web APIs not intentionally provided by WebKit](https://webkit.org/tracking-prevention/)
- [Study on sound source direction estimation using TDOA of microphone pair](https://pure.kaist.ac.kr/en/publications/microphone-pair-training-for-robust-sound-source-localization-wit/)
- [Public level app `level-even-g2`](https://github.com/nickustinov/level-even-g2)
- [Public posture notification app `even-g2-posture`](https://github.com/unicco/even-g2-posture)
- [Public head exercise app `eyefit-g2`](https://github.com/aleapc/eyefit-g2)
- [Public pickleball auxiliary app `pickleball-even-g2`](https://github.com/hitching/pickleball-even-g2)
- [Public IMU recording experiment `locate-sound`](https://github.com/KevinBalkoski/locate-sound/blob/main/src/spikes/imu-logger.ts)
- [Official Even Realities Discord Invitation](https://discord.gg/Y4jHMCU4sv)
- [Reddit `r/EvenRealities`](https://www.reddit.com/r/EvenRealities/)
- [Korean G2 actual use and development structure review](https://cse.ac/jun/even-g2-review/)
- [Even Realities app on the Korean App Store](https://apps.apple.com/kr/app/even-realities/id6747017725)
- [Public developer post mentioning that app review period is unknown](https://www.reddit.com/r/EvenRealities/comments/1t6epob/has_anyone_built_a_flight_tracker_for_the_even/)
