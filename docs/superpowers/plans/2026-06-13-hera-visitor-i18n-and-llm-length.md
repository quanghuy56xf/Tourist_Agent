# HERA Visitor I18n and LLM Length Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent Vietnamese/English selector to the HERA visitor flow and guarantee that generated introductions and chat responses contain no more than 300 words.

**Architecture:** Add a typed, dependency-free visitor localization layer in the Next.js frontend, backed by a client context and `localStorage`. Keep `/admin/*` unchanged. Add a shared backend word limiter, apply it at generated-content and chat boundaries, and version generated cache hashes so older oversized variants regenerate safely.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, Vitest, FastAPI, SQLAlchemy, pytest, LangChain Google Generative AI.

---

## File Structure

### Create

- `frontend/lib/i18n.ts`: Locale types, storage helpers, backend-language mapping, and typed visitor dictionaries.
- `frontend/components/VisitorLocaleProvider.tsx`: Client context that restores and persists the visitor locale.
- `frontend/components/LanguageSelector.tsx`: Home-page-only `VI | EN` control.
- `frontend/lib/i18n.test.ts`: Unit tests for locale normalization, persistence helpers, mappings, and dictionaries.
- `frontend/vitest.config.ts`: Minimal Vitest configuration for pure TypeScript tests.
- `backend/tests/unit/test_content_word_limit.py`: Boundary tests for the 300-word helper.

### Modify

- `frontend/package.json`: Add `test` script and Vitest development dependency.
- `frontend/package-lock.json`: Lock the Vitest dependency.
- `frontend/app/layout.tsx`: Set HERA metadata and mount the locale provider.
- `frontend/app/page.tsx`: Add language selector, decouple language from persona, and translate the home page.
- `frontend/app/method/page.tsx`: Translate visitor copy and use the new exploration sentence.
- `frontend/app/scan/page.tsx`: Translate camera/search controls and errors.
- `frontend/app/manual/page.tsx`: Translate headings, loading/empty labels, and fallback image text.
- `frontend/app/item/[id]/page.tsx`: Use the saved locale for UI, content generation, chat, audio labels, and errors.
- `frontend/components/LoadingOverlay.tsx`: Translate scanning status.
- `frontend/components/CameraCapture.tsx`: Translate camera permission, capture alt text, and hidden button label.
- `frontend/components/ResultModal.tsx`: Translate result status, similarity labels, actions, and empty states.
- `backend/app/modules/content/text_utils.py`: Add the reusable word-limit helper and generation-rules version.
- `backend/app/modules/content/service.py`: Limit generated introductions/adaptations and version generated cache hashes without truncating manual content.
- `backend/app/modules/llm/generator.py`: Add explicit 300-word instructions to introduction, adaptation, and chat prompts.
- `backend/app/modules/llm/chat_router.py`: Enforce the 300-word contract on chat responses.
- `backend/tests/api/test_content.py`: Test generated persistence limits, cache invalidation, and manual-content preservation.
- `backend/tests/api/test_chat.py`: Test chat response enforcement.
- `backend/tests/unit/test_llm_content.py`: Test that all prompt paths include the word-limit requirement.

Do not modify `/frontend/app/admin/*`, management components, DINOv2 naming, or the FastAPI internal title.

---

### Task 1: Add the Typed Visitor Locale Core

**Files:**
- Create: `frontend/lib/i18n.ts`
- Create: `frontend/lib/i18n.test.ts`
- Create: `frontend/vitest.config.ts`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

- [ ] **Step 1: Add Vitest to the frontend test toolchain**

Run:

```powershell
cd frontend
npm install --save-dev vitest
```

Add this script to `frontend/package.json`:

```json
"test": "vitest run"
```

Expected: `package.json` and `package-lock.json` include Vitest, with no React testing libraries added.

- [ ] **Step 2: Write failing locale-core tests**

Create `frontend/lib/i18n.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  backendLanguageForLocale,
  normalizeLocale,
  readStoredLocale,
  translations,
  writeStoredLocale,
} from "./i18n";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe("visitor locale", () => {
  it("defaults invalid values to Vietnamese", () => {
    expect(DEFAULT_LOCALE).toBe("vi");
    expect(normalizeLocale(null)).toBe("vi");
    expect(normalizeLocale("fr")).toBe("vi");
  });

  it("accepts supported locales", () => {
    expect(normalizeLocale("vi")).toBe("vi");
    expect(normalizeLocale("en")).toBe("en");
  });

  it("maps UI locales to backend language values", () => {
    expect(backendLanguageForLocale("vi")).toBe("Tiếng Việt");
    expect(backendLanguageForLocale("en")).toBe("Tiếng Anh");
  });

  it("persists and restores a locale", () => {
    const storage = memoryStorage();
    writeStoredLocale(storage, "en");
    expect(storage.getItem(LOCALE_STORAGE_KEY)).toBe("en");
    expect(readStoredLocale(storage)).toBe("en");
  });

  it("falls back when storage contains an invalid locale", () => {
    const storage = memoryStorage({ [LOCALE_STORAGE_KEY]: "invalid" });
    expect(readStoredLocale(storage)).toBe("vi");
  });

  it("contains matching visitor dictionary keys", () => {
    expect(Object.keys(translations.en)).toEqual(Object.keys(translations.vi));
    expect(translations.vi.method.subtitle).toBe(
      "Hãy chọn một phương thức bên dưới để bắt đầu khám phá di tích."
    );
    expect(translations.en.productName).toBe("HERA");
  });
});
```

- [ ] **Step 3: Add the minimal Vitest configuration**

Create `frontend/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Run the test to verify RED**

Run:

```powershell
cd frontend
npm test -- lib/i18n.test.ts
```

Expected: FAIL because `frontend/lib/i18n.ts` does not exist.

- [ ] **Step 5: Implement the locale types, storage helpers, mappings, and complete dictionaries**

Create `frontend/lib/i18n.ts` with:

```ts
export type VisitorLocale = "vi" | "en";

export const DEFAULT_LOCALE: VisitorLocale = "vi";
export const LOCALE_STORAGE_KEY = "hera_visitor_locale";

export function normalizeLocale(value: string | null): VisitorLocale {
  return value === "en" || value === "vi" ? value : DEFAULT_LOCALE;
}

export function readStoredLocale(storage: Pick<Storage, "getItem">): VisitorLocale {
  return normalizeLocale(storage.getItem(LOCALE_STORAGE_KEY));
}

export function writeStoredLocale(
  storage: Pick<Storage, "setItem">,
  locale: VisitorLocale
): void {
  storage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function backendLanguageForLocale(
  locale: VisitorLocale
): "Tiếng Việt" | "Tiếng Anh" {
  return locale === "vi" ? "Tiếng Việt" : "Tiếng Anh";
}
```

Define a single `vi` dictionary and type `en` with `typeof vi`. Include these
sections and exact meanings:

```ts
const vi = {
  productName: "HERA",
  common: {
    back: "Quay lại",
    close: "Đóng",
    retry: "Thử lại",
    noImage: "Không có ảnh",
  },
  home: {
    siteName: "Văn Miếu Quốc Tử Giám",
    title: "HERA",
    subtitle: "Khám phá di sản theo cách của riêng bạn",
    audiencePrompt: "Tôi là...",
    familyTitle: "Trẻ em / Gia đình",
    familySubtitle: "Học hỏi và khám phá thật thú vị",
    genZTitle: "Khách khám phá (Gen Z)",
    genZSubtitle: "Khám phá sâu hơn, hiểu hơn, trải nghiệm khác biệt",
    internationalTitle: "Khách quốc tế (International)",
    internationalSubtitle: "Khám phá, học hỏi và trải nghiệm theo cách của bạn",
    start: "BẮT ĐẦU HÀNH TRÌNH →",
    management: "Dành cho Ban quản lý",
    languageLabel: "Ngôn ngữ",
  },
  method: {
    titleLine1: "Bạn muốn tìm hiểu",
    titleLine2: "bằng cách nào?",
    subtitle: "Hãy chọn một phương thức bên dưới để bắt đầu khám phá di tích.",
    cameraTitle: "Chụp ảnh trực tiếp",
    cameraSubtitle: "Sử dụng camera để khám phá di tích",
    uploadTitle: "Tải ảnh lên",
    uploadSubtitle: "Chọn ảnh có sẵn từ điện thoại",
    manualTitle: "Chọn thủ công",
    manualSubtitle: "Xem danh sách toàn bộ di tích",
    uploadError: "Lỗi khi tải ảnh lên. Vui lòng thử lại.",
    noMatch: "Không nhận diện được vật thể này trong ảnh. Vui lòng thử ảnh khác.",
  },
  scan: {
    instruction: "Hãy hướng camera vào hiện vật và bấm nút chụp",
    capture: "Chụp ảnh",
    scanning: "Đang quét vật thể...",
    noMatch: "Không nhận diện được vật thể này. Hãy thử lại hoặc chọn thủ công.",
    searchError: "Lỗi khi tìm kiếm. Vui lòng thử lại.",
    cameraPermission: "Không thể truy cập camera. Vui lòng cấp quyền.",
    capturedAlt: "Ảnh vừa chụp",
    hiddenCapture: "Quét vật thể",
  },
  manual: {
    title: "Chọn di tích thủ công",
    empty: "Không có di tích nào trong hệ thống.",
  },
  item: {
    notFound: "Không tìm thấy vật thể",
    loadError: "Không thể tải nội dung",
    contentError: "Không thể sinh nội dung lúc này",
    composing: "AI đang soạn nội dung...",
    confidence: "Độ chính xác",
    noConfidence: "Chọn thủ công",
    noAudio: "Không có âm thanh cho nội dung này",
    audioError: "Không thể phát âm thanh",
    pause: "Tạm dừng",
    listen: "Nghe đoạn văn",
    chatTitle: "Hỏi đáp thêm với Trợ lý AI về hiện vật này",
    answering: "Đang trả lời...",
    chatConnectionError: "Lỗi kết nối. Vui lòng thử lại sau.",
    chatPlaceholder: "Nhập câu hỏi của bạn tại đây...",
    send: "Gửi",
  },
  results: {
    found: "Tìm thấy!",
    suggestions: "Gợi ý vật thể",
    notFound: "Không tìm thấy",
    topMatches: "gần giống nhất",
    match: "khớp",
    explore: "Khám phá với AI",
    noSimilar: "Không tìm thấy vật thể gần giống",
  },
} as const;
```

Add a recursive type that widens Vietnamese string literals while preserving
the exact key structure:

```ts
type DeepStringShape<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringShape<T[K]>;
};
```

Provide an English dictionary with the identical shape, including:

```ts
const en: DeepStringShape<typeof vi> = {
  productName: "HERA",
  common: {
    back: "Back",
    close: "Close",
    retry: "Try again",
    noImage: "No image",
  },
  home: {
    siteName: "Temple of Literature",
    title: "HERA",
    subtitle: "Explore heritage your way",
    audiencePrompt: "I am...",
    familyTitle: "Children / Family",
    familySubtitle: "Learn and explore through engaging stories",
    genZTitle: "Gen Z Explorer",
    genZSubtitle: "Go deeper, understand more, experience differently",
    internationalTitle: "International Visitor",
    internationalSubtitle: "Discover, learn and experience in your language",
    start: "START YOUR JOURNEY →",
    management: "Management access",
    languageLabel: "Language",
  },
  method: {
    titleLine1: "How would you like",
    titleLine2: "to explore?",
    subtitle: "Choose a method below to start exploring the heritage site.",
    cameraTitle: "Take a photo",
    cameraSubtitle: "Use your camera to explore a heritage object",
    uploadTitle: "Upload a photo",
    uploadSubtitle: "Choose an existing photo from your device",
    manualTitle: "Browse manually",
    manualSubtitle: "View all available heritage objects",
    uploadError: "The photo could not be uploaded. Please try again.",
    noMatch: "We could not identify this object. Please try another photo.",
  },
  scan: {
    instruction: "Point the camera at the object and tap the capture button",
    capture: "Capture",
    scanning: "Scanning object...",
    noMatch: "We could not identify this object. Try again or browse manually.",
    searchError: "Search failed. Please try again.",
    cameraPermission: "Camera access is unavailable. Please grant permission.",
    capturedAlt: "Captured photo",
    hiddenCapture: "Scan object",
  },
  manual: {
    title: "Browse heritage objects",
    empty: "No heritage objects are available.",
  },
  item: {
    notFound: "Object not found",
    loadError: "Unable to load content",
    contentError: "Unable to generate content right now",
    composing: "AI is preparing the content...",
    confidence: "Confidence",
    noConfidence: "Selected manually",
    noAudio: "Audio is not available for this content",
    audioError: "Unable to play audio",
    pause: "Pause",
    listen: "Listen",
    chatTitle: "Ask HERA more about this object",
    answering: "Answering...",
    chatConnectionError: "Connection error. Please try again later.",
    chatPlaceholder: "Type your question here...",
    send: "Send",
  },
  results: {
    found: "Match found!",
    suggestions: "Suggested objects",
    notFound: "No match found",
    topMatches: "closest matches",
    match: "match",
    explore: "Explore with AI",
    noSimilar: "No similar object was found",
  },
};

export const translations = { vi, en } as const;
export type VisitorTranslations = DeepStringShape<typeof vi>;
```

- [ ] **Step 6: Run locale tests to verify GREEN**

Run:

```powershell
cd frontend
npm test -- lib/i18n.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 7: Commit the locale core**

```powershell
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts frontend/lib/i18n.ts frontend/lib/i18n.test.ts
git commit -m "feat: add visitor locale core"
```

---

### Task 2: Add Locale Context and the Home-Page Selector

**Files:**
- Create: `frontend/components/VisitorLocaleProvider.tsx`
- Create: `frontend/components/LanguageSelector.tsx`
- Modify: `frontend/app/layout.tsx`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Extend locale-core tests with language/persona independence**

Add to `frontend/lib/i18n.test.ts`:

```ts
it("keeps locale mapping independent from persona labels", () => {
  expect(backendLanguageForLocale("en")).toBe("Tiếng Anh");
  expect(translations.en.home.familyTitle).toBe("Children / Family");
});
```

- [ ] **Step 2: Run the focused test**

Run:

```powershell
cd frontend
npm test -- lib/i18n.test.ts
```

Expected: PASS because the core behavior already exists. This test documents
the approved separation before page wiring begins.

- [ ] **Step 3: Implement `VisitorLocaleProvider`**

Create a client context exposing:

```ts
type VisitorLocaleContextValue = {
  locale: VisitorLocale;
  language: "Tiếng Việt" | "Tiếng Anh";
  t: VisitorTranslations;
  ready: boolean;
  setLocale: (locale: VisitorLocale) => void;
};
```

Initialization rules:

```ts
const [locale, setLocaleState] = useState<VisitorLocale>(DEFAULT_LOCALE);
const [ready, setReady] = useState(false);

useEffect(() => {
  setLocaleState(readStoredLocale(window.localStorage));
  setReady(true);
}, []);
```

Persistence rules:

```ts
const setLocale = (next: VisitorLocale) => {
  setLocaleState(next);
  writeStoredLocale(window.localStorage, next);
};
```

Export `useVisitorLocale()` and throw a clear error when used outside the
provider.

- [ ] **Step 4: Implement the home-only language selector**

Create `LanguageSelector.tsx` accepting no props and consuming the locale
context. Render two buttons:

```tsx
<div role="group" aria-label={t.home.languageLabel}>
  {(["vi", "en"] as const).map((option) => (
    <button
      key={option}
      type="button"
      aria-pressed={locale === option}
      onClick={() => setLocale(option)}
    >
      {option.toUpperCase()}
    </button>
  ))}
</div>
```

Use selected styling `bg-red-600 text-white` and unselected styling
`text-slate-600 hover:bg-slate-100`.

- [ ] **Step 5: Mount the provider and update HERA metadata**

In `frontend/app/layout.tsx`:

```ts
export const metadata: Metadata = {
  title: "HERA",
  description: "Trợ lý khám phá di tích bằng AI",
};
```

Wrap `children` with `<VisitorLocaleProvider>` and keep the root HTML language
as a safe server default:

```tsx
<html lang="vi">
  <body>
    <VisitorLocaleProvider>{children}</VisitorLocaleProvider>
  </body>
</html>
```

- [ ] **Step 6: Translate the home page and decouple persona from language**

Replace persona entries so they contain only:

```ts
type PersonaType = {
  id: "family" | "genz" | "international";
  personaStr: "Family Visitor" | "Gen Z Explorer" | "Mặc định";
  color: string;
};
```

Do not store language inside persona data. In `handleStart`, store only
`user_persona`; locale persistence is owned by the provider.

Render:

- `<LanguageSelector />` at the top-right of the home card.
- `t.productName` as the main product title.
- All visitor-facing labels through `t.home`.
- Existing site identity through `t.home.siteName`.

- [ ] **Step 7: Run frontend tests and build**

Run:

```powershell
cd frontend
npm test
npm run build
```

Expected: tests PASS and Next.js build exits `0`.

- [ ] **Step 8: Commit provider and home page**

```powershell
git add frontend/components/VisitorLocaleProvider.tsx frontend/components/LanguageSelector.tsx frontend/app/layout.tsx frontend/app/page.tsx frontend/lib/i18n.test.ts
git commit -m "feat: add HERA language selector"
```

---

### Task 3: Translate Visitor Navigation Pages

**Files:**
- Modify: `frontend/app/method/page.tsx`
- Modify: `frontend/app/scan/page.tsx`
- Modify: `frontend/app/manual/page.tsx`
- Modify: `frontend/components/LoadingOverlay.tsx`
- Modify: `frontend/components/CameraCapture.tsx`

- [ ] **Step 1: Add a dictionary coverage test for navigation pages**

Add to `frontend/lib/i18n.test.ts`:

```ts
it("provides complete navigation copy in both locales", () => {
  for (const locale of ["vi", "en"] as const) {
    const t = translations[locale];
    expect(t.method.subtitle).toBeTruthy();
    expect(t.scan.instruction).toBeTruthy();
    expect(t.manual.title).toBeTruthy();
    expect(t.scan.cameraPermission).toBeTruthy();
  }
});
```

- [ ] **Step 2: Run the locale test**

Run:

```powershell
cd frontend
npm test -- lib/i18n.test.ts
```

Expected: PASS and establishes the copy contract used by the pages.

- [ ] **Step 3: Translate `/method`**

Consume `useVisitorLocale()` and replace all visitor text with:

```tsx
t.method.titleLine1
t.method.titleLine2
t.method.subtitle
t.method.cameraTitle
t.method.cameraSubtitle
t.method.uploadTitle
t.method.uploadSubtitle
t.method.manualTitle
t.method.manualSubtitle
t.method.uploadError
t.method.noMatch
```

The Vietnamese subtitle must render exactly:

```text
Hãy chọn một phương thức bên dưới để bắt đầu khám phá di tích.
```

- [ ] **Step 4: Translate `/scan` and shared loading state**

Use `t.scan` for camera instructions, capture label, retry text, no-match text,
and search errors.

Change `LoadingOverlay` to consume locale context and render
`t.scan.scanning`.

- [ ] **Step 5: Translate camera permission and accessibility labels**

In `CameraCapture`, consume locale context and replace:

```tsx
setError(t.scan.cameraPermission);
<img alt={t.scan.capturedAlt} />
{t.scan.hiddenCapture}
```

Include `t.scan.cameraPermission` in the camera-start effect dependencies so a
restored locale is reflected correctly.

- [ ] **Step 6: Translate `/manual` without translating item names**

Use:

```tsx
t.manual.title
t.manual.empty
t.common.noImage
```

Continue rendering `item.name` exactly as returned by the API.

- [ ] **Step 7: Run tests and build**

Run:

```powershell
cd frontend
npm test
npm run build
```

Expected: tests PASS and build exits `0`.

- [ ] **Step 8: Commit navigation localization**

```powershell
git add frontend/lib/i18n.test.ts frontend/app/method/page.tsx frontend/app/scan/page.tsx frontend/app/manual/page.tsx frontend/components/LoadingOverlay.tsx frontend/components/CameraCapture.tsx
git commit -m "feat: localize visitor navigation"
```

---

### Task 4: Translate Item Detail and Search Results

**Files:**
- Modify: `frontend/app/item/[id]/page.tsx`
- Modify: `frontend/components/ResultModal.tsx`

- [ ] **Step 1: Add item/result dictionary coverage**

Add to `frontend/lib/i18n.test.ts`:

```ts
it("provides complete item and result copy", () => {
  for (const locale of ["vi", "en"] as const) {
    const t = translations[locale];
    expect(t.item.chatTitle).toBeTruthy();
    expect(t.item.listen).toBeTruthy();
    expect(t.results.explore).toBeTruthy();
    expect(t.results.match).toBeTruthy();
  }
});
```

- [ ] **Step 2: Run the focused test**

Run:

```powershell
cd frontend
npm test -- lib/i18n.test.ts
```

Expected: PASS.

- [ ] **Step 3: Replace local language state on the item page**

Remove:

```ts
const [language, setLanguage] = useState("Tiếng Việt");
setLanguage(localStorage.getItem("user_language") || "Tiếng Việt");
```

Consume:

```ts
const { language, t, ready: localeReady } = useVisitorLocale();
```

Retain persona loading from `localStorage`, but gate the content request on both
persona readiness and `localeReady`.

When `language` changes because the home-page selection changed, clear
`chatHistory`, stop audio, and request the matching cached/generated variant.

- [ ] **Step 4: Translate every item-detail UI state**

Replace hard-coded visitor labels with `t.item` and `t.common`, including:

- Loading item/content
- Item-not-found and load errors
- Audio unavailable/playback errors
- Listen/pause labels
- Chat heading, placeholder, answer loading, send button
- Chat connection error
- Back-button accessibility label

Keep `item.name` unchanged.

For the confidence line, preserve the current behavior in this scope but
translate its label:

```tsx
<p>{t.item.confidence}: 96%</p>
```

The separate work item to pass actual similarity remains outside this plan.

- [ ] **Step 5: Translate `ResultModal`**

Consume locale context and replace all hard-coded status/action text through
`t.results` and `t.common`. Keep `item.name` and `item.description` unchanged.

Render similarity as:

```tsx
{pct}% {t.results.match}
```

- [ ] **Step 6: Run tests and build**

Run:

```powershell
cd frontend
npm test
npm run build
```

Expected: tests PASS and build exits `0`.

- [ ] **Step 7: Commit item/result localization**

```powershell
git add frontend/lib/i18n.test.ts frontend/app/item/[id]/page.tsx frontend/components/ResultModal.tsx
git commit -m "feat: localize visitor item experience"
```

---

### Task 5: Add a Deterministic 300-Word Helper

**Files:**
- Create: `backend/tests/unit/test_content_word_limit.py`
- Modify: `backend/app/modules/content/text_utils.py`

- [ ] **Step 1: Write failing boundary tests**

Create `backend/tests/unit/test_content_word_limit.py`:

```python
from app.modules.content.text_utils import limit_words


def make_words(count: int) -> str:
    return " ".join(f"word{i}" for i in range(count))


def test_limit_words_keeps_299_words_unchanged():
    text = make_words(299)
    assert limit_words(text) == text


def test_limit_words_keeps_300_words_unchanged():
    text = make_words(300)
    assert limit_words(text) == text


def test_limit_words_truncates_301_words():
    result = limit_words(make_words(301))
    assert len(result.removesuffix("...").split()) == 300
    assert result.endswith("...")


def test_limit_words_normalizes_only_truncation_boundary():
    result = limit_words("one two three four", max_words=3)
    assert result == "one two three..."


def test_limit_words_supports_vietnamese_whitespace_words():
    text = " ".join(["di tích"] * 151)
    result = limit_words(text, max_words=300)
    assert len(result.removesuffix("...").split()) == 300
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
cd backend
pytest tests/unit/test_content_word_limit.py -v
```

Expected: collection FAIL because `limit_words` does not exist.

- [ ] **Step 3: Implement the helper**

Add to `backend/app/modules/content/text_utils.py`:

```python
MAX_GENERATED_WORDS = 300
GENERATION_RULES_VERSION = "max-300-words-v1"


def limit_words(text: str, max_words: int = MAX_GENERATED_WORDS) -> str:
    words = text.split()
    if len(words) <= max_words:
        return text.strip()
    limited = " ".join(words[:max_words]).rstrip(" ,;:")
    return f"{limited}..."
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
cd backend
pytest tests/unit/test_content_word_limit.py -v
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit the helper**

```powershell
git add backend/app/modules/content/text_utils.py backend/tests/unit/test_content_word_limit.py
git commit -m "feat: add generated content word limit"
```

---

### Task 6: Enforce the Limit for Generated Item Content and Cache

**Files:**
- Modify: `backend/app/modules/content/service.py`
- Modify: `backend/tests/api/test_content.py`

- [ ] **Step 1: Write failing generated-content and cache tests**

Add imports:

```python
import hashlib

from app.modules.content.text_utils import GENERATION_RULES_VERSION
```

Add tests to `backend/tests/api/test_content.py`:

```python
def test_generated_item_content_is_limited_before_persistence(
    db_session, monkeypatch
):
    item = _add_item(db_session)
    long_text = " ".join(f"word{i}" for i in range(301))
    monkeypatch.setattr(
        "app.modules.content.service.get_rag_generator",
        lambda: Mock(generate_answer=Mock(return_value=long_text)),
    )
    monkeypatch.setattr(
        "app.modules.content.service.try_get_rag_retriever",
        lambda: None,
    )
    monkeypatch.setattr(
        "app.modules.content.service.synthesize_speech",
        lambda text, language: None,
    )

    result = ItemContentService().generate_and_persist(
        db_session, item, "Mặc định", "Tiếng Việt"
    )

    assert len(result.content.removesuffix("...").split()) == 300
    stored = db_session.query(ItemContentVariant).filter_by(item_id=item.id).one()
    assert stored.text_content == result.content


def test_adapted_content_is_limited_before_persistence(db_session, monkeypatch):
    item = _add_item(db_session)
    long_text = " ".join(f"word{i}" for i in range(301))
    monkeypatch.setattr(
        "app.modules.content.service.get_rag_generator",
        lambda: Mock(adapt_content=Mock(return_value=long_text)),
    )
    monkeypatch.setattr(
        "app.modules.content.service.synthesize_speech",
        lambda text, language: None,
    )

    result = ItemContentService().generate_adapted_variant(
        db_session,
        item,
        "Mặc định",
        "Tiếng Anh",
        "Base content",
    )

    assert len(result.content.removesuffix("...").split()) == 300


def test_generation_rules_version_changes_generated_hash():
    current = compute_content_hash("Description", source="generated")
    manual = compute_content_hash("Description", source="manual")
    assert current != manual


def test_old_generated_hash_is_invalidated(db_session):
    item = _add_item(db_session)
    old_hash = hashlib.sha256(item.description.encode("utf-8")).hexdigest()
    db_session.add(
        ItemContentVariant(
            item_id=item.id,
            persona="Mặc định",
            language="Tiếng Việt",
            text_content="Old generated content",
            content_hash=old_hash,
            status="ready",
            source="generated",
        )
    )
    db_session.commit()

    assert (
        ItemContentService().get_valid_variant(
            db_session, item, "Mặc định", "Tiếng Việt"
        )
        is None
    )


def test_existing_manual_hash_remains_valid(db_session):
    item = _add_item(db_session)
    manual_hash = hashlib.sha256(item.description.encode("utf-8")).hexdigest()
    db_session.add(
        ItemContentVariant(
            item_id=item.id,
            persona="Mặc định",
            language="Tiếng Việt",
            text_content="Manual content",
            content_hash=manual_hash,
            status="ready",
            source="manual",
        )
    )
    db_session.commit()

    assert (
        ItemContentService().get_valid_variant(
            db_session, item, "Mặc định", "Tiếng Việt"
        )
        is not None
    )


def test_manual_content_is_not_truncated(db_session, monkeypatch):
    item = _add_item(db_session)
    long_text = " ".join(f"word{i}" for i in range(350))
    monkeypatch.setattr(
        "app.modules.content.service.synthesize_speech",
        lambda text, language: None,
    )

    result = ItemContentService().update_content(
        db_session, item, "Mặc định", "Tiếng Việt", long_text
    )

    assert len(result.content.split()) == 350
```

- [ ] **Step 2: Run focused tests to verify RED**

Run:

```powershell
cd backend
pytest tests/api/test_content.py -k "limited or generation_rules or manual_content" -v
```

Expected: FAIL because generated content is not limited and
`compute_content_hash` has no `source` parameter.

- [ ] **Step 3: Version generated hashes while preserving manual variants**

Change the signature:

```python
def compute_content_hash(description: str, source: str = "generated") -> str:
    hash_input = description
    if source != "manual":
        hash_input = f"{GENERATION_RULES_VERSION}:{description}"
    return hashlib.sha256(hash_input.encode("utf-8")).hexdigest()
```

Because the hash is opaque, adjust the test to compare values rather than search
inside the SHA-256 output:

```python
assert compute_content_hash("Description", "generated") != compute_content_hash(
    "Description", "manual"
)
```

In `get_valid_variant`, load candidate variants by item/persona/language/status,
then validate:

```python
expected_hash = compute_content_hash(item.description, variant.source)
if variant.content_hash != expected_hash:
    return None
```

In `upsert_variant`, compute:

```python
content_hash = compute_content_hash(item.description, source)
```

This invalidates old generated/pregenerated variants while leaving existing
manual variants valid under the description-only hash.

- [ ] **Step 4: Limit only LLM-generated item text**

Import `limit_words`.

In `generate_text`:

```python
return limit_words(strip_citations(content)), "generated"
```

Keep the exception fallback unchanged:

```python
return item.description, "fallback_description"
```

In `generate_adapted_variant`:

```python
text_content = limit_words(strip_citations(adapted))
```

Do not call `limit_words` in `update_content`.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
cd backend
pytest tests/api/test_content.py -v
```

Expected: all content API tests PASS.

- [ ] **Step 6: Commit content enforcement**

```powershell
git add backend/app/modules/content/service.py backend/tests/api/test_content.py
git commit -m "feat: limit generated item content"
```

---

### Task 7: Enforce the Limit for Chat and Add Prompt Instructions

**Files:**
- Modify: `backend/app/modules/llm/generator.py`
- Modify: `backend/app/modules/llm/chat_router.py`
- Modify: `backend/tests/api/test_chat.py`
- Modify: `backend/tests/unit/test_llm_content.py`

- [ ] **Step 1: Write a failing chat API limit test**

Add to `backend/tests/api/test_chat.py`:

```python
def test_chat_limits_generated_response_to_300_words(
    client, db_session, monkeypatch
):
    class LongGenerator:
        def generate_chat(self, **kwargs):
            return " ".join(f"word{i}" for i in range(301))

    item = Item(name="Test item", description="Primary description")
    db_session.add(item)
    db_session.commit()

    monkeypatch.setattr(chat_router, "try_get_rag_retriever", lambda: None)
    monkeypatch.setattr(chat_router, "get_rag_generator", lambda: LongGenerator())

    response = client.post(
        "/api/chat",
        json={"item_id": item.id, "message": "Question", "history": []},
    )

    assert response.status_code == 200
    content = response.json()["content"]
    assert len(content.removesuffix("...").split()) == 300
    assert content.endswith("...")
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```powershell
cd backend
pytest tests/api/test_chat.py::test_chat_limits_generated_response_to_300_words -v
```

Expected: FAIL with 301 words returned.

- [ ] **Step 3: Enforce the limit at the chat API boundary**

Import `limit_words` in `chat_router.py` and change the success response:

```python
return ChatResponse(content=limit_words(content))
```

- [ ] **Step 4: Run the chat test to verify GREEN**

Run:

```powershell
cd backend
pytest tests/api/test_chat.py::test_chat_limits_generated_response_to_300_words -v
```

Expected: PASS.

- [ ] **Step 5: Write prompt-contract tests**

Extend `backend/tests/unit/test_llm_content.py` with a fake LLM that captures
payloads:

```python
class CapturingLLM:
    def __init__(self):
        self.payloads = []

    def invoke(self, payload):
        self.payloads.append(payload)
        return type("Response", (), {"content": "Short answer"})()
```

Instantiate `RAGGenerator` with `__new__` to avoid provider initialization:

```python
def generator_with_capture():
    generator = RAGGenerator.__new__(RAGGenerator)
    generator.llm = CapturingLLM()
    return generator
```

Add one test per prompt path:

```python
def test_generate_answer_prompt_requires_at_most_300_words():
    generator = generator_with_capture()
    generator.generate_answer(
        "Question",
        [Document(page_content="Context", metadata={"page": "1"})],
    )
    assert "không quá 300 từ" in generator.llm.payloads[0]


def test_adapt_content_prompt_requires_at_most_300_words():
    generator = generator_with_capture()
    generator.adapt_content("Base", "Item")
    assert "không quá 300 từ" in generator.llm.payloads[0]


def test_chat_prompt_requires_at_most_300_words():
    generator = generator_with_capture()
    generator.generate_chat("Question", [], [])
    system_content = generator.llm.payloads[0][0].content
    assert "không quá 300 từ" in system_content
```

- [ ] **Step 6: Run prompt tests to verify RED**

Run:

```powershell
cd backend
pytest tests/unit/test_llm_content.py -v
```

Expected: the three new prompt tests FAIL.

- [ ] **Step 7: Add explicit bilingual prompt constraints**

In all three generator paths add:

```text
Giới hạn độ dài: câu trả lời không quá 300 từ.
Length limit: the response must not exceed 300 words.
```

Place it in:

- `generate_answer` base instructions
- `adapt_content` instructions
- `generate_chat` base instructions

- [ ] **Step 8: Run prompt and chat suites**

Run:

```powershell
cd backend
pytest tests/unit/test_llm_content.py tests/api/test_chat.py -v
```

Expected: all tests PASS.

- [ ] **Step 9: Commit chat and prompt enforcement**

```powershell
git add backend/app/modules/llm/generator.py backend/app/modules/llm/chat_router.py backend/tests/api/test_chat.py backend/tests/unit/test_llm_content.py
git commit -m "feat: limit generated chat responses"
```

---

### Task 8: Full Verification and Visitor UI Review

**Files:**
- Verify only; no planned production edits.

- [ ] **Step 1: Run all frontend tests**

```powershell
cd frontend
npm test
```

Expected: all Vitest tests PASS.

- [ ] **Step 2: Run the frontend production build**

```powershell
cd frontend
npm run build
```

Expected: Next.js build exits `0`; no missing translation keys or TypeScript
errors.

- [ ] **Step 3: Run all offline backend tests**

```powershell
cd backend
pytest -m "not integration"
```

Expected: all non-integration tests PASS.

- [ ] **Step 4: Start the local application**

Backend:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Frontend:

```powershell
cd frontend
npm run dev
```

Expected: backend health is `200` at `http://127.0.0.1:8000/health` and frontend
loads at `http://localhost:3000`.

- [ ] **Step 5: Verify the Vietnamese visitor flow in Browser**

Check:

1. `/` displays `HERA` and `VI | EN`.
2. `VI` displays Vietnamese copy.
3. `/method` displays exactly:
   `Hãy chọn một phương thức bên dưới để bắt đầu khám phá di tích.`
4. `/scan`, `/manual`, and `/item/[id]` display Vietnamese controls.
5. Item names remain exactly as returned by the backend.

- [ ] **Step 6: Verify the English visitor flow and persistence**

Check:

1. Select `EN` on `/`.
2. Navigate through `/method`, `/scan`, `/manual`, and `/item/[id]`.
3. All visitor controls and messages are English.
4. Reload `/item/[id]`; English remains active.
5. The item name remains Vietnamese.
6. Content API requests use `language=Tiếng Anh`.
7. Chat requests use `language=Tiếng Anh`.

- [ ] **Step 7: Verify management scope**

Open `/admin/groups` and `/admin/register`.

Expected: existing management copy is unchanged and no visitor language selector
appears.

- [ ] **Step 8: Verify the 300-word API contract**

For one Vietnamese and one English item introduction, count:

```powershell
($content -split '\s+' | Where-Object { $_ }).Count
```

Repeat for a deliberately broad chat question.

Expected: each generated response is `<= 300` words.

- [ ] **Step 9: Review the final diff**

Run:

```powershell
git status --short
git diff --check
git diff --stat
```

Expected:

- No whitespace errors.
- Only scoped HERA/i18n/word-limit files changed.
- Existing unrelated changes in `backend/app/modules/content/tts.py`,
  `backend/pyproject.toml`, `backend/uv.lock`, `frontend/next.config.mjs`,
  `backend/scripts/ingest_van_mieu.py`, `data/`, and `walkthrough.md` are not
  reverted or included in feature commits unless independently required.

- [ ] **Step 10: Commit verification-only fixes if any**

If verification required scoped corrections:

```powershell
git add <only scoped corrected files>
git commit -m "fix: complete HERA visitor localization"
```

If no corrections were needed, do not create an empty commit.
