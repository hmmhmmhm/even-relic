import type { SupportedLocale } from "./i18n/locale-registry";

export type AiPhoneStringKey =
  | "ai"
  | "openAiKey"
  | "estimatedCost"
  | "thisWeek"
  | "thisMonth"
  | "recentConversations"
  | "noConversations"
  | "clearAiData"
  | "aiKeyRequired";

type AiStrings = Readonly<Record<AiPhoneStringKey, string>>;
const english: AiStrings = {
  ai: "Ask AI",
  openAiKey: "OpenAI API key",
  estimatedCost: "Estimated AI cost",
  thisWeek: "This week",
  thisMonth: "This month",
  recentConversations: "Recent conversations",
  noConversations: "No conversations yet",
  clearAiData: "Clear AI history and usage",
  aiKeyRequired: "OpenAI key required",
};

const localized: Partial<Record<SupportedLocale, Partial<AiStrings>>> = {
  ar: {
    ai: "اسأل الذكاء الاصطناعي", openAiKey: "مفتاح OpenAI API",
    estimatedCost: "تكلفة الوقت الفعلي المقدرة", thisWeek: "هذا الأسبوع",
    thisMonth: "هذا الشهر", recentConversations: "المحادثات الأخيرة",
    noConversations: "لا توجد محادثات بعد", clearAiData: "مسح سجل وبيانات الذكاء الاصطناعي",
    aiKeyRequired: "مفتاح OpenAI مطلوب",
  },
  bn: {
    ai: "AI-কে জিজ্ঞাসা করুন", openAiKey: "OpenAI API কী",
    estimatedCost: "আনুমানিক রিয়েলটাইম খরচ", thisWeek: "এই সপ্তাহ",
    thisMonth: "এই মাস", recentConversations: "সাম্প্রতিক কথোপকথন",
    noConversations: "এখনও কোনো কথোপকথন নেই", clearAiData: "AI ইতিহাস ও ব্যবহার মুছুন",
    aiKeyRequired: "OpenAI কী প্রয়োজন",
  },
  cs: { ai: "Zeptat se AI", openAiKey: "Klíč OpenAI API", estimatedCost: "Odhadované náklady Realtime", thisWeek: "Tento týden", thisMonth: "Tento měsíc", recentConversations: "Nedávné konverzace", noConversations: "Zatím žádné konverzace", clearAiData: "Vymazat historii a využití AI", aiKeyRequired: "Je vyžadován klíč OpenAI" },
  da: { ai: "Spørg AI", openAiKey: "OpenAI API-nøgle", estimatedCost: "Anslået Realtime-pris", thisWeek: "Denne uge", thisMonth: "Denne måned", recentConversations: "Seneste samtaler", noConversations: "Ingen samtaler endnu", clearAiData: "Ryd AI-historik og forbrug", aiKeyRequired: "OpenAI-nøgle påkrævet" },
  de: { ai: "AI fragen", openAiKey: "OpenAI-API-Schlüssel", estimatedCost: "Geschätzte Realtime-Kosten", thisWeek: "Diese Woche", thisMonth: "Dieser Monat", recentConversations: "Letzte Gespräche", noConversations: "Noch keine Gespräche", clearAiData: "AI-Verlauf und Nutzung löschen", aiKeyRequired: "OpenAI-Schlüssel erforderlich" },
  es: { ai: "Preguntar a la IA", openAiKey: "Clave de API de OpenAI", estimatedCost: "Coste Realtime estimado", thisWeek: "Esta semana", thisMonth: "Este mes", recentConversations: "Conversaciones recientes", noConversations: "Aún no hay conversaciones", clearAiData: "Borrar historial y uso de IA", aiKeyRequired: "Se requiere una clave de OpenAI" },
  fi: { ai: "Kysy tekoälyltä", openAiKey: "OpenAI API -avain", estimatedCost: "Arvioitu Realtime-hinta", thisWeek: "Tämä viikko", thisMonth: "Tämä kuukausi", recentConversations: "Viimeisimmät keskustelut", noConversations: "Ei keskusteluja vielä", clearAiData: "Tyhjennä AI-historia ja käyttö", aiKeyRequired: "OpenAI-avain vaaditaan" },
  fil: { ai: "Magtanong sa AI", openAiKey: "OpenAI API key", estimatedCost: "Tinatayang gastos sa Realtime", thisWeek: "Ngayong linggo", thisMonth: "Ngayong buwan", recentConversations: "Mga kamakailang usapan", noConversations: "Wala pang usapan", clearAiData: "Burahin ang history at paggamit ng AI", aiKeyRequired: "Kailangan ang OpenAI key" },
  fr: { ai: "Demander à l’IA", openAiKey: "Clé API OpenAI", estimatedCost: "Coût Realtime estimé", thisWeek: "Cette semaine", thisMonth: "Ce mois-ci", recentConversations: "Conversations récentes", noConversations: "Aucune conversation", clearAiData: "Effacer l’historique et l’utilisation IA", aiKeyRequired: "Clé OpenAI requise" },
  he: { ai: "שאל את ה-AI", openAiKey: "מפתח OpenAI API", estimatedCost: "עלות Realtime משוערת", thisWeek: "השבוע", thisMonth: "החודש", recentConversations: "שיחות אחרונות", noConversations: "אין עדיין שיחות", clearAiData: "ניקוי היסטוריה ושימוש ב-AI", aiKeyRequired: "נדרש מפתח OpenAI" },
  hi: { ai: "AI से पूछें", openAiKey: "OpenAI API कुंजी", estimatedCost: "अनुमानित Realtime लागत", thisWeek: "इस सप्ताह", thisMonth: "इस महीने", recentConversations: "हाल की बातचीत", noConversations: "अभी कोई बातचीत नहीं", clearAiData: "AI इतिहास और उपयोग मिटाएँ", aiKeyRequired: "OpenAI कुंजी आवश्यक है" },
  id: { ai: "Tanya AI", openAiKey: "Kunci API OpenAI", estimatedCost: "Perkiraan biaya Realtime", thisWeek: "Minggu ini", thisMonth: "Bulan ini", recentConversations: "Percakapan terbaru", noConversations: "Belum ada percakapan", clearAiData: "Hapus riwayat dan penggunaan AI", aiKeyRequired: "Kunci OpenAI diperlukan" },
  it: { ai: "Chiedi all’AI", openAiKey: "Chiave API OpenAI", estimatedCost: "Costo Realtime stimato", thisWeek: "Questa settimana", thisMonth: "Questo mese", recentConversations: "Conversazioni recenti", noConversations: "Nessuna conversazione", clearAiData: "Cancella cronologia e utilizzo AI", aiKeyRequired: "Chiave OpenAI richiesta" },
  ja: { ai: "AIに質問", openAiKey: "OpenAI APIキー", estimatedCost: "推定Realtime料金", thisWeek: "今週", thisMonth: "今月", recentConversations: "最近の会話", noConversations: "会話はまだありません", clearAiData: "AI履歴と使用量を消去", aiKeyRequired: "OpenAIキーが必要です" },
  ko: { ai: "AI에게 묻기", openAiKey: "OpenAI API 키", estimatedCost: "예상 Realtime 비용", thisWeek: "이번 주", thisMonth: "이번 달", recentConversations: "최근 대화", noConversations: "아직 대화가 없습니다", clearAiData: "AI 기록 및 사용량 지우기", aiKeyRequired: "OpenAI 키 필요" },
  ms: { ai: "Tanya AI", openAiKey: "Kunci API OpenAI", estimatedCost: "Anggaran kos Realtime", thisWeek: "Minggu ini", thisMonth: "Bulan ini", recentConversations: "Perbualan terkini", noConversations: "Belum ada perbualan", clearAiData: "Kosongkan sejarah dan penggunaan AI", aiKeyRequired: "Kunci OpenAI diperlukan" },
  nl: { ai: "Vraag AI", openAiKey: "OpenAI API-sleutel", estimatedCost: "Geschatte Realtime-kosten", thisWeek: "Deze week", thisMonth: "Deze maand", recentConversations: "Recente gesprekken", noConversations: "Nog geen gesprekken", clearAiData: "AI-geschiedenis en gebruik wissen", aiKeyRequired: "OpenAI-sleutel vereist" },
  no: { ai: "Spør AI", openAiKey: "OpenAI API-nøkkel", estimatedCost: "Anslått Realtime-kostnad", thisWeek: "Denne uken", thisMonth: "Denne måneden", recentConversations: "Nylige samtaler", noConversations: "Ingen samtaler ennå", clearAiData: "Tøm AI-historikk og bruk", aiKeyRequired: "OpenAI-nøkkel kreves" },
  pl: { ai: "Zapytaj AI", openAiKey: "Klucz API OpenAI", estimatedCost: "Szacowany koszt Realtime", thisWeek: "Ten tydzień", thisMonth: "Ten miesiąc", recentConversations: "Ostatnie rozmowy", noConversations: "Brak rozmów", clearAiData: "Wyczyść historię i użycie AI", aiKeyRequired: "Wymagany klucz OpenAI" },
  pt: { ai: "Perguntar à IA", openAiKey: "Chave da API OpenAI", estimatedCost: "Custo Realtime estimado", thisWeek: "Esta semana", thisMonth: "Este mês", recentConversations: "Conversas recentes", noConversations: "Ainda sem conversas", clearAiData: "Limpar histórico e uso de IA", aiKeyRequired: "Chave OpenAI necessária" },
  ro: { ai: "Întreabă AI", openAiKey: "Cheie API OpenAI", estimatedCost: "Cost Realtime estimat", thisWeek: "Săptămâna aceasta", thisMonth: "Luna aceasta", recentConversations: "Conversații recente", noConversations: "Nicio conversație", clearAiData: "Șterge istoricul și utilizarea AI", aiKeyRequired: "Este necesară cheia OpenAI" },
  ru: { ai: "Спросить ИИ", openAiKey: "Ключ OpenAI API", estimatedCost: "Расчётная стоимость Realtime", thisWeek: "На этой неделе", thisMonth: "В этом месяце", recentConversations: "Недавние разговоры", noConversations: "Разговоров пока нет", clearAiData: "Очистить историю и расход ИИ", aiKeyRequired: "Требуется ключ OpenAI" },
  sv: { ai: "Fråga AI", openAiKey: "OpenAI API-nyckel", estimatedCost: "Uppskattad Realtime-kostnad", thisWeek: "Denna vecka", thisMonth: "Denna månad", recentConversations: "Senaste samtal", noConversations: "Inga samtal ännu", clearAiData: "Rensa AI-historik och användning", aiKeyRequired: "OpenAI-nyckel krävs" },
  th: { ai: "ถาม AI", openAiKey: "คีย์ OpenAI API", estimatedCost: "ค่า Realtime โดยประมาณ", thisWeek: "สัปดาห์นี้", thisMonth: "เดือนนี้", recentConversations: "การสนทนาล่าสุด", noConversations: "ยังไม่มีการสนทนา", clearAiData: "ล้างประวัติและการใช้ AI", aiKeyRequired: "ต้องใช้คีย์ OpenAI" },
  tr: { ai: "AI'ya sor", openAiKey: "OpenAI API anahtarı", estimatedCost: "Tahmini Realtime maliyeti", thisWeek: "Bu hafta", thisMonth: "Bu ay", recentConversations: "Son konuşmalar", noConversations: "Henüz konuşma yok", clearAiData: "AI geçmişini ve kullanımı temizle", aiKeyRequired: "OpenAI anahtarı gerekli" },
  uk: { ai: "Запитати ШІ", openAiKey: "Ключ OpenAI API", estimatedCost: "Орієнтовна вартість Realtime", thisWeek: "Цього тижня", thisMonth: "Цього місяця", recentConversations: "Останні розмови", noConversations: "Розмов ще немає", clearAiData: "Очистити історію та використання ШІ", aiKeyRequired: "Потрібен ключ OpenAI" },
  vi: { ai: "Hỏi AI", openAiKey: "Khóa API OpenAI", estimatedCost: "Chi phí Realtime ước tính", thisWeek: "Tuần này", thisMonth: "Tháng này", recentConversations: "Cuộc trò chuyện gần đây", noConversations: "Chưa có cuộc trò chuyện", clearAiData: "Xóa lịch sử và mức dùng AI", aiKeyRequired: "Cần khóa OpenAI" },
  "zh-Hans": { ai: "询问 AI", openAiKey: "OpenAI API 密钥", estimatedCost: "预计 Realtime 费用", thisWeek: "本周", thisMonth: "本月", recentConversations: "最近对话", noConversations: "暂无对话", clearAiData: "清除 AI 历史和用量", aiKeyRequired: "需要 OpenAI 密钥" },
  "zh-Hant": { ai: "詢問 AI", openAiKey: "OpenAI API 金鑰", estimatedCost: "預估 Realtime 費用", thisWeek: "本週", thisMonth: "本月", recentConversations: "最近對話", noConversations: "尚無對話", clearAiData: "清除 AI 歷史與用量", aiKeyRequired: "需要 OpenAI 金鑰" },
};

export function translateAiPhone(
  locale: SupportedLocale,
  key: AiPhoneStringKey,
): string {
  return localized[locale]?.[key] ?? english[key];
}
