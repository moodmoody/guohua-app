const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");

test("tag inputs and tag strips are present in painting and material UI", async () => {
  const html = await fs.readFile("public/index.html", "utf8");
  assert.match(html, /name="tags"/);
  assert.match(html, /id="painting-tag-strip"/);
  assert.match(html, /id="material-tag-strip"/);
  assert.match(html, /class="tag-list painting-tags"/);
  assert.match(html, /class="tag-list material-tags"/);
});

test("frontend loads, filters, submits, and renders tags", async () => {
  const app = await fs.readFile("public/app.js", "utf8");
  assert.match(app, /selectedTag/);
  assert.match(app, /\/api\/tags\/paintings/);
  assert.match(app, /\/api\/tags\/materials/);
  assert.match(app, /params\.set\("tag", paintingState\.selectedTag\)/);
  assert.match(app, /params\.set\("tag", materialState\.selectedTag\)/);
  assert.match(app, /formData\.append\("tags"/);
  assert.match(app, /tags: editForm\.elements\.tags\.value/);
  assert.match(app, /function renderTagStrip/);
  assert.match(app, /function renderCardTags/);
});
