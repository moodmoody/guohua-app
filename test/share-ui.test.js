const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");

test("painting cards expose a WeChat-friendly share action", async () => {
  const [html, app, css] = await Promise.all([
    fs.readFile("public/index.html", "utf8"),
    fs.readFile("public/app.js", "utf8"),
    fs.readFile("public/style.css", "utf8"),
  ]);

  assert.match(html, /class="share-btn"/);
  assert.match(html, /分享/);
  assert.match(html, /分享到朋友圈/);
  assert.match(app, /const shareBtn = fragment\.querySelector\("\.share-btn"\)/);
  assert.match(app, /\/api\/paintings\/\$\{item\.id\}\/share/);
  assert.match(app, /const posterShareUrl = new URL\(`\$\{payload\.url\}\?poster=1`/);
  assert.match(app, /window\.location\.href = posterShareUrl/);
  assert.match(css, /\.share-btn/);
});
