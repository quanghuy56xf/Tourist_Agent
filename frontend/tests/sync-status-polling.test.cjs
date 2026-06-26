const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "..", "components", "ItemsManagementPanel.tsx"),
  "utf8"
);

assert.match(source, /SYNC_STATUS_POLL_MS\s*=\s*60_000/);
assert.doesNotMatch(source, /setInterval\(/);
assert.match(source, /window\.setTimeout\([\s\S]+SYNC_STATUS_POLL_MS/);
assert.match(source, /status\.is_sync_active/);
assert.doesNotMatch(source, /contentSyncing && needsWork/);
assert.match(source, /await forceSyncGroup\(resolvedFilter\)/);
assert.match(source, /setSyncPollRun\(\(current\) => current \+ 1\)/);

console.log("Sync status polling checks passed.");