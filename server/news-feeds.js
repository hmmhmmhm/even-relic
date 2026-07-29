export const BUILT_IN_RSS_FEEDS = Object.freeze([
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
].map((feed) => Object.freeze(feed)));
