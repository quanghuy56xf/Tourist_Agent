import type { vi } from "./vi";

export type VisitorLocale = "vi" | "en" | "fr" | "ja" | "ko" | "zh";

export const VISITOR_LOCALES: VisitorLocale[] = ["vi", "en", "fr", "ja", "ko", "zh"];

export const LOCALE_NATIVE_LABELS: Record<VisitorLocale, string> = {
  vi: "Tiếng Việt",
  en: "English",
  fr: "Français",
  ja: "日本語",
  ko: "한국어",
  zh: "中文",
};

export type BackendLanguage =
  | "Tiếng Việt"
  | "Tiếng Anh"
  | "Tiếng Pháp"
  | "Tiếng Nhật"
  | "Tiếng Hàn"
  | "Tiếng Trung";

export const BACKEND_LANGUAGE_BY_LOCALE: Record<VisitorLocale, BackendLanguage> = {
  vi: "Tiếng Việt",
  en: "Tiếng Anh",
  fr: "Tiếng Pháp",
  ja: "Tiếng Nhật",
  ko: "Tiếng Hàn",
  zh: "Tiếng Trung",
};

export type DeepStringShape<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringShape<T[K]>;
};

export type VisitorTranslations = DeepStringShape<typeof vi>;
