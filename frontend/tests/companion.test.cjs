const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

for (const file of [
  "components/visitor/CompanionAvatar.tsx",
  "components/visitor/CompanionChat.tsx",
  "components/visitor/CompanionIntro.tsx",
  "lib/voiceInput.ts",
  "lib/companionState.ts",
  "app/[groupSlug]/companion/page.tsx",
]) {
  assert.ok(exists(file), `${file} should exist`);
}

const stateSource = read("lib/companionState.ts");
const compiled = ts.transpileModule(stateSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const stateModule = { exports: {} };
vm.runInNewContext(compiled, { module: stateModule, exports: stateModule.exports });
const storage = new Map();
const fakeStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
stateModule.exports.addVisitedItem(fakeStorage, 7);
stateModule.exports.addVisitedItem(fakeStorage, 7);
stateModule.exports.addVisitedItem(fakeStorage, 12);
assert.deepEqual(
  Array.from(stateModule.exports.getVisitedItemIds(fakeStorage)),
  [7, 12]
);
stateModule.exports.enableCompanionMode(fakeStorage);
assert.equal(stateModule.exports.isCompanionMode(fakeStorage), true);

const voiceSource = read("lib/voiceInput.ts");
assert.match(voiceSource, /MediaRecorder/);
assert.match(voiceSource, /getUserMedia/);
assert.match(voiceSource, /isVoiceInputSupported/);
assert.match(voiceSource, /startRecording/);
assert.match(voiceSource, /stopRecording/);

const apiSource = read("lib/api.ts");
assert.match(apiSource, /chatWithCompanion/);
assert.match(apiSource, /visited_item_ids/);
assert.match(apiSource, /persona\?: "Companion"/);

const avatarSource = read("components/visitor/CompanionAvatar.tsx");
assert.match(avatarSource, /companion-idle\.png/);
assert.match(avatarSource, /companion-talk\.png/);
assert.match(avatarSource, /companion-blink\.png/);
assert.match(avatarSource, /onError/);

const introSource = read("components/visitor/CompanionIntro.tsx");
assert.match(introSource, /companion-intro\.mp4/);
assert.match(introSource, /skipIntro/);
assert.match(introSource, /onError/);

const chatSource = read("components/visitor/CompanionChat.tsx");
assert.match(chatSource, /startRecording/);
assert.match(chatSource, /stopRecording/);
assert.match(chatSource, /transcribeAudio/);
assert.match(chatSource, /chatWithCompanion/);
assert.match(chatSource, /playChatTts\([\s\S]*"Companion"/);
assert.match(chatSource, /CompanionAvatar/);
assert.match(chatSource, /getCompanionFallbackMessage/);
assert.match(chatSource, /chatFallbackNetwork/);
assert.doesNotMatch(chatSource, /errorPrefix\}\$\{errMsg\}/);

const methodSource = read("app/[groupSlug]/method/page.tsx");
assert.match(methodSource, /\/companion/);
assert.match(methodSource, /companionTitle/);

const itemSource = read("app/[groupSlug]/item/[id]/page.tsx");
assert.match(itemSource, /addVisitedItem/);
assert.match(itemSource, /rememberMinimapItem/);

console.log("Companion feature checks passed.");
