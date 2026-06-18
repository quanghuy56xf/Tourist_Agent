# HERA Visitor Persona Flow Design

## Objective

Reduce the number of decisions required before a visitor can scan or upload an
image, while preserving optional content personalization.

After selecting a heritage site, visitors go directly to the existing
exploration-method page. HERA uses a general-audience persona by default and
allows the visitor to change persona without introducing a mandatory setup
screen.

The existing visual theme, colors, typography, cards, spacing style, and
branding remain unchanged. The approved mockup defines information hierarchy
and navigation flow only.

## Product Decisions

- Remove the mandatory persona-selection page from the visitor journey.
- Display the default persona to visitors as `Phổ thông` in Vietnamese and
  `General` in English.
- Keep the backend persona value `Mặc định` to avoid unnecessary content-cache
  and database migration.
- Keep these optional persona choices:
  - `Phổ thông` / `General` -> backend value `Mặc định`
  - `Trẻ em / Gia đình` / `Children / Family` -> backend value
    `Family Visitor`
  - `Gen Z` / `Gen Z` -> backend value `Gen Z Explorer`
- Do not create a separate international-visitor persona. Language controls the
  output language; persona controls tone, complexity, and storytelling style.
- Keep language and persona independent. Every persona works in Vietnamese and
  English.

## Visitor Journey

The primary visitor flow becomes:

```text
Choose heritage site
-> initialize a new visit with the General persona
-> open exploration methods
-> scan image, upload image, or choose a tour
-> view item content
```

The current group home page no longer asks `Tôi là...` or requires a persona
before continuing. Selecting a heritage site routes directly to that site's
existing method page.

The method page retains its current three primary choices:

- Scan with the camera
- Upload an existing image
- Start an exploration tour

Persona is secondary to these actions and must not block them.

## Preference Controls

Add a compact persona selector beside the existing `VI | EN` language selector
in the upper-right preference area of the exploration-method page.

The controls use the current HERA theme and existing compact control styling.
No new visual theme or design system is introduced.

The persona selector:

- Initially displays `Phổ thông` or `General`.
- Opens the three persona choices when tapped.
- Updates the active persona immediately.
- Uses localized visitor-facing labels while storing stable backend values.
- Remains optional; a visitor can ignore it and begin exploring immediately.

Changing language does not change the selected persona. Changing persona does
not change the selected language.

## Preference Lifetime

Language and persona intentionally have different persistence rules.

### Language

Continue storing language in `localStorage`. A visitor using the same browser
and personal phone can retain their Vietnamese or English preference across
browser restarts and future visits.

### Persona

Store the active persona in `sessionStorage`, not `localStorage`.

- It remains available while navigating between the method, scan, upload
  result, item, and tour pages.
- It remains available after a page reload in the same tab.
- It is not treated as a long-term visitor profile.
- Selecting a heritage site starts a new visit and explicitly resets persona to
  the General backend value `Mặc định`.
- If a visitor opens a deep visitor URL without an initialized persona, HERA
  falls back to `Mặc định`.

Browsers may restore tabs after a crash or restart, so `sessionStorage` alone is
not used as evidence of a returning visitor. The explicit reset when selecting
a heritage site defines the start of a new visit.

## Data Flow

```text
Visitor selects a heritage site
-> write Mặc định to sessionStorage
-> navigate directly to /[groupSlug]/method
-> optional persona change updates sessionStorage
-> scan/upload/tour navigation preserves the same tab session
-> item content and chat read persona from sessionStorage
-> frontend sends stable persona and language values to existing APIs
-> backend selects or generates the matching content variant
```

The backend normalization and existing default value remain safeguards when the
persona value is missing or invalid.

## Anonymous Analytics

Do not create visitor accounts, persistent profiles, fingerprints, or
cross-visit histories as part of this work.

Analytics may record anonymous product-usage events such as:

- Heritage site selected
- Language active at the time of an event
- Persona active at the time of an event
- Exploration method selected
- Item viewed
- Tour started or completed

Events may use the existing anonymous visit/session identifier for grouping
actions within the current experience. They must not include a name, email,
phone number, advertising identifier, or another identifier intended to
recognize the same person on future visits.

## Compatibility and Migration

Existing browsers may contain `user_persona` in `localStorage` from the current
implementation. The revised flow must ignore and remove this legacy value so an
old selection cannot silently become a long-term preference.

Existing backend content variants remain valid because their stable persona
values do not change. Only visitor-facing labels and frontend persistence
behavior change.

## Error and Fallback Behavior

- Missing, malformed, or unsupported session persona -> use `Mặc định`.
- Unavailable `sessionStorage` -> keep `Mặc định` in in-memory state for the
  current page and continue without blocking exploration.
- A content request for a missing persona/language variant -> retain the
  backend's existing generation and fallback behavior.
- Missing saved language -> continue using the existing Vietnamese default.
- Preference-control failure must never prevent camera, upload, or tour use.

## Testing Strategy

### Frontend automated tests

- Selecting a heritage site routes directly to `/<groupSlug>/method`.
- A new heritage-site selection resets persona to `Mặc định`.
- The removed page no longer requires a persona choice.
- The method page renders language and persona controls using localized labels.
- Default visitor-facing persona is `Phổ thông` in Vietnamese and `General` in
  English.
- Persona changes are written to `sessionStorage`.
- Persona remains active across visitor-page navigation and reload.
- Persona is not written to `localStorage`.
- A legacy `localStorage.user_persona` value is removed and ignored.
- Missing or invalid session persona falls back to `Mặc định`.
- Language changes preserve persona, and persona changes preserve language.
- Item content and chat APIs receive the resolved persona and language.

### Backend regression tests

- Existing persona values and normalization continue to work.
- `Mặc định` remains the API default.
- All three personas remain available in Vietnamese and English.
- No new `International Visitor` backend persona is introduced.

### Manual verification

- Confirm the current theme is visually unchanged.
- Choose a heritage site and confirm the method page opens immediately.
- Begin scanning without touching persona and confirm General content is used.
- Change persona, scan or upload an item, and confirm the selected style is
  used for item content and chat.
- Switch between Vietnamese and English and confirm persona remains unchanged.
- Close the visit, select a heritage site again, and confirm persona resets to
  General.
- Confirm anonymous analytics contain product events without personal
  identifiers.

## Acceptance Criteria

- Persona selection is no longer a mandatory visitor step.
- Selecting a heritage site opens the exploration-method page directly.
- General-audience content is used when the visitor makes no persona choice.
- A compact optional persona selector appears beside the language selector.
- The existing HERA visual theme remains unchanged.
- Persona persists only for the active visit and resets on a new heritage-site
  selection.
- Language retains its existing long-term browser preference behavior.
- No persistent per-person visitor history is created.
- Analytics remain anonymous and may include language, persona, method, and
  item-view events.
- Existing backend persona variants and content caches remain compatible.
