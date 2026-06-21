const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");

test("multi-attachment preview exposes carousel controls and swipe behavior", async () => {
  const [html, app, css] = await Promise.all([
    fs.readFile("public/index.html", "utf8"),
    fs.readFile("public/app.js", "utf8"),
    fs.readFile("public/style.css", "utf8"),
  ]);

  assert.match(html, /attachment-nav attachment-prev/);
  assert.match(html, /attachment-nav attachment-next/);
  assert.match(html, /attachment-status painting-status/);
  assert.match(app, /function bindAttachmentGesture\(/);
  assert.match(app, /pointerdown/);
  assert.match(app, /pointerup/);
  assert.match(css, /touch-action:\s*pan-y pinch-zoom/);
  assert.match(app, /ArrowLeft/);
  assert.match(app, /ArrowRight/);
  assert.match(css, /\.attachment-nav\s*\{/);
  assert.match(css, /\.attachment-status\s*\{/);
});

test("attachment strip summarizes file count instead of rendering per-file buttons", async () => {
  const [app, css] = await Promise.all([
    fs.readFile("public/app.js", "utf8"),
    fs.readFile("public/style.css", "utf8"),
  ]);

  assert.match(app, /attachment-count/);
  assert.match(app, /共 \$\{attachments\.length\} 个文件/);
  assert.doesNotMatch(app, /attachment-chip/);
  assert.doesNotMatch(app, /attachment-remove/);
  assert.doesNotMatch(app, /onSelect:\s*\(nextIndex\)/);
  assert.doesNotMatch(css, /\.attachment-chip/);
  assert.doesNotMatch(css, /\.attachment-remove/);
});

test("opened attachment preview supports grouped lightbox navigation", async () => {
  const [html, app, css] = await Promise.all([
    fs.readFile("public/index.html", "utf8"),
    fs.readFile("public/app.js", "utf8"),
    fs.readFile("public/style.css", "utf8"),
  ]);

  assert.match(html, /id="lightbox-prev"/);
  assert.match(html, /id="lightbox-next"/);
  assert.match(html, /id="lightbox-status"/);
  assert.match(app, /let lightboxState =/);
  assert.match(app, /function renderLightboxMedia\(/);
  assert.match(app, /function showLightboxAttachment\(/);
  assert.match(app, /openLightbox\(\{\s*attachments,\s*index: selectedIndex,/);
  assert.match(app, /bindLightboxGesture\(/);
  assert.match(app, /lightboxPrev\.addEventListener/);
  assert.match(app, /lightboxNext\.addEventListener/);
  assert.match(app, /event\.key === "ArrowLeft"[\s\S]*showLightboxAttachment\(-1\)/);
  assert.match(app, /event\.key === "ArrowRight"[\s\S]*showLightboxAttachment\(1\)/);
  assert.match(css, /\.lightbox-nav\s*\{/);
  assert.match(css, /\.lightbox-status\s*\{/);
  assert.match(css, /\.lightbox-content[\s\S]*touch-action:\s*pan-y pinch-zoom/);
});
