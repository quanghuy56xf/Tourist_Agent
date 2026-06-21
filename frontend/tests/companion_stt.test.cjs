const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const voiceSource = read("lib/voiceInput.ts");
assert.match(voiceSource, /MediaRecorder/);
assert.match(voiceSource, /getUserMedia/);
assert.match(voiceSource, /startRecording/);
assert.match(voiceSource, /stopRecording/);
assert.match(voiceSource, /cancelRecording/);
assert.doesNotMatch(voiceSource, /webkitSpeechRecognition/);

const apiSource = read("lib/api.ts");
assert.match(apiSource, /transcribeAudio/);
assert.match(apiSource, /\/api\/stt/);
assert.match(apiSource, /FormData/);

const chatSource = read("components/visitor/CompanionChat.tsx");
assert.match(chatSource, /startRecording/);
assert.match(chatSource, /stopRecording/);
assert.match(chatSource, /transcribeAudio/);
assert.match(chatSource, /Đang ghi âm/);
assert.match(chatSource, /Đang xử lý/);

console.log("Companion MediaRecorder STT checks passed.");
