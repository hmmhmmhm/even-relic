export type BuiltInRssFeedDefinition = {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly locale: string;
};

export const BUILT_IN_RSS_FEEDS:
  readonly BuiltInRssFeedDefinition[];
