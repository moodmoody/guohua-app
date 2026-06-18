const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");

test("painting upload form has its own visible message area", async () => {
  const [html, app] = await Promise.all([
    fs.readFile("public/index.html", "utf8"),
    fs.readFile("public/app.js", "utf8"),
  ]);

  assert.match(html, /id="upload-message"/);
  assert.match(app, /const uploadMessageEl = document\.getElementById\("upload-message"\)/);
  assert.match(app, /setUploadMessage\(imageLimitMessage, true\)/);
  assert.match(app, /setUploadMessage\("作品已收入册"\)/);
  assert.match(app, /setUploadMessage\(friendlyErrorMessage\(error\.message\), true\)/);
});
