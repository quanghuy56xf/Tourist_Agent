import { en } from "./en";
import { fr } from "./fr";
import { ja } from "./ja";
import { ko } from "./ko";
import { vi } from "./vi";
import { zh } from "./zh";
import {
  BACKEND_LANGUAGE_BY_LOCALE,
  LOCALE_NATIVE_LABELS,
  VISITOR_LOCALES,
  type BackendLanguage,
  type DeepStringShape,
  type VisitorLocale,
  type VisitorTranslations,
} from "./types";

export const DEFAULT_LOCALE: VisitorLocale = "vi";
export const LOCALE_STORAGE_KEY = "hera_visitor_locale";

export function normalizeLocale(value: string | null): VisitorLocale {
  if (value && (VISITOR_LOCALES as readonly string[]).includes(value)) {
    return value as VisitorLocale;
  }
  return DEFAULT_LOCALE;
}

export function readStoredLocale(
  storage: Pick<Storage, "getItem">
): VisitorLocale {
  return normalizeLocale(storage.getItem(LOCALE_STORAGE_KEY));
}

export function writeStoredLocale(
  storage: Pick<Storage, "setItem">,
  locale: VisitorLocale
): void {
  storage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function backendLanguageForLocale(locale: VisitorLocale): BackendLanguage {
  return BACKEND_LANGUAGE_BY_LOCALE[locale];
}

export const translations: Record<VisitorLocale, VisitorTranslations> = {
  vi,
  en,
  fr,
  ja,
  ko,
  zh,
};

export {
  BACKEND_LANGUAGE_BY_LOCALE,
  LOCALE_NATIVE_LABELS,
  VISITOR_LOCALES,
  type BackendLanguage,
  type DeepStringShape,
  type VisitorLocale,
  type VisitorTranslations,
};
