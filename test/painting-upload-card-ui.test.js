const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");

test("painting intake uses the redesigned upload card instead of the legacy plain form", async () => {
  const [html, css] = await Promise.all([
    fs.readFile("public/index.html", "utf8"),
    fs.readFile("public/style.css", "utf8"),
  ]);

  assert.match(html, /class="[^"]*\bupload-hero-card\b[^"]*"/);
  assert.match(html, /class="[^"]*\bupload-dropzone\b[^"]*"/);
  assert.match(html, /class="[^"]*\bupload-cloud\b[^"]*"/);
  assert.match(html, /class="[^"]*\bupload-file-trigger\b[^"]*"/);
  assert.match(html, /单文件大小上限 10M/);
  assert.match(html, /name="image"[\s\S]*type="file"[\s\S]*multiple[\s\S]*required/);
  assert.match(html, /type="submit"[\s\S]*收入作品册/);

  assert.match(css, /\.upload-hero-card\s*\{[\s\S]*?border:\s*1px\s+solid/);
  assert.match(css, /\.upload-panel::after\s*\{[\s\S]*?url\("\.\/assets\/logo-huaniao-user\.jpeg"\)\s+center\s*\/\s*cover\s+no-repeat/);
  assert.doesNotMatch(css, /\.upload-panel::after\s*\{[\s\S]*?right\s+bottom\s*\/\s*\d+px\s+auto\s+no-repeat/);
  assert.match(css, /\.upload-dropzone\s*\{[\s\S]*?border:\s*1px\s+dashed/);
  assert.match(css, /\.upload-dropzone\.dragging\s*\{/);
  assert.match(css, /\.upload-file-trigger\s*\{[\s\S]*?background:\s*linear-gradient\(145deg,\s*var\(--pine\)/);
  assert.doesNotMatch(html, /<h2>作品入藏<\/h2>\s*<form id="upload-form">\s*<div class="grid">/);
});

test("painting upload dropzone wires drag files into the existing file input", async () => {
  const app = await fs.readFile("public/app.js", "utf8");

  assert.match(app, /const dropzoneEl = input\.closest\("\.upload-dropzone"\)/);
  assert.match(app, /dropzoneEl\.classList\.add\("dragging"\)/);
  assert.match(app, /dropzoneEl\.addEventListener\("drop"/);
  assert.match(app, /updateFileInputFiles\(input, files\)/);
});
