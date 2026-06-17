const fs = require("node:fs");
const assert = require("node:assert/strict");
const path = require("node:path");

const apiSource = fs.readFileSync(
  path.join(__dirname, "..", "lib", "api.ts"),
  "utf8"
);

const start = apiSource.indexOf("export function createGroupDocument");
const end = apiSource.indexOf("export async function deleteGroupDocument");
const createGroupDocumentBody =
  start >= 0 && end > start ? apiSource.slice(start, end) : "";

assert.ok(
  createGroupDocumentBody.length > 0,
  "createGroupDocument should be present in frontend/lib/api.ts"
);
assert.match(
  createGroupDocumentBody,
  /apiHeaders\(\)/,
  "createGroupDocument must reuse apiHeaders() so XHR uploads include auth headers"
);
assert.match(
  createGroupDocumentBody,
  /new Headers\(apiHeaders\(\)\)\.forEach\(\(value, key\) => \{[\s\S]*?xhr\.setRequestHeader\(key, value\);/,
  "createGroupDocument must forward apiHeaders() onto XMLHttpRequest"
);
assert.match(
  apiSource,
  /return configured \|\| "http:\/\/127\.0\.0\.1:8000";/,
  "localhost uploads should bypass the Next.js rewrite proxy by default"
);
assert.match(
  createGroupDocumentBody,
  /HTTP \$\{xhr\.status\}/,
  "createGroupDocument should include HTTP status when upload response is not JSON"
);

const panelSource = fs.readFileSync(
  path.join(__dirname, "..", "components", "GroupDocumentsPanel.tsx"),
  "utf8"
);

assert.match(
  panelSource,
  /failedUploads/,
  "GroupDocumentsPanel should track per-file upload failures"
);
assert.match(
  panelSource,
  /if \(failedUploads\.length > 0\) \{[\s\S]*await loadDocuments\(\);/,
  "GroupDocumentsPanel should reload successful documents before reporting partial upload failure"
);
