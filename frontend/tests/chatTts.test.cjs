const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const segmentsSource = ts.transpileModule(read("lib/ttsSegments.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const segmentsModule = { exports: {} };
vm.runInNewContext(segmentsSource, { module: segmentsModule, exports: segmentsModule.exports });
const { splitTextForTtsSegments } = segmentsModule.exports;

const chatTtsSource = read("lib/chatTts.ts");
const itemPageSource = read("app/[groupSlug]/item/[id]/page.tsx");

const byPeriod = splitTextForTtsSegments(
  "Đền Khải Thánh thờ ai? Đây là công trình quan trọng. Nó được xây từ thời Lý."
);
assert.equal(byPeriod.length, 2);
assert.equal(byPeriod[0], "Đền Khải Thánh thờ ai? Đây là công trình quan trọng.");
assert.equal(byPeriod[1], "Nó được xây từ thời Lý.");

const threeSentences = splitTextForTtsSegments("Câu một. Câu hai. Câu ba.");
assert.equal(threeSentences.length, 3);
assert.equal(threeSentences[0], "Câu một.");
assert.equal(threeSentences[1], "Câu hai.");
assert.equal(threeSentences[2], "Câu ba.");

const singlePart = splitTextForTtsSegments("Không có dấu chấm trong đoạn này");
assert.equal(singlePart.length, 1);
assert.equal(singlePart[0], "Không có dấu chấm trong đoạn này");

assert.match(chatTtsSource, /TTS_PREFETCH_PARALLEL = 2/);
assert.match(chatTtsSource, /prefetchWindow/);
assert.match(chatTtsSource, /isIOS\(\)/);
assert.match(chatTtsSource, /splitTextForTtsSegments/);
assert.match(chatTtsSource, /TTS_SEGMENT_END_TRIM_SECONDS/);
assert.match(chatTtsSource, /preloadAudioFromObjectUrl/);
assert.match(chatTtsSource, /createSegmentPlayers/);

assert.match(itemPageSource, /playChatTts/);
assert.match(itemPageSource, /primeTtsAudioPlayback/);

console.log("Chat TTS iOS segmented checks passed.");
