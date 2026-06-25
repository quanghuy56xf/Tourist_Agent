import fs from "node:fs";
import path from "node:path";

function walkTranslate(value, map) {
  if (typeof value === "string") {
    return map[value] ?? value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => walkTranslate(item, map));
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = walkTranslate(nested, map);
    }
    return out;
  }
  return value;
}

function loadEn() {
  const enText = fs.readFileSync(path.join("lib", "i18n", "en.ts"), "utf8");
  const body = enText.match(/=\s*(\{[\s\S]*\});/)?.[1];
  if (!body) throw new Error("Could not parse en.ts");
  return eval(`(${body})`);
}

const en = loadEn();
const locales = ["fr", "ja", "ko", "zh"];

for (const locale of locales) {
  const mapPath = path.join("lib", "i18n", "maps", `${locale}.json`);
  const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  const translated = walkTranslate(en, map);
  const outPath = path.join("lib", "i18n", `${locale}.ts`);
  const content = `import type { VisitorTranslations } from "./types";\n\nexport const ${locale}: VisitorTranslations = ${JSON.stringify(translated, null, 2)};\n`;
  fs.writeFileSync(outPath, content);
  console.log(`wrote ${outPath}`);
}
