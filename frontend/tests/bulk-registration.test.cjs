const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sourcePath = path.join(__dirname, "../lib/bulkRegistration.ts");
assert.ok(fs.existsSync(sourcePath), "bulk registration helper should exist");
const ts = require("typescript");
let source = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleRef = { exports: {} };
const sandbox = { module: moduleRef, exports: moduleRef.exports };
vm.runInNewContext(source, sandbox, { filename: sourcePath });
const { parseDescriptionMap, groupBulkFiles } = sandbox.module.exports;

assert.equal(JSON.stringify(parseDescriptionMap('{"Artifact":"Description"}')), JSON.stringify({ Artifact: "Description" }));
assert.throws(() => parseDescriptionMap("[]"), /JSON object/);
assert.throws(() => parseDescriptionMap('{"A": 1}'), /chuỗi/);

const files = [
  { name: "front.jpg", type: "image/jpeg", webkitRelativePath: "root/Item A/front.jpg" },
  { name: "side.png", type: "image/png", webkitRelativePath: "root/Item A/side.png" },
  { name: "note.txt", type: "text/plain", webkitRelativePath: "root/Item A/note.txt" },
  { name: "front.jpg", type: "image/jpeg", webkitRelativePath: "root/Item B/front.jpg" },
];
const grouped = groupBulkFiles(files, { "Item A": "Description A" });
assert.equal(grouped.length, 2);
assert.equal(grouped[0].name, "Item A");
assert.equal(grouped[0].images.length, 2);
assert.equal(grouped[0].description, "Description A");
assert.equal(grouped[0].validationError, null);
assert.equal(grouped[1].name, "Item B");
assert.match(grouped[1].validationError, /thiếu mô tả/i);
const missingImages = groupBulkFiles(files.slice(0, 3), {
  "Item A": "Description A",
  "Item C": "Description C",
});
assert.equal(missingImages.length, 2);
assert.equal(missingImages[1].name, "Item C");
assert.match(missingImages[1].validationError, /thiếu ảnh/i);

console.log("Bulk registration helper checks passed.");
