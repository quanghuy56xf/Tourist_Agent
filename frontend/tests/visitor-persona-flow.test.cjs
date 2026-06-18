const fs = require("node:fs");
const assert = require("node:assert/strict");
const path = require("node:path");

const frontendRoot = path.join(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), "utf8");
}

const personaSource = read("lib/visitorPersona.ts");
const homeButtonSource = read("components/visitor/HomeButton.tsx");

assert.match(
  personaSource,
  /export const DEFAULT_VISITOR_PERSONA[^=]*= "Mặc định"/,
  "default visitor persona should use the existing backend value"
);
assert.match(
  personaSource,
  /export const VISITOR_PERSONA_SESSION_KEY = "hera_visitor_persona"/,
  "persona should have a dedicated sessionStorage key"
);
assert.match(
  personaSource,
  /export const LEGACY_VISITOR_PERSONA_KEY = "user_persona"/,
  "legacy localStorage key should be declared for cleanup"
);
assert.match(
  personaSource,
  /storage\.getItem\(VISITOR_PERSONA_SESSION_KEY\)/,
  "persona should be restored from the supplied session storage"
);
assert.match(
  personaSource,
  /storage\.setItem\(VISITOR_PERSONA_SESSION_KEY, persona\)/,
  "persona changes should be written to the supplied session storage"
);
assert.match(
  personaSource,
  /localStorage\.removeItem\(LEGACY_VISITOR_PERSONA_KEY\)/,
  "starting a new visit should remove the legacy long-term persona"
);
assert.doesNotMatch(
  personaSource,
  /localStorage\.setItem/,
  "persona must never be persisted to localStorage"
);
assert.match(
  personaSource,
  /export function startVisitorSession[\s\S]*try \{[\s\S]*writeSessionPersona/,
  "starting a visit should tolerate unavailable session storage"
);
assert.match(
  homeButtonSource,
  /useGroupPath\("\/method"\)/,
  "heritage-site home buttons should open the method page directly"
);

const providerSource = read("components/VisitorPersonaProvider.tsx");
const selectorSource = read("components/PersonaSelector.tsx");
const layoutSource = read("app/layout.tsx");
const i18nSource = read("lib/i18n.ts");

assert.match(
  layoutSource,
  /<VisitorPersonaProvider>/,
  "root layout should provide persona state to all visitor pages"
);
assert.match(
  providerSource,
  /readSessionPersona\(window\.sessionStorage\)/,
  "persona provider should restore the active session persona"
);
assert.match(
  providerSource,
  /writeSessionPersona\(window\.sessionStorage, next\)/,
  "persona provider should persist changes only for the active session"
);
assert.match(
  selectorSource,
  /useVisitorPersona\(\)/,
  "persona selector should use the shared persona provider"
);
assert.match(
  selectorSource,
  /t\.persona\.general/,
  "persona selector should show the localized general label"
);
assert.match(
  selectorSource,
  /t\.persona\.family/,
  "persona selector should show the localized family label"
);
assert.match(
  selectorSource,
  /t\.persona\.genZ/,
  "persona selector should show the localized Gen Z label"
);
assert.match(
  i18nSource,
  /general: "Phổ thông"/,
  "Vietnamese translations should name the default persona Phổ thông"
);
assert.match(
  i18nSource,
  /general: "General"/,
  "English translations should name the default persona General"
);

const rootHomeSource = read("app/page.tsx");
const groupHomeSource = read("app/[groupSlug]/page.tsx");
const methodSource = read("app/[groupSlug]/method/page.tsx");
const itemSource = read("app/[groupSlug]/item/[id]/page.tsx");

assert.match(
  rootHomeSource,
  /startVisitorSession\(window\.sessionStorage, window\.localStorage\)/,
  "selecting a heritage site should start a fresh persona session"
);
assert.match(
  rootHomeSource,
  /setPersona\(DEFAULT_VISITOR_PERSONA\)/,
  "selecting a heritage site should also reset the live React persona state"
);
assert.match(
  rootHomeSource,
  /router\.push\(`\/\$\{slug\}\/method`\)/,
  "selecting a heritage site should open exploration methods directly"
);
assert.match(
  rootHomeSource,
  /trackVisitorEvent\("group_visit",[\s\S]*metadata: \{[\s\S]*language,[\s\S]*persona: DEFAULT_VISITOR_PERSONA/,
  "new visits should record anonymous language and default persona metadata"
);
assert.doesNotMatch(
  groupHomeSource,
  /const personas:/,
  "group home should no longer define a mandatory persona list"
);
assert.match(
  groupHomeSource,
  /router\.replace\(groupMethodPath\)/,
  "legacy group home URLs should redirect to exploration methods"
);
assert.match(
  methodSource,
  /<LanguageSelector compact \/>/,
  "method page should keep the compact language control"
);
assert.match(
  methodSource,
  /<PersonaSelector compact \/>/,
  "method page should show the optional persona control beside language"
);
assert.match(
  itemSource,
  /useVisitorPersona\(\)/,
  "item content and chat should use the shared session persona"
);
assert.doesNotMatch(
  itemSource,
  /localStorage\.getItem\("user_persona"\)/,
  "item page should not restore persona from long-term browser storage"
);
assert.match(
  itemSource,
  /trackVisitorEvent\("item_view",[\s\S]*metadata: \{ persona, language \}/,
  "item views should record anonymous persona and language metadata"
);
assert.match(
  itemSource,
  /chatWithAI\(itemId, userMsg\.content, chatHistory\.slice\(-10\), persona, language/,
  "chat requests should send only the 10 most recent history messages"
);
