const fs = require("node:fs");
const assert = require("node:assert/strict");
const path = require("node:path");

const itemPageSource = fs.readFileSync(
  path.join(__dirname, "..", "app", "[groupSlug]", "item", "[id]", "page.tsx"),
  "utf8"
);
const heraGuidePanelSource = fs.readFileSync(
  path.join(__dirname, "..", "components", "visitor", "HeraGuidePanel.tsx"),
  "utf8"
);

assert.doesNotMatch(
  itemPageSource,
  /itemContent\.has_audio\s*&&\s*itemContent\.audio_url/,
  "Item page should keep audio_url even when has_audio=false so the audio endpoint can generate it on demand"
);

assert.match(
  itemPageSource,
  /itemContent\.audio_url\s*\?\s*resolveImageUrl\(itemContent\.audio_url\)/,
  "Item page should pass any returned audio_url to HeraGuidePanel"
);

assert.match(
  heraGuidePanelSource,
  /const serverAudioStarted = await playServerAudio\(fullRestart, runId\);/,
  "HeraGuidePanel should detect whether server audio playback actually started"
);
assert.match(
  heraGuidePanelSource,
  /if \(serverAudioStarted \|\| !allowBrowserFallback \|\| !browserSpeechReady\) return serverAudioStarted;/,
  "HeraGuidePanel should fall back only after a user-triggered server audio failure when browser speech is available"
);
assert.match(
  heraGuidePanelSource,
  /return startBrowserSpeech\(textToSpeak, runId\);/,
  "HeraGuidePanel should fall back to browser speech after server audio playback fails"
);
