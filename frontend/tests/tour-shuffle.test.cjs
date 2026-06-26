const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const toursSource = read("lib/tours.ts");
assert.match(toursSource, /export function getTourProgress/);
assert.match(toursSource, /export function markStopComplete/);
assert.doesNotMatch(read("app/[groupSlug]/tour/[id]/page.tsx"), /shuffleMode/);

const tourMatchSource = read("lib/tourMatch.ts");
assert.match(tourMatchSource, /game_mode/);
assert.match(tourMatchSource, /sequential_random/);
assert.match(read("lib/i18n/index.ts"), /VISITOR_LOCALES/);
assert.match(read("components/LanguageSelector.tsx"), /LOCALE_NATIVE_LABELS/);

assert.match(read("app/[groupSlug]/tour-match/page.tsx"), /TourStopsPreview/);
assert.match(read("app/[groupSlug]/tour-match/page.tsx"), /game_mode/);
assert.match(read("components/visitor/TourMatchMinimap.tsx"), /legendCurrent/);

console.log("Tour exploration order and tour-match mode checks passed.");
