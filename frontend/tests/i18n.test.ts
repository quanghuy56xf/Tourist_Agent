import assert from "node:assert/strict";
import test from "node:test";

import {
  backendLanguageForLocale,
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  normalizeLocale,
  readStoredLocale,
  writeStoredLocale,
} from "../lib/i18n";

test("normalizeLocale chỉ chấp nhận vi hoặc en", () => {
  assert.equal(normalizeLocale("vi"), "vi");
  assert.equal(normalizeLocale("en"), "en");
  assert.equal(normalizeLocale("fr"), DEFAULT_LOCALE);
  assert.equal(normalizeLocale(null), DEFAULT_LOCALE);
});

test("đọc và ghi locale dùng đúng storage key", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };

  writeStoredLocale(storage, "en");

  assert.equal(values.get(LOCALE_STORAGE_KEY), "en");
  assert.equal(readStoredLocale(storage), "en");
});

test("ánh xạ locale sang ngôn ngữ backend", () => {
  assert.equal(backendLanguageForLocale("vi"), "Tiếng Việt");
  assert.equal(backendLanguageForLocale("en"), "Tiếng Anh");
});
