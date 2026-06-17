const fs = require("node:fs");
const assert = require("node:assert/strict");
const path = require("node:path");

const layoutSource = fs.readFileSync(
  path.join(__dirname, "..", "app", "layout.tsx"),
  "utf8"
);

assert.doesNotMatch(
  layoutSource,
  /next\/font\/google/,
  "Root layout should not fetch Google Fonts at runtime"
);

