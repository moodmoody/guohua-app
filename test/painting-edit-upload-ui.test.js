const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");

test("painting edit form can append selected image files while saving text fields", async () => {
  const [html, app] = await Promise.all([
    fs.readFile("public/index.html", "utf8"),
    fs.readFile("public/app.js", "utf8"),
  ]);

  assert.match(html, /name="image" type="file" accept="image\/jpeg,image\/png,image\/webp,image\/heic,image\/heif"/);
  assert.match(html, /追加图像（可选）/);
  assert.doesNotMatch(html, /替换图片（可选）/);
  assert.match(app, /const editFiles = Array\.from\(editForm\.elements\.image\.files \|\| \[\]\)/);
  assert.match(app, /editFiles\.forEach\(\(file\) => \{/);
  assert.match(app, /editFormData\.append\("image", file\)/);
  assert.match(app, /fetchJson\(`\/api\/paintings\/\$\{item\.id\}\/attachments`/);
});
