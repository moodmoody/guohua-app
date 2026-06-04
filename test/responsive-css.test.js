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

  assert.match(css, /--font-xingshu:\s*"STXingkai",\s*"Xingkai SC",\s*"HanziPen SC",\s*"Kaiti SC",\s*"KaiTi",\s*"华文行楷"/);
  assert.match(css, /body\s*\{[\s\S]*?font-family:\s*var\(--font-xingshu\)/);
});
