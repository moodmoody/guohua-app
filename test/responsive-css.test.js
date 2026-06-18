const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function readStyle() {
  return await fs.readFile(path.join(process.cwd(), "public", "style.css"), "utf8");
}

test("mobile layout keeps navigation, attachments, and actions usable", async () => {
  const css = await readStyle();

  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.tabs\s*\{[\s\S]*?overflow-x:\s*auto/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.attachment-strip\s*\{[\s\S]*?flex-wrap:\s*nowrap/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.media-thumb\s*\{[\s\S]*?height:\s*clamp\(/);
  assert.match(css, /@media\s*\(max-width:\s*430px\)/);
  assert.match(css, /@media\s*\(max-width:\s*430px\)[\s\S]*?\.lightbox-close\s*\{[\s\S]*?min-height:\s*44px/);
});

test("xingshu font stack stays ahead of plain sans-serif fallbacks", async () => {
  const css = await readStyle();

  assert.match(css, /--font-xingshu:\s*"STXingkai",\s*"Xingkai SC",\s*"HanziPen SC",\s*"Kaiti SC",\s*"KaiTi"/);
  assert.match(css, /body\s*\{[\s\S]*?font-family:\s*var\(--font-xingshu\)/);
});

test("auth screen uses a dedicated stage layout with mobile-safe stacking", async () => {
  const css = await readStyle();

  assert.match(css, /\.auth-stage\s*\{/);
  assert.match(css, /\.auth-aside\s*\{/);
  assert.match(css, /\.auth-form\.hidden\s*\{[\s\S]*?display:\s*none/);
  assert.match(css, /@media\s*\(max-width:\s*860px\)[\s\S]*?\.auth-stage\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
});

test("mobile cards keep clear visual separation between works", async () => {
  const css = await readStyle();

  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.cards\s*\{[\s\S]*?gap:\s*20px/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.card\s*\{[\s\S]*?border-color:\s*rgba\(123,\s*78,\s*42,\s*0\.34\)/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.card\s*\{[\s\S]*?box-shadow:\s*0\s*12px\s*26px/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.card\s*\+\s*\.card\s*\{[\s\S]*?margin-top:\s*6px/);
});

test("authenticated mobile shell cannot expand wider than the viewport", async () => {
  const css = await readStyle();

  assert.match(css, /html,\s*body\s*\{[\s\S]*?overflow-x:\s*hidden/);
  assert.match(css, /\.container,\s*\.header,\s*\.panel,\s*\.tab-pane,\s*\.cards,\s*\.card\s*\{[\s\S]*?min-width:\s*0/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.user-summary\s*\{[\s\S]*?grid-template-columns:\s*42px\s+minmax\(0,\s*1fr\)\s+auto/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.membership-summary\s*\{[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?input,\s*select,\s*textarea,\s*button\s*\{[\s\S]*?max-width:\s*100%/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?input,\s*select,\s*textarea\s*\{[\s\S]*?font-size:\s*16px/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.header\s*\{[\s\S]*?overflow:\s*hidden/);
});
