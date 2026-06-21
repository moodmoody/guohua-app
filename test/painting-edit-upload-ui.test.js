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

test("cards do not expose standalone append attachment forms", async () => {
  const [html, app, css] = await Promise.all([
    fs.readFile("public/index.html", "utf8"),
    fs.readFile("public/app.js", "utf8"),
    fs.readFile("public/style.css", "utf8"),
  ]);

  assert.doesNotMatch(html, /append-attachment-form/);
  assert.doesNotMatch(html, /material-append-attachment-form/);
  assert.doesNotMatch(app, /querySelector\("\.append-attachment-form"\)/);
  assert.doesNotMatch(app, /querySelector\("\.material-append-attachment-form"\)/);
  assert.doesNotMatch(css, /append-attachment-form/);
  assert.doesNotMatch(css, /material-append-attachment-form/);
});

test("material edit form can append selected files while saving text fields", async () => {
  const [html, app] = await Promise.all([
    fs.readFile("public/index.html", "utf8"),
    fs.readFile("public/app.js", "utf8"),
  ]);

  assert.match(html, /name="asset"[\s\S]*?type="file"[\s\S]*?accept="image\/jpeg,image\/png,image\/webp,image\/heic,image\/heif,video\/mp4,video\/webm,video\/quicktime,video\/x-matroska"/);
  assert.match(app, /const editFiles = Array\.from\(editForm\.elements\.asset\.files \|\| \[\]\)/);
  assert.match(app, /editFiles\.forEach\(\(file\) => \{/);
  assert.match(app, /editFormData\.append\("asset", file\)/);
  assert.match(app, /fetchJson\(`\/api\/materials\/\$\{item\.id\}\/attachments`/);
});
