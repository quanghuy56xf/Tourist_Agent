const fs = require("node:fs");
const assert = require("node:assert/strict");
const path = require("node:path");

const apiSource = fs.readFileSync(
  path.join(__dirname, "..", "lib", "api.ts"),
  "utf8"
);
const homePageSource = fs.readFileSync(
  path.join(__dirname, "..", "app", "page.tsx"),
  "utf8"
);

assert.match(
  apiSource,
  /export async function listDiscoverableGroups\(\): Promise<GroupSummary\[\]>/,
  "frontend API should expose a discoverable groups call for the visitor landing page"
);
assert.match(
  apiSource,
  /fetch\(`\$\{API_URL\}\/api\/groups\/discover`/,
  "listDiscoverableGroups should call /api/groups/discover"
);
assert.match(
  homePageSource,
  /import \{ GroupSummary, listDiscoverableGroups \} from "@\/lib\/api";/,
  "home page should import the discoverable groups call"
);
assert.match(
  homePageSource,
  /listDiscoverableGroups\(\)/,
  "home page should load all discoverable heritage sites"
);
assert.doesNotMatch(
  homePageSource,
  /listPublicGroups\(\)/,
  "home page should not be limited to public-only groups"
);
assert.match(
  homePageSource,
  /GROUP_LOAD_RETRY_MS/,
  "home page should retry loading groups while the backend is still starting"
);
assert.match(
  homePageSource,
  /retryTimer = window\.setTimeout\(loadGroups, GROUP_LOAD_RETRY_MS\);/,
  "home page should keep the loading spinner visible and retry instead of showing an immediate error"
);
assert.doesNotMatch(
  homePageSource,
  /\.catch\(\(\) => setError\(t\.groups\.loadError\)\)/,
  "home page should not show the load error immediately when the backend is not ready"
);
