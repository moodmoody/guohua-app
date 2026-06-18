const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");

test("painting uploads show a visible reason before sending images over 10MB", async () => {
  const app = await fs.readFile("public/app.js", "utf8");

  assert.match(app, /const IMAGE_UPLOAD_LIMIT_BYTES = 10 \* 1024 \* 1024/);
  assert.match(app, /function paintingImageLimitMessage\(files\)/);
  assert.match(app, /图片不能超过 10M，请压缩后再上传/);
  assert.match(app, /const imageLimitMessage = paintingImageLimitMessage\(Array\.from\(uploadForm\.elements\.image\.files \|\| \[\]\)\)/);
  assert.match(app, /const editLimitMessage = paintingImageLimitMessage\(editFiles\)/);
  assert.match(app, /const appendLimitMessage = paintingImageLimitMessage\(files\)/);
  assert.match(app, /friendlyErrorMessage\(error\.message\)/);
  assert.match(app, /Image file must be <= 10MB/);
});
