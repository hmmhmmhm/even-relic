import type { enLocale } from "./locales/en";

type LocalizedShape<Value> =
  Value extends string
    ? string
    : Value extends readonly unknown[]
      ? { readonly [Index in keyof Value]: LocalizedShape<Value[Index]> }
      : Value extends object
        ? { readonly [Key in keyof Value]: LocalizedShape<Value[Key]> }
        : Value;

type TranslatedEnglishPack = LocalizedShape<typeof enLocale>;

export type LocalePack = Omit<
  TranslatedEnglishPack,
  "code" | "nativeName" | "browserTags"
> & {
  readonly code: string;
  readonly nativeName: string;
  readonly browserTags: readonly string[];
};
