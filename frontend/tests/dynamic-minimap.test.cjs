const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

assert.ok(exists("lib/minimapState.ts"), "dynamic minimap should keep visitor state separately");
assert.ok(
  exists("components/admin/MinimapConfigPanel.tsx"),
  "admin minimap config panel should exist"
);
assert.equal(exists("lib/minimapConfig.ts"), false, "static minimap config should be removed");

const stateSource = read("lib/minimapState.ts");
const compiledState = ts.transpileModule(stateSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const storage = new Map();
const events = [];
const stateModule = { exports: {} };
vm.runInNewContext(compiledState, {
  module: stateModule,
  exports: stateModule.exports,
  CustomEvent: class CustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  },
  window: {
    localStorage: {
      setItem: (key, value) => storage.set(key, value),
      getItem: (key) => storage.get(key) ?? null,
      removeItem: (key) => storage.delete(key),
    },
    dispatchEvent: (event) => events.push(event),
  },
});
stateModule.exports.rememberMinimapItem("van-mieu", 42);
assert.equal(stateModule.exports.readRememberedMinimapItem("van-mieu"), 42);
assert.equal(stateModule.exports.hasUnreadMinimap("van-mieu"), true);
stateModule.exports.markMinimapSeen("van-mieu");
assert.equal(stateModule.exports.hasUnreadMinimap("van-mieu"), false);
assert.equal(events[0].type, "hera-minimap-updated");

const apiSource = read("lib/api.ts");
assert.match(apiSource, /export interface MinimapConfig/);
assert.match(apiSource, /getDynamicMinimapConfig/);
assert.match(apiSource, /uploadMinimapConfig/);
assert.match(apiSource, /downloadMinimapTemplate/);
assert.match(apiSource, /\/api\/groups\/\$\{groupId\}\/minimap\/template/);

const panelSource = read("components/admin/MinimapConfigPanel.tsx");
assert.match(panelSource, /accept="\.json,application\/json"/);
assert.match(panelSource, /FileReader/);
assert.match(panelSource, /uploadMinimapConfig/);
assert.match(panelSource, /downloadMinimapTemplate/);

const groupsPageSource = read("app/admin/groups/page.tsx");
assert.match(groupsPageSource, /import MinimapConfigPanel/);
assert.match(groupsPageSource, /<MinimapConfigPanel/);

const buttonSource = read("components/visitor/MinimapButton.tsx");
assert.match(buttonSource, /VISITOR_GROUP_ID_KEY/);
assert.match(buttonSource, /getDynamicMinimapConfig/);
assert.match(buttonSource, /setConfig/);
assert.match(buttonSource, /<MinimapModal[\s\S]*config=\{config\}/);

const modalSource = read("components/visitor/MinimapModal.tsx");
assert.match(modalSource, /config: MinimapConfig \| null/);
assert.doesNotMatch(modalSource, /getMinimapConfig/);
assert.match(modalSource, /HeritageMapCanvas/);
assert.match(modalSource, /MINIMAP_UPDATED_EVENT/);
assert.doesNotMatch(modalSource, /zone\.itemIds\.includes\(lastItemId\)/);

const layoutSource = read("app/[groupSlug]/layout.tsx");
assert.match(layoutSource, /<MinimapButton/);

const itemSource = read("app/[groupSlug]/item/[id]/page.tsx");
assert.match(itemSource, /from "@\/lib\/minimapState"/);
assert.doesNotMatch(itemSource, /<MinimapButton/);

const layersSource = read("lib/minimapLayers.ts");
assert.match(layersSource, /resolveUserLocation/);
assert.match(layersSource, /buildVisitorMapMarkers/);
assert.match(layersSource, /buildTourMatchMapMarkers/);

const canvasSource = read("components/visitor/HeritageMapCanvas.tsx");
assert.match(canvasSource, /MapMarkerLayer/);

const tourMatchSource = read("components/visitor/TourMatchMinimap.tsx");
assert.match(tourMatchSource, /HeritageMapCanvas/);
assert.match(tourMatchSource, /buildTourMatchMapMarkers/);

const scanSource = read("app/[groupSlug]/scan/page.tsx");
assert.match(scanSource, /rememberMinimapItem/);

console.log("Dynamic minimap checks passed.");
