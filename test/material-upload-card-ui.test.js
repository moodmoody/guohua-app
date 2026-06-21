const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");

test("material intake uses the redesigned upload card and keeps upload contract", async () => {
  const html = await fs.readFile("public/index.html", "utf8");
  const materialFormMatch = html.match(/<form id="material-upload-form"[\s\S]*?<\/form>/);

  assert.ok(materialFormMatch, "material upload form should exist");
  const materialForm = materialFormMatch[0];

  assert.match(materialForm, /class="[^"]*\bupload-hero-card\b[^"]*\bmaterial-upload-card\b[^"]*"/);
  assert.match(materialForm, /class="[^"]*\bupload-dropzone\b[^"]*"/);
  assert.match(materialForm, /class="[^"]*\bupload-cloud\b[^"]*"/);
  assert.match(materialForm, /class="[^"]*\bupload-file-trigger\b[^"]*"/);
  assert.match(materialForm, /100MB/);
  assert.match(
    materialForm,
    /name="asset"[\s\S]*type="file"[\s\S]*multiple[\s\S]*accept="image\/jpeg,image\/png,image\/webp,image\/heic,image\/heif,video\/mp4,video\/webm,video\/quicktime,video\/x-matroska"[\s\S]*required/,
  );
  assert.match(materialForm, /type="submit"[\s\S]*class="[^"]*\bupload-submit\b[^"]*"/);
  assert.doesNotMatch(html, /<h2>[\s\S]*?<\/h2>\s*<form id="material-upload-form">\s*<div class="grid">/);
});
