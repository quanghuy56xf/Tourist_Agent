const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const voiceSource = read("lib/voiceInput.ts");
assert.match(voiceSource, /AudioContext/);
assert.match(voiceSource, /createAnalyser/);
assert.match(voiceSource, /getByteFrequencyData/);
assert.match(voiceSource, /requestAnimationFrame/);
assert.match(voiceSource, /startRecording.*onSilenceDetected/);

const chatSource = read("components/visitor/CompanionChat.tsx");
assert.match(chatSource, /processAudioRef/);
assert.match(chatSource, /startRecording\(\(\) => \{/);

console.log("Companion Silence Detection checks passed.");
