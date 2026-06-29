const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");

test("AI appreciation opens in a closable modal", async () => {
  const [html, app, css] = await Promise.all([
    fs.readFile("public/index.html", "utf8"),
    fs.readFile("public/app.js", "utf8"),
    fs.readFile("public/style.css", "utf8"),
  ]);

  assert.match(html, /class="ai-appreciation-btn"/);
  assert.doesNotMatch(html, /class="ai-appreciation-panel hidden"/);
  assert.match(html, /id="ai-appreciation-modal" class="ai-appreciation-modal hidden"/);
  assert.match(html, /id="ai-appreciation-close"/);
  assert.match(html, /id="ai-appreciation-content"/);
  assert.match(app, /const aiBtn = fragment\.querySelector\("\.ai-appreciation-btn"\)/);
  assert.match(app, /const aiAppreciationModal = document\.getElementById\("ai-appreciation-modal"\)/);
  assert.match(app, /\/api\/paintings\/\$\{item\.id\}\/ai-appreciation/);
  assert.match(app, /renderAiAppreciation\(/);
  assert.match(app, /closeAiAppreciationModal\(/);
  assert.match(css, /\.ai-appreciation-modal\s*\{/);
  assert.match(css, /\.ai-appreciation-btn\s*\{/);
});
