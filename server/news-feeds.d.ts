export type BuiltInRssFeedDefinition = {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly locale: string;
  readonly fallbackLocale?: "en";
};

export const BUILT_IN_RSS_FEEDS:
  readonly BuiltInRssFeedDefinition[];
