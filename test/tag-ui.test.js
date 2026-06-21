const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");

test("tag inputs and tag strips are present in painting and material UI", async () => {
  const html = await fs.readFile("public/index.html", "utf8");
  assert.match(html, /name="tags"/);
  assert.match(html, /id="painting-tag-strip"/);
  assert.match(html, /id="material-tag-strip"/);
  assert.match(html, /class="[^"]*\btag-list\b[^"]*\bpainting-tags\b[^"]*"/);
  assert.match(html, /class="[^"]*\btag-list\b[^"]*\bmaterial-tags\b[^"]*"/);
});

test("card category and tags sit beside the title without framed chips", async () => {
  const [html, css, app] = await Promise.all([
    fs.readFile("public/index.html", "utf8"),
    fs.readFile("public/style.css", "utf8"),
    fs.readFile("public/app.js", "utf8"),
  ]);

  assert.match(html, /class="card-heading"[\s\S]*?class="painting-title"[\s\S]*?class="[^"]*\bcard-meta-tags\b[^"]*\bpainting-meta-tags\b[^"]*"/);
  assert.match(html, /class="card-heading"[\s\S]*?class="material-title"[\s\S]*?class="[^"]*\bcard-meta-tags\b[^"]*\bmaterial-meta-tags\b[^"]*"/);
  assert.match(app, /category:\s*item\.category/);
  assert.match(app, /className = "card-category-pill"/);
  assert.match(css, /\.card-heading\s*\{[\s\S]*?display:\s*flex/);
  assert.match(css, /\.card-category-pill\s*\{[\s\S]*?border:\s*0/);
  assert.match(css, /\.card-tag\s*\{[\s\S]*?border:\s*0/);
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
