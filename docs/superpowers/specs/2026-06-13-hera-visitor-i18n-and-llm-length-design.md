# HERA Visitor I18n and LLM Length Design

## Objective

Update the visitor-facing experience so users can choose Vietnamese or English
from the home page, keep that choice throughout the visitor flow, and receive
LLM-generated introductions and chat responses of no more than 300 words.

The product name displayed to users and exposed through page metadata becomes
`HERA`.

## Scope

### Included visitor pages

- `/`
- `/method`
- `/scan`
- `/manual`
- `/item/[id]`
- Visitor-facing shared components rendered by those pages

### Excluded management pages

- `/admin/*`
- Management-only panels and forms
- Management workflow labels and validation messages

The language preference may still be passed to shared APIs used by both flows,
but management UI text will not be translated as part of this work.

## Language Selection

The home page displays a compact `VI | EN` language selector. Vietnamese is the
default when no saved choice exists.

Selecting a language:

1. Updates the home page immediately.
2. Stores the visitor locale in `localStorage`.
3. Applies the saved locale when the visitor opens another visitor page.
4. Maps the UI locale to the backend's existing content language values:
   - `vi` -> `Tiếng Việt`
   - `en` -> `Tiếng Anh`

The existing persona selection remains independent from language selection.
Choosing an international visitor persona must not be the only way to select
English.

## Frontend Localization Architecture

Use a small internal localization layer rather than adding an external i18n
dependency.

### Locale state

A visitor locale provider owns:

- Current locale: `vi` or `en`
- Initialization from `localStorage`
- Persistence after changes
- A function for switching locale

The provider wraps the application layout so visitor pages can consume the same
state. Admin pages are not translated, even though they are technically inside
the provider.

### Translation resources

Maintain typed Vietnamese and English dictionaries for visitor-facing text.
Translation keys cover:

- Product branding
- Home page headings, persona labels and actions
- Method selection page
- Camera and upload instructions
- Manual selection states
- Item detail loading, confidence, audio and chat controls
- Visitor-facing errors and empty states
- Visitor shared components such as loading overlays and result modals

Do not translate item names returned from the database. For example,
`Bia Tiến sĩ` remains `Bia Tiến sĩ` in both locales.

Descriptions and generated content may change language through the backend
content language parameter.

## Branding and Copy

Replace visitor-facing product naming and document metadata with `HERA`.

Update the Vietnamese method-selection description to:

> Hãy chọn một phương thức bên dưới để bắt đầu khám phá di tích.

The English translation will communicate the same meaning:

> Choose a method below to start exploring the heritage site.

Backend internal names such as the FastAPI title and DINOv2 module names do not
need to change unless they are visible to visitors.

## Visitor Data Flow

```text
Home language selector
-> save vi/en in localStorage
-> visitor locale provider updates UI
-> visitor navigates to another page
-> page reads translations from provider
-> item content/chat maps locale to Tiếng Việt/Tiếng Anh
-> backend selects or generates the matching language variant
```

Changing language on the home page affects subsequent pages. No language
selector is added to later pages.

If a visitor opens a later page directly:

- Use the stored locale when available.
- Otherwise use Vietnamese.

## LLM Response Limit

The 300-word limit applies to:

- Generated item introductions
- Adapted persona/language item introductions
- Chat responses

It does not truncate source documents or RAG retrieval context.

### Prompt enforcement

All applicable prompts explicitly require a maximum of 300 words in the target
language.

### Deterministic enforcement

After receiving model output, the backend applies a word-limit helper:

1. Treat whitespace-separated units as words.
2. Return content unchanged when it contains 300 words or fewer.
3. When longer, keep the first 300 words.
4. Remove trailing partial punctuation spacing and append an ellipsis.

The same helper is applied before storing generated content and before returning
chat content. This guarantees the API contract even if the model ignores the
prompt.

Manually authored management content is not truncated automatically. The limit
applies to LLM-generated output only.

## Cached Content

Previously stored generated variants may exceed 300 words. Extend the content
hash input with a generation-rules version so variants created under the old
rules are invalidated and regenerated when requested.

Manually edited default content remains valid and is not silently replaced.
Derived generated language/persona variants are regenerated under the new
300-word rule when their source becomes invalid.

## Error Handling

- Invalid or missing saved locale falls back to `vi`.
- Translation lookup must fall back to Vietnamese rather than rendering an
  empty label.
- Existing backend language normalization remains the final safeguard for
  unknown language values.
- LLM failures retain the existing fallback behavior, but any fallback that is
  itself generated by an LLM must still pass through the word limiter.
- Static item descriptions used as emergency fallback are not treated as
  generated output and are not truncated.

## Testing Strategy

### Frontend

- Test locale normalization and backend-language mapping.
- Test Vietnamese as the default.
- Test persistence and restoration from `localStorage`.
- Test representative translation keys in both languages.
- Verify visitor pages use translation keys instead of hard-coded user-facing
  strings.
- Verify admin pages are outside the translation scope.
- Build the Next.js application to catch missing keys and type mismatches.

### Backend

- Unit-test content at 299, 300 and 301 words.
- Test Vietnamese and English text.
- Verify generated introductions are limited before persistence.
- Verify adapted variants are limited before persistence.
- Verify chat responses are limited before the API response.
- Verify content hashes change when the generation-rules version changes.
- Verify manually authored content is not truncated.
- Run non-integration backend tests without calling external providers.

### Manual verification

- Select English on `/`, navigate through all visitor pages and confirm all UI
  labels are English while item names remain unchanged.
- Reload a later visitor page and confirm English remains selected.
- Select Vietnamese and verify the new exploration sentence.
- Generate introduction and chat outputs in both languages and verify each has
  no more than 300 words.
- Confirm `/admin/*` remains unchanged.

## Acceptance Criteria

- The home page provides a visible Vietnamese/English selector.
- The saved language applies to all visitor pages and visitor shared components.
- No management-flow page is translated by this change.
- Visitor-facing product branding and page metadata use `HERA`.
- Item names from the database remain unchanged in English mode.
- The requested Vietnamese exploration sentence appears on `/method`.
- Item introductions and chat answers never exceed 300 words.
- Existing generated cache entries are invalidated safely under the new rule.
- Automated tests and frontend production build pass.
