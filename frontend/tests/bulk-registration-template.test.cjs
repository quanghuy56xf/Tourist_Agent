const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const templatePath = path.join(
  __dirname,
  "../public/templates/bulk-registration-descriptions.json"
);
const pagePath = path.join(__dirname, "../app/admin/register/page.tsx");

assert.ok(fs.existsSync(templatePath), "sample JSON template should exist");
const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));
assert.equal(typeof template, "object");
assert.ok(!Array.isArray(template));
assert.ok(Object.keys(template).length >= 2, "template should contain at least two examples");
assert.ok(
  Object.values(template).every((description) => typeof description === "string" && description.length > 0),
  "all sample descriptions should be non-empty strings"
);

const pageSource = fs.readFileSync(pagePath, "utf8");
assert.match(pageSource, /bulk-registration-descriptions\.json/);
assert.match(pageSource, /download/);
assert.match(pageSource, /Tải file JSON mẫu/);

console.log("Bulk registration template checks passed.");
