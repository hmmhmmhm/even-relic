import type { PhoneLocale } from "./phone-types";

const HUD_STRINGS = {
  en: {
    feels: "FEELS",
    feelsLike: "FEELS LIKE",
    humidity: "HUMIDITY",
    rain: "RAIN",
    precipitation: "PRECIPITATION",
    wind: "WIND",
    weatherLoading: "Loading weather",
    weatherUnavailable: "Weather unavailable",
    weatherWaiting: "Waiting for local weather data.",
    weatherRetry: "Will retry current weather when connected.",
    walking: "Walking",
    cycling: "Cycling",
    driving: "Driving",
    routingKeyRequired: "Routing key required",
    routingConnect: "Connect ORS to continue",
    routingConfigure: "Configure key on phone",
    routingCalculating: "Calculating route",
    routingPreparing: "Preparing route to destination",
    routingWait: "Please wait",
    destinationSelect: "Select a destination",
    destinationSearch: "Search on phone",
    routingModes: "Walk · Cycle · Drive",
    routingCheck: "Check route",
    arrived: "Destination reached",
    done: "DONE",
    publishedUnknown: "PUBLISHED // UNKNOWN",
    noSummary: "No summary",
    newsLoading: "Loading news",
    newsUnavailable: "News unavailable",
    newsWaiting: "Waiting for RSS updates.",
    retryConnected: "Will retry automatically when connected.",
    todoLoading: "Loading TODOs",
    todoUnavailable: "TODOs unavailable",
    todoChecking: "Checking the saved checklist.",
  },
  ko: {
    feels: "체감",
    feelsLike: "체감온도",
    humidity: "습도",
    rain: "강수",
    precipitation: "강수확률",
    wind: "바람",
    weatherLoading: "날씨 불러오는 중",
    weatherUnavailable: "날씨를 표시할 수 없음",
    weatherWaiting: "현재 위치의 날씨 데이터를 기다리고 있습니다.",
    weatherRetry: "연결되면 현재 날씨를 자동으로 다시 확인합니다.",
    walking: "도보",
    cycling: "자전거",
    driving: "자동차",
    routingKeyRequired: "길찾기 키 필요",
    routingConnect: "ORS 연결 후 사용",
    routingConfigure: "폰에서 ORS 키를 설정하세요",
    routingCalculating: "경로 계산 중",
    routingPreparing: "목적지까지의 경로를 준비하고 있습니다.",
    routingWait: "잠시만 기다려주세요",
    destinationSelect: "목적지를 선택하세요",
    destinationSearch: "폰 화면에서 검색",
    routingModes: "도보 · 자전거 · 자동차",
    routingCheck: "경로 확인 필요",
    arrived: "목적지 도착",
    done: "완료",
    publishedUnknown: "발행 시각 미상",
    noSummary: "요약 없음",
    newsLoading: "뉴스 불러오는 중",
    newsUnavailable: "뉴스를 표시할 수 없음",
    newsWaiting: "RSS 업데이트를 기다리고 있습니다.",
    retryConnected: "연결 후 자동으로 다시 시도합니다.",
    todoLoading: "할 일 불러오는 중",
    todoUnavailable: "할 일을 표시할 수 없음",
    todoChecking: "저장된 체크리스트를 확인하고 있습니다.",
  },
} as const;

export type HudStringKey = keyof typeof HUD_STRINGS.en;

export function translateHud(
  locale: PhoneLocale,
  key: HudStringKey,
): string {
  return HUD_STRINGS[locale][key];
}

const WEEKDAYS = {
  en: [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ],
  ko: [
    "일요일",
    "월요일",
    "화요일",
    "수요일",
    "목요일",
    "금요일",
    "토요일",
  ],
} as const;

export function hudWeekday(locale: PhoneLocale, day: number): string {
  return WEEKDAYS[locale][day] ?? "";
}
