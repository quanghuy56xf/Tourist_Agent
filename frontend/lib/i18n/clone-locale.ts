import type { VisitorTranslations } from "./types";

export function cloneLocale(source: VisitorTranslations): VisitorTranslations {
  return JSON.parse(JSON.stringify(source)) as VisitorTranslations;
}
