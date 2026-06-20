const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

assert.ok(exists("lib/minimapConfig.ts"), "minimap config module should exist");

const configSource = read("lib/minimapConfig.ts");
const compiled = ts.transpileModule(configSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleRef = { exports: {} };
vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports });
const {
  getMinimapConfig,
  findMinimapZone,
  minimapStorageKey,
  minimapUnreadStorageKey,
} = moduleRef.exports;

const config = getMinimapConfig("van-mieu-quoc-tu-giam");
assert.ok(config, "Văn Miếu slug should have a minimap config");
assert.match(config.imageSrc, /van-mieu-minimap\.svg$/);
assert.equal(config.zones.length, 6);
assert.equal(findMinimapZone(config, 9).zoneName, "Khuê Văn Các");
assert.equal(findMinimapZone(config, 9999), null);
assert.equal(
  minimapStorageKey("van-mieu-quoc-tu-giam"),
  "hera_last_item_van-mieu-quoc-tu-giam"
);
assert.equal(
  minimapUnreadStorageKey("van-mieu-quoc-tu-giam"),
  "hera_minimap_unread_van-mieu-quoc-tu-giam"
);
assert.match(configSource, /localStorage\.setItem\(minimapStorageKey\(groupSlug\), String\(itemId\)\)/);
assert.match(configSource, /localStorage\.setItem\(minimapUnreadStorageKey\(groupSlug\), "true"\)/);
assert.match(configSource, /localStorage\.removeItem\(minimapUnreadStorageKey\(groupSlug\)\)/);
const storage = new Map();
const events = [];
const browserModule = { exports: {} };
vm.runInNewContext(compiled, {
  module: browserModule,
  exports: browserModule.exports,
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
browserModule.exports.rememberMinimapItem("van-mieu-quoc-tu-giam", 9);
assert.equal(storage.get("hera_last_item_van-mieu-quoc-tu-giam"), "9");
assert.equal(browserModule.exports.hasUnreadMinimap("van-mieu-quoc-tu-giam"), true);
assert.equal(events[0].type, "hera-minimap-updated");
browserModule.exports.markMinimapSeen("van-mieu-quoc-tu-giam");
assert.equal(browserModule.exports.hasUnreadMinimap("van-mieu-quoc-tu-giam"), false);


assert.ok(exists("components/visitor/MinimapButton.tsx"), "minimap button should exist");
assert.ok(exists("components/visitor/MinimapModal.tsx"), "minimap modal should exist");
const buttonSource = read("components/visitor/MinimapButton.tsx");
const modalSource = read("components/visitor/MinimapModal.tsx");
assert.match(buttonSource, /hasUnreadMinimap/);
assert.match(buttonSource, /MINIMAP_UPDATED_EVENT/);
assert.match(buttonSource, /markMinimapSeen\(groupSlug\)/);
assert.match(buttonSource, /aria-label="Có vị trí mới trên bản đồ"/);
assert.match(buttonSource, /<MinimapModal/);
assert.match(modalSource, /role="dialog"/);
assert.match(modalSource, /aria-modal="true"/);
assert.match(modalSource, /animate-ping/);
assert.match(modalSource, /Chưa xác định vị trí/);
assert.match(modalSource, /Bản đồ chưa khả dụng/);

assert.ok(exists("public/images/van-mieu-minimap.svg"), "placeholder minimap image should exist");
const layoutSource = read("app/[groupSlug]/layout.tsx");
const itemSource = read("app/[groupSlug]/item/[id]/page.tsx");
assert.match(layoutSource, /import MinimapButton/);
assert.match(layoutSource, /<MinimapButton\s*\/>/);
assert.match(itemSource, /rememberMinimapItem\(groupSlug, itemId\)/);
console.log("Minimap module checks passed.");