import type { SupportedLocale } from "./i18n/locale-registry";

export type AiHudStrings = Readonly<{
  you: string;
  assistant: string;
  ready: string;
  connecting: string;
  listening: string;
  thinking: string;
  displaying: string;
  error: string;
  live: string;
  history: string;
  listeningPrompt: string;
  scrollTranscript: string;
  doubleTapBack: string;
}>;

export type AiHudStringKey = keyof AiHudStrings;

export const AI_HUD_TRANSLATIONS = {
  en: { you: "YOU", assistant: "AI", ready: "READY", connecting: "CONNECTING…", listening: "LISTENING…", thinking: "THINKING…", displaying: "DISPLAYING RESPONSE…", error: "ERROR", live: "LIVE", history: "HISTORY", listeningPrompt: "Listening… Speak naturally.", scrollTranscript: "SCROLL // TRANSCRIPT", doubleTapBack: "DOUBLE TAP // BACK" },
  ko: { you: "사용자", assistant: "AI", ready: "준비됨", connecting: "연결 중…", listening: "듣는 중…", thinking: "생각하는 중…", displaying: "답변 표시 중…", error: "오류", live: "실시간", history: "대화 기록", listeningPrompt: "듣고 있습니다… 자연스럽게 말씀하세요.", scrollTranscript: "스크롤 // 대화 기록", doubleTapBack: "두 번 탭 // 뒤로" },
  ja: { you: "あなた", assistant: "AI", ready: "準備完了", connecting: "接続中…", listening: "聞いています…", thinking: "考えています…", displaying: "回答を表示中…", error: "エラー", live: "ライブ", history: "履歴", listeningPrompt: "聞いています… 自然に話してください。", scrollTranscript: "スクロール // 会話履歴", doubleTapBack: "ダブルタップ // 戻る" },
  "zh-Hans": { you: "你", assistant: "AI", ready: "已就绪", connecting: "正在连接…", listening: "正在聆听…", thinking: "正在思考…", displaying: "正在显示回答…", error: "错误", live: "实时", history: "历史", listeningPrompt: "正在聆听… 请自然说话。", scrollTranscript: "滚动 // 对话记录", doubleTapBack: "双击 // 返回" },
  "zh-Hant": { you: "你", assistant: "AI", ready: "已就緒", connecting: "正在連線…", listening: "正在聆聽…", thinking: "正在思考…", displaying: "正在顯示回答…", error: "錯誤", live: "即時", history: "記錄", listeningPrompt: "正在聆聽… 請自然說話。", scrollTranscript: "捲動 // 對話記錄", doubleTapBack: "點兩下 // 返回" },
  es: { you: "TÚ", assistant: "IA", ready: "LISTO", connecting: "CONECTANDO…", listening: "ESCUCHANDO…", thinking: "PENSANDO…", displaying: "MOSTRANDO RESPUESTA…", error: "ERROR", live: "EN VIVO", history: "HISTORIAL", listeningPrompt: "Escuchando… Habla con naturalidad.", scrollTranscript: "DESLIZA // CONVERSACIÓN", doubleTapBack: "DOBLE TOQUE // VOLVER" },
  fr: { you: "VOUS", assistant: "IA", ready: "PRÊT", connecting: "CONNEXION…", listening: "ÉCOUTE…", thinking: "RÉFLEXION…", displaying: "AFFICHAGE DE LA RÉPONSE…", error: "ERREUR", live: "DIRECT", history: "HISTORIQUE", listeningPrompt: "J’écoute… Parlez naturellement.", scrollTranscript: "DÉFILER // CONVERSATION", doubleTapBack: "DOUBLE TAP // RETOUR" },
  de: { you: "DU", assistant: "KI", ready: "BEREIT", connecting: "VERBINDEN…", listening: "HÖRT ZU…", thinking: "DENKT NACH…", displaying: "ANTWORT WIRD ANGEZEIGT…", error: "FEHLER", live: "LIVE", history: "VERLAUF", listeningPrompt: "Ich höre zu… Sprich ganz natürlich.", scrollTranscript: "SCROLLEN // GESPRÄCH", doubleTapBack: "DOPPELTIPP // ZURÜCK" },
  it: { you: "TU", assistant: "IA", ready: "PRONTO", connecting: "CONNESSIONE…", listening: "IN ASCOLTO…", thinking: "ELABORAZIONE…", displaying: "RISPOSTA IN CORSO…", error: "ERRORE", live: "DAL VIVO", history: "CRONOLOGIA", listeningPrompt: "Ti ascolto… Parla naturalmente.", scrollTranscript: "SCORRI // CONVERSAZIONE", doubleTapBack: "DOPPIO TOCCO // INDIETRO" },
  pt: { you: "VOCÊ", assistant: "IA", ready: "PRONTO", connecting: "CONECTANDO…", listening: "OUVINDO…", thinking: "PENSANDO…", displaying: "EXIBINDO RESPOSTA…", error: "ERRO", live: "AO VIVO", history: "HISTÓRICO", listeningPrompt: "Ouvindo… Fale naturalmente.", scrollTranscript: "ROLAR // CONVERSA", doubleTapBack: "TOQUE DUPLO // VOLTAR" },
  nl: { you: "JIJ", assistant: "AI", ready: "GEREED", connecting: "VERBINDEN…", listening: "LUISTERT…", thinking: "DENKT NA…", displaying: "ANTWOORD WEERGEVEN…", error: "FOUT", live: "LIVE", history: "GESCHIEDENIS", listeningPrompt: "Ik luister… Spreek op natuurlijke wijze.", scrollTranscript: "SCROLL // GESPREK", doubleTapBack: "DUBBELTIK // TERUG" },
  pl: { you: "TY", assistant: "AI", ready: "GOTOWE", connecting: "ŁĄCZENIE…", listening: "SŁUCHAM…", thinking: "MYŚLĘ…", displaying: "WYŚWIETLANIE ODPOWIEDZI…", error: "BŁĄD", live: "NA ŻYWO", history: "HISTORIA", listeningPrompt: "Słucham… Mów naturalnie.", scrollTranscript: "PRZEWIŃ // ROZMOWA", doubleTapBack: "PODWÓJNE DOTKNIĘCIE // WSTECZ" },
  ru: { you: "ВЫ", assistant: "ИИ", ready: "ГОТОВО", connecting: "ПОДКЛЮЧЕНИЕ…", listening: "СЛУШАЮ…", thinking: "ДУМАЮ…", displaying: "ПОКАЗ ОТВЕТА…", error: "ОШИБКА", live: "СЕЙЧАС", history: "ИСТОРИЯ", listeningPrompt: "Слушаю… Говорите естественно.", scrollTranscript: "ПРОКРУТКА // ДИАЛОГ", doubleTapBack: "ДВОЙНОЕ КАСАНИЕ // НАЗАД" },
  uk: { you: "ВИ", assistant: "ШІ", ready: "ГОТОВО", connecting: "ПІДКЛЮЧЕННЯ…", listening: "СЛУХАЮ…", thinking: "ДУМАЮ…", displaying: "ПОКАЗ ВІДПОВІДІ…", error: "ПОМИЛКА", live: "НАЖИВО", history: "ІСТОРІЯ", listeningPrompt: "Слухаю… Говоріть природно.", scrollTranscript: "ПРОКРУТКА // РОЗМОВА", doubleTapBack: "ПОДВІЙНИЙ ДОТИК // НАЗАД" },
  tr: { you: "SEN", assistant: "AI", ready: "HAZIR", connecting: "BAĞLANIYOR…", listening: "DİNLİYOR…", thinking: "DÜŞÜNÜYOR…", displaying: "YANIT GÖSTERİLİYOR…", error: "HATA", live: "CANLI", history: "GEÇMİŞ", listeningPrompt: "Dinliyorum… Doğal biçimde konuşun.", scrollTranscript: "KAYDIR // KONUŞMA", doubleTapBack: "ÇİFT DOKUN // GERİ" },
  ar: { you: "أنت", assistant: "الذكاء", ready: "جاهز", connecting: "جارٍ الاتصال…", listening: "أستمع…", thinking: "أفكر…", displaying: "جارٍ عرض الرد…", error: "خطأ", live: "مباشر", history: "السجل", listeningPrompt: "أستمع… تحدث بصورة طبيعية.", scrollTranscript: "مرّر // المحادثة", doubleTapBack: "نقرتان // رجوع" },
  he: { you: "אתה", assistant: "AI", ready: "מוכן", connecting: "מתחבר…", listening: "מקשיב…", thinking: "חושב…", displaying: "מציג תשובה…", error: "שגיאה", live: "חי", history: "היסטוריה", listeningPrompt: "מקשיב… דברו בטבעיות.", scrollTranscript: "גלילה // שיחה", doubleTapBack: "הקשה כפולה // חזרה" },
  hi: { you: "आप", assistant: "AI", ready: "तैयार", connecting: "कनेक्ट हो रहा है…", listening: "सुन रहा है…", thinking: "सोच रहा है…", displaying: "उत्तर दिख रहा है…", error: "त्रुटि", live: "लाइव", history: "इतिहास", listeningPrompt: "सुन रहा हूँ… स्वाभाविक रूप से बोलें।", scrollTranscript: "स्क्रॉल // बातचीत", doubleTapBack: "दो बार टैप // वापस" },
  bn: { you: "আপনি", assistant: "AI", ready: "প্রস্তুত", connecting: "সংযোগ হচ্ছে…", listening: "শুনছি…", thinking: "ভাবছি…", displaying: "উত্তর দেখানো হচ্ছে…", error: "ত্রুটি", live: "লাইভ", history: "ইতিহাস", listeningPrompt: "শুনছি… স্বাভাবিকভাবে বলুন।", scrollTranscript: "স্ক্রল // কথোপকথন", doubleTapBack: "দুইবার ট্যাপ // ফিরে যান" },
  id: { you: "ANDA", assistant: "AI", ready: "SIAP", connecting: "MENGHUBUNGKAN…", listening: "MENDENGARKAN…", thinking: "BERPIKIR…", displaying: "MENAMPILKAN JAWABAN…", error: "GALAT", live: "LANGSUNG", history: "RIWAYAT", listeningPrompt: "Mendengarkan… Bicaralah dengan alami.", scrollTranscript: "GULIR // PERCAKAPAN", doubleTapBack: "KETUK DUA KALI // KEMBALI" },
  vi: { you: "BẠN", assistant: "AI", ready: "SẴN SÀNG", connecting: "ĐANG KẾT NỐI…", listening: "ĐANG NGHE…", thinking: "ĐANG SUY NGHĨ…", displaying: "ĐANG HIỂN THỊ TRẢ LỜI…", error: "LỖI", live: "TRỰC TIẾP", history: "LỊCH SỬ", listeningPrompt: "Đang nghe… Hãy nói tự nhiên.", scrollTranscript: "CUỘN // HỘI THOẠI", doubleTapBack: "CHẠM ĐÔI // QUAY LẠI" },
  th: { you: "คุณ", assistant: "AI", ready: "พร้อม", connecting: "กำลังเชื่อมต่อ…", listening: "กำลังฟัง…", thinking: "กำลังคิด…", displaying: "กำลังแสดงคำตอบ…", error: "ข้อผิดพลาด", live: "สด", history: "ประวัติ", listeningPrompt: "กำลังฟัง… พูดได้อย่างเป็นธรรมชาติ", scrollTranscript: "เลื่อน // บทสนทนา", doubleTapBack: "แตะสองครั้ง // กลับ" },
  ms: { you: "ANDA", assistant: "AI", ready: "SEDIA", connecting: "MENYAMBUNG…", listening: "MENDENGAR…", thinking: "BERFIKIR…", displaying: "MEMAPARKAN JAWAPAN…", error: "RALAT", live: "LANGSUNG", history: "SEJARAH", listeningPrompt: "Sedang mendengar… Bercakap secara semula jadi.", scrollTranscript: "TATAL // PERBUALAN", doubleTapBack: "KETIK DUA KALI // KEMBALI" },
  fil: { you: "IKAW", assistant: "AI", ready: "HANDA", connecting: "KUMOKONEKTA…", listening: "NAKIKINIG…", thinking: "NAG-IISIP…", displaying: "IPINAPAKITA ANG SAGOT…", error: "ERROR", live: "LIVE", history: "KASAYSAYAN", listeningPrompt: "Nakikinig… Magsalita nang natural.", scrollTranscript: "MAG-SCROLL // USAPAN", doubleTapBack: "DOBLENG TAP // BUMALIK" },
  sv: { you: "DU", assistant: "AI", ready: "REDO", connecting: "ANSLUTER…", listening: "LYSSNAR…", thinking: "TÄNKER…", displaying: "VISAR SVAR…", error: "FEL", live: "LIVE", history: "HISTORIK", listeningPrompt: "Jag lyssnar… Tala naturligt.", scrollTranscript: "RULLA // SAMTAL", doubleTapBack: "DUBBELTRYCK // TILLBAKA" },
  no: { you: "DU", assistant: "AI", ready: "KLAR", connecting: "KOBLER TIL…", listening: "LYTTER…", thinking: "TENKER…", displaying: "VISER SVAR…", error: "FEIL", live: "DIREKTE", history: "HISTORIKK", listeningPrompt: "Jeg lytter… Snakk naturlig.", scrollTranscript: "RULL // SAMTALE", doubleTapBack: "DOBBELTRYKK // TILBAKE" },
  da: { you: "DIG", assistant: "AI", ready: "KLAR", connecting: "FORBINDER…", listening: "LYTTER…", thinking: "TÆNKER…", displaying: "VISER SVAR…", error: "FEJL", live: "LIVE", history: "HISTORIK", listeningPrompt: "Jeg lytter… Tal naturligt.", scrollTranscript: "RUL // SAMTALE", doubleTapBack: "DOBBELTTRYK // TILBAGE" },
  fi: { you: "SINÄ", assistant: "AI", ready: "VALMIS", connecting: "YHDISTETÄÄN…", listening: "KUUNTELEE…", thinking: "AJATTELEE…", displaying: "NÄYTTÄÄ VASTAUSTA…", error: "VIRHE", live: "LIVE", history: "HISTORIA", listeningPrompt: "Kuuntelen… Puhu luonnollisesti.", scrollTranscript: "VIERITÄ // KESKUSTELU", doubleTapBack: "KAKSOISNAPAUTUS // TAKAISIN" },
  cs: { you: "VY", assistant: "AI", ready: "PŘIPRAVENO", connecting: "PŘIPOJOVÁNÍ…", listening: "POSLOUCHÁM…", thinking: "PŘEMÝŠLÍM…", displaying: "ZOBRAZUJI ODPOVĚĎ…", error: "CHYBA", live: "ŽIVĚ", history: "HISTORIE", listeningPrompt: "Poslouchám… Mluvte přirozeně.", scrollTranscript: "POSUN // KONVERZACE", doubleTapBack: "DVOJITÉ KLEPNUTÍ // ZPĚT" },
  ro: { you: "TU", assistant: "AI", ready: "PREGĂTIT", connecting: "CONECTARE…", listening: "ASCULT…", thinking: "GÂNDESC…", displaying: "AFIȘEZ RĂSPUNSUL…", error: "EROARE", live: "LIVE", history: "ISTORIC", listeningPrompt: "Ascult… Vorbiți natural.", scrollTranscript: "DERULARE // CONVERSAȚIE", doubleTapBack: "ATINGERE DUBLĂ // ÎNAPOI" },
} as const satisfies Readonly<Record<SupportedLocale, AiHudStrings>>;

export function translateAiHud(
  locale: SupportedLocale,
  key: AiHudStringKey,
): string {
  return AI_HUD_TRANSLATIONS[locale][key];
}

type AiApprovalStrings = Readonly<{
  title: string;
  approve: string;
  reject: string;
}>;

const AI_APPROVAL_TRANSLATIONS = {
  en: { title: "APPROVE MCP TOOL", approve: "TAP // APPROVE", reject: "DOUBLE TAP // REJECT AND EXIT" },
  ko: { title: "MCP 도구 승인", approve: "한 번 탭 // 승인", reject: "두 번 탭 // 거절하고 나가기" },
  ja: { title: "MCPツールを承認", approve: "タップ // 承認", reject: "ダブルタップ // 拒否して終了" },
  "zh-Hans": { title: "批准 MCP 工具", approve: "单击 // 批准", reject: "双击 // 拒绝并退出" },
  "zh-Hant": { title: "核准 MCP 工具", approve: "點一下 // 核准", reject: "點兩下 // 拒絕並離開" },
  es: { title: "APROBAR HERRAMIENTA MCP", approve: "TOQUE // APROBAR", reject: "DOBLE TOQUE // RECHAZAR Y SALIR" },
  fr: { title: "APPROUVER L’OUTIL MCP", approve: "TAP // APPROUVER", reject: "DOUBLE TAP // REFUSER ET QUITTER" },
  de: { title: "MCP-TOOL GENEHMIGEN", approve: "TIPP // GENEHMIGEN", reject: "DOPPELTIPP // ABLEHNEN UND BEENDEN" },
  it: { title: "APPROVA STRUMENTO MCP", approve: "TOCCO // APPROVA", reject: "DOPPIO TOCCO // RIFIUTA ED ESCI" },
  pt: { title: "APROVAR FERRAMENTA MCP", approve: "TOQUE // APROVAR", reject: "TOQUE DUPLO // RECUSAR E SAIR" },
  nl: { title: "MCP-TOOL GOEDKEUREN", approve: "TIK // GOEDKEUREN", reject: "DUBBELTIK // WEIGEREN EN SLUITEN" },
  pl: { title: "ZATWIERDŹ NARZĘDZIE MCP", approve: "DOTKNIJ // ZATWIERDŹ", reject: "PODWÓJNIE // ODRZUĆ I WYJDŹ" },
  ru: { title: "РАЗРЕШИТЬ ИНСТРУМЕНТ MCP", approve: "КАСАНИЕ // РАЗРЕШИТЬ", reject: "ДВОЙНОЕ // ОТКЛОНИТЬ И ВЫЙТИ" },
  uk: { title: "ДОЗВОЛИТИ ІНСТРУМЕНТ MCP", approve: "ДОТИК // ДОЗВОЛИТИ", reject: "ПОДВІЙНИЙ // ВІДХИЛИТИ Й ВИЙТИ" },
  tr: { title: "MCP ARACINI ONAYLA", approve: "DOKUN // ONAYLA", reject: "ÇİFT DOKUN // REDDET VE ÇIK" },
  ar: { title: "الموافقة على أداة MCP", approve: "نقرة // موافقة", reject: "نقرتان // رفض وخروج" },
  he: { title: "אישור כלי MCP", approve: "הקשה // אישור", reject: "הקשה כפולה // דחייה ויציאה" },
  hi: { title: "MCP टूल स्वीकृत करें", approve: "टैप // स्वीकृत", reject: "दो बार टैप // अस्वीकार और बाहर" },
  bn: { title: "MCP টুল অনুমোদন", approve: "ট্যাপ // অনুমোদন", reject: "দুইবার ট্যাপ // বাতিল ও প্রস্থান" },
  id: { title: "SETUJUI ALAT MCP", approve: "KETUK // SETUJUI", reject: "KETUK DUA KALI // TOLAK DAN KELUAR" },
  vi: { title: "PHÊ DUYỆT CÔNG CỤ MCP", approve: "CHẠM // PHÊ DUYỆT", reject: "CHẠM ĐÔI // TỪ CHỐI VÀ THOÁT" },
  th: { title: "อนุมัติเครื่องมือ MCP", approve: "แตะ // อนุมัติ", reject: "แตะสองครั้ง // ปฏิเสธและออก" },
  ms: { title: "LULUSKAN ALAT MCP", approve: "KETIK // LULUSKAN", reject: "KETIK DUA KALI // TOLAK DAN KELUAR" },
  fil: { title: "APRUBAHAN ANG MCP TOOL", approve: "TAP // APRUBAHAN", reject: "DOBLENG TAP // TANGGIHAN AT LUMABAS" },
  sv: { title: "GODKÄNN MCP-VERKTYG", approve: "TRYCK // GODKÄNN", reject: "DUBBELTRYCK // NEKA OCH AVSLUTA" },
  no: { title: "GODKJENN MCP-VERKTØY", approve: "TRYKK // GODKJENN", reject: "DOBBELTRYKK // AVVIS OG AVSLUTT" },
  da: { title: "GODKEND MCP-VÆRKTØJ", approve: "TRYK // GODKEND", reject: "DOBBELTTRYK // AFVIS OG AFSLUT" },
  fi: { title: "HYVÄKSY MCP-TYÖKALU", approve: "NAPAUTA // HYVÄKSY", reject: "KAKSOISNAPAUTUS // HYLKÄÄ JA POISTU" },
  cs: { title: "SCHVÁLIT NÁSTROJ MCP", approve: "KLEPNOUT // SCHVÁLIT", reject: "DVOJITĚ // ODMÍTNOUT A ODEJÍT" },
  ro: { title: "APROBĂ INSTRUMENTUL MCP", approve: "ATINGE // APROBĂ", reject: "ATINGE DUBLU // REFUZĂ ȘI IEȘI" },
} as const satisfies Readonly<Record<SupportedLocale, AiApprovalStrings>>;

export function translateAiApproval(locale: SupportedLocale): AiApprovalStrings {
  return AI_APPROVAL_TRANSLATIONS[locale];
}

export function localizeAiTranscriptLines(
  lines: readonly string[],
  locale: SupportedLocale,
): readonly string[] {
  const strings = AI_HUD_TRANSLATIONS[locale];
  return lines.map((line) => {
    if (line.startsWith("YOU // ")) {
      return `${strings.you} // ${line.slice("YOU // ".length)}`;
    }
    if (line.startsWith("AI // ")) {
      return `${strings.assistant} // ${line.slice("AI // ".length)}`;
    }
    return line;
  });
}
