const GOOGLE_TOPICS = Object.freeze([
  ["top", "rss"],
  ["world", "rss/headlines/section/topic/WORLD"],
  ["technology", "rss/headlines/section/topic/TECHNOLOGY"],
]);

const GOOGLE_EDITIONS = Object.freeze([
  ["ja", "ja", "JP", "JP:ja", ["トップニュース", "国際", "テクノロジー"]],
  ["zh-Hans", "zh-CN", "CN", "CN:zh-Hans", ["头条新闻", "国际", "科技"]],
  ["zh-Hant", "zh-TW", "TW", "TW:zh-Hant", ["焦點新聞", "國際", "科技"]],
  ["es", "es", "ES", "ES:es", ["Noticias destacadas", "Mundo", "Tecnología"]],
  ["fr", "fr", "FR", "FR:fr", ["À la une", "Monde", "Technologie"]],
  ["de", "de", "DE", "DE:de", ["Top-Nachrichten", "Welt", "Technologie"]],
  ["it", "it", "IT", "IT:it", ["Notizie principali", "Mondo", "Tecnologia"]],
  ["pt", "pt-BR", "BR", "BR:pt-419", ["Principais notícias", "Mundo", "Tecnologia"]],
  ["nl", "nl", "NL", "NL:nl", ["Topnieuws", "Wereld", "Technologie"]],
  ["pl", "pl", "PL", "PL:pl", ["Najważniejsze wiadomości", "Świat", "Technologia"]],
  ["ru", "ru", "RU", "RU:ru", ["Главные новости", "Мир", "Технологии"]],
  ["uk", "uk", "UA", "UA:uk", ["Головні новини", "Світ", "Технології"]],
  ["tr", "tr", "TR", "TR:tr", ["Öne çıkan haberler", "Dünya", "Teknoloji"]],
  ["ar", "ar", "SA", "SA:ar", ["أهم الأخبار", "العالم", "التكنولوجيا"]],
  ["he", "he", "IL", "IL:he", ["חדשות מובילות", "עולם", "טכנולוגיה"]],
  ["hi", "hi", "IN", "IN:hi", ["मुख्य समाचार", "विश्व", "प्रौद्योगिकी"]],
  ["bn", "bn", "BD", "BD:bn", ["শীর্ষ সংবাদ", "বিশ্ব", "প্রযুক্তি"]],
  ["id", "id", "ID", "ID:id", ["Berita utama", "Dunia", "Teknologi"]],
  ["vi", "vi", "VN", "VN:vi", ["Tin nổi bật", "Thế giới", "Công nghệ"]],
  ["th", "th", "TH", "TH:th", ["ข่าวเด่น", "โลก", "เทคโนโลยี"]],
  ["ms", "ms-MY", "MY", "MY:ms", ["Berita utama", "Dunia", "Teknologi"]],
  ["sv", "sv", "SE", "SE:sv", ["Toppnyheter", "Världen", "Teknik"]],
  ["no", "no", "NO", "NO:no", ["Toppnyheter", "Verden", "Teknologi"]],
  ["fi", "fi-FI", "FI", "FI:fi", ["Pääuutiset", "Maailma", "Teknologia"]],
  ["cs", "cs", "CZ", "CZ:cs", ["Hlavní zprávy", "Svět", "Technologie"]],
  ["ro", "ro", "RO", "RO:ro", ["Știri principale", "Lume", "Tehnologie"]],
]);

function googleNewsFeeds([locale, hl, gl, ceid, names]) {
  const query = new URLSearchParams({ hl, gl, ceid }).toString();
  const slug = locale.toLowerCase();
  return GOOGLE_TOPICS.map(([topic, path], index) => ({
    id: `${slug}-google-${topic}`,
    name: names[index],
    url: `https://news.google.com/${path}?${query}`,
    locale,
  }));
}

const GOOGLE_FEEDS_BY_LOCALE = new Map(
  GOOGLE_EDITIONS.map((edition) => [edition[0], googleNewsFeeds(edition)]),
);

const FIXED_FEEDS_BY_LOCALE = new Map([
  ["ko", [
    {
      id: "sbs-latest",
      name: "SBS 최신뉴스",
      url: "https://news.sbs.co.kr/news/newsflashRssFeed.do?plink=RSSREADER",
      locale: "ko",
    },
    {
      id: "newsis-breaking",
      name: "뉴시스 속보",
      url: "https://www.newsis.com/RSS/sokbo.xml",
      locale: "ko",
    },
    {
      id: "weekly-khan-latest",
      name: "주간경향 최신기사",
      url: "https://weekly.khan.co.kr/rss/rssdata/total_news.xml",
      locale: "ko",
    },
  ]],
  ["en", [
    {
      id: "bbc-world",
      name: "BBC World",
      url: "https://feeds.bbci.co.uk/news/world/rss.xml",
      locale: "en",
    },
    {
      id: "guardian-world",
      name: "The Guardian World",
      url: "https://www.theguardian.com/world/rss",
      locale: "en",
    },
    {
      id: "lemonde-international",
      name: "Le Monde International",
      url: "https://www.lemonde.fr/en/international/rss_full.xml",
      locale: "en",
    },
  ]],
  ["fil", [
    {
      id: "gma-nation",
      name: "GMA Nation",
      url: "https://data.gmanetwork.com/gno/rss/news/nation/feed.xml",
      locale: "fil",
    },
    {
      id: "philstar-headlines",
      name: "Philstar Headlines",
      url: "https://www.philstar.com/rss/headlines",
      locale: "fil",
    },
    {
      id: "rappler-latest",
      name: "Rappler Latest",
      url: "https://www.rappler.com/feed/",
      locale: "fil",
    },
  ]],
  ["da", [
    {
      id: "dr-all",
      name: "DR Nyheder",
      url: "https://www.dr.dk/nyheder/service/feeds/allenyheder",
      locale: "da",
    },
    {
      id: "dr-denmark",
      name: "DR Indland",
      url: "https://www.dr.dk/nyheder/service/feeds/indland",
      locale: "da",
    },
    {
      id: "dr-world",
      name: "DR Udland",
      url: "https://www.dr.dk/nyheder/service/feeds/udland",
      locale: "da",
    },
  ]],
]);

export const BUILT_IN_RSS_FEEDS = Object.freeze(
  [
    ...FIXED_FEEDS_BY_LOCALE.values(),
    ...GOOGLE_FEEDS_BY_LOCALE.values(),
  ].flat().map((feed) => Object.freeze(feed)),
);
