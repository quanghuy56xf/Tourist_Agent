import fs from "node:fs";
import path from "node:path";

const lines = fs.readFileSync(path.join("lib", "i18n.ts"), "utf8").split(/\r?\n/);
const viStart = lines.findIndex((line) => line.startsWith("const vi = {"));
const viEnd = lines.findIndex((line, idx) => idx > viStart && line.trim() === "} as const;");
const enStart = lines.findIndex((line) => line.startsWith("const en:"));
const enEnd = lines.findIndex(
  (line, idx) => idx > enStart && line.trim() === "};" && lines[idx + 1] === "" && lines[idx + 2]?.startsWith("export const translations")
);

if (viStart < 0 || viEnd < 0 || enStart < 0 || enEnd < 0) {
  console.error("parse fail", { viStart, viEnd, enStart, enEnd });
  process.exit(1);
}

const viBody = lines.slice(viStart + 1, viEnd).join("\n");
const enBody = lines.slice(enStart + 1, enEnd).join("\n");
const outDir = path.join("lib", "i18n");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "vi.ts"), `export const vi = {\n${viBody}\n} as const;\n`);
fs.writeFileSync(
  path.join(outDir, "en.ts"),
  `import type { DeepStringShape } from "./types";\nimport type { vi } from "./vi";\n\nexport const en: DeepStringShape<typeof vi> = {\n${enBody}\n};\n`
);
console.log("extracted vi and en");
