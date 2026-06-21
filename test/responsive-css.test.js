const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function readStyle() {
  return await fs.readFile(path.join(process.cwd(), "public", "style.css"), "utf8");
}

async function readHtml() {
  return await fs.readFile(path.join(process.cwd(), "public", "index.html"), "utf8");
}

function readCssBlock(css, selector) {
  const match = css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `${selector} block should exist`);
  return match[1];
}

test("authenticated app shell matches the generated workbench structure", async () => {
  const html = await readHtml();
  const css = await readStyle();

  assert.match(html, /id="app-shell" class="app-shell hidden"/);
  assert.match(html, /class="app-layout"/);
  assert.match(html, /class="app-sidebar"/);
  assert.match(html, /class="[^"]*sidebar-nav[^"]*"/);
  assert.match(html, /class="app-main"/);
  assert.match(html, /class="topbar"/);
  assert.doesNotMatch(html, /<header class="topbar">[\s\S]*?<span class="ink-mark"/);
  assert.doesNotMatch(html, /id="section-title"/);
  assert.doesNotMatch(html, /<header class="topbar">[\s\S]*?<h1\b/);
  assert.doesNotMatch(html, /id="dashboard-search"/);
  assert.doesNotMatch(html, /class="dashboard-strip"/);
  assert.match(html, /id="tab-pane-home" class="tab-pane active" data-tab-pane="home"/);
  assert.match(html, /id="tab-btn-home"[\s\S]*data-tab-target="home"/);
  assert.match(html, /class="paintings-workbench"/);
  assert.match(html, /class="[^"]*upload-panel[^"]*"/);
  assert.match(html, /class="[^"]*gallery-panel[^"]*"/);
  assert.match(html, /class="mobile-bottom-nav"/);

  assert.match(css, /\.app-layout\s*\{[\s\S]*?display:\s*grid[\s\S]*?grid-template-columns:\s*212px\s+minmax\(0,\s*1fr\)/);
  assert.match(css, /\.app-sidebar\s*\{[\s\S]*?position:\s*sticky[\s\S]*?background:\s*linear-gradient\([\s\S]*?var\(--pine-deep\)/);
  assert.match(css, /\.home-minimal\s*\{[\s\S]*?display:\s*grid/);
  assert.match(css, /\.home-focus\s*\{[\s\S]*?background:/);
  assert.match(css, /\.paintings-workbench\s*\{[\s\S]*?display:\s*grid[\s\S]*?grid-template-columns:\s*minmax\(280px,\s*0\.78fr\)\s+minmax\(0,\s*1\.22fr\)/);
});

test("mobile layout keeps navigation, attachments, and actions usable", async () => {
  const css = await readStyle();

  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.app-sidebar\s*\{[\s\S]*?display:\s*none/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.mobile-bottom-nav\s*\{[\s\S]*?display:\s*grid/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.app-shell\s*\{[\s\S]*?padding:\s*10px\s+10px\s+92px/);
  assert.doesNotMatch(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.dashboard-strip\s*\{/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.home-focus\s*\{[\s\S]*?min-height:\s*calc\(100svh\s*-\s*230px\)/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.paintings-workbench\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.attachment-strip\s*\{[\s\S]*?min-height:\s*32px/);
  assert.doesNotMatch(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.attachment-strip\s*\{[\s\S]*?overflow-x:\s*auto/);
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

test("auth screen keeps desktop and tablet login layouts balanced", async () => {
  const css = await readStyle();
  const authFormBlock = readCssBlock(css, ".auth-form");

  assert.match(css, /\.auth-screen\s*\{[\s\S]*?min-height:\s*100svh/);
  assert.match(css, /\.auth-panel\s*\{[\s\S]*?width:\s*min\(1120px,\s*calc\(100vw\s*-\s*32px\)\)/);
  assert.match(css, /\.auth-panel\s*\{[\s\S]*?max-height:\s*calc\(100svh\s*-\s*48px\)/);
  assert.match(css, /\.auth-panel\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /\.auth-stage\s*\{[\s\S]*?grid-template-columns:\s*minmax\(250px,\s*0\.88fr\)\s+minmax\(340px,\s*420px\)/);
  assert.match(css, /\.auth-stage\s*\{[\s\S]*?justify-content:\s*center/);
  assert.match(css, /\.auth-stage\s*\{[\s\S]*?align-items:\s*start/);
  assert.match(authFormBlock, /min-height:\s*auto/);
  assert.doesNotMatch(authFormBlock, /min-height:\s*100%/);
  assert.match(css, /@media\s*\(min-width:\s*861px\)\s*and\s*\(max-width:\s*1100px\)[\s\S]*?\.auth-stage\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*0\.95fr\)\s+minmax\(320px,\s*0\.85fr\)/);
  assert.match(css, /@media\s*\(max-width:\s*860px\)[\s\S]*?\.auth-panel\s*\{[\s\S]*?width:\s*min\(680px,\s*calc\(100vw\s*-\s*24px\)\)/);
  assert.match(css, /@media\s*\(max-width:\s*860px\)[\s\S]*?\.auth-stage-main\s*\{[\s\S]*?max-width:\s*520px/);
  assert.match(css, /@media\s*\(max-width:\s*860px\)[\s\S]*?\.auth-aside\s*\{[\s\S]*?max-width:\s*520px/);
});

test("mobile cards keep clear visual separation between works", async () => {
  const css = await readStyle();

  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.cards\s*\{[\s\S]*?display:\s*grid[\s\S]*?gap:\s*12px/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.card\s*\{[\s\S]*?border-color:\s*rgba\(123,\s*78,\s*42,\s*0\.34\)/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.card\s*\{[\s\S]*?display:\s*grid[\s\S]*?grid-template-columns:\s*104px\s+minmax\(0,\s*1fr\)/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.card\s*\{[\s\S]*?box-shadow:\s*0\s*10px\s*24px/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.card-content\s*\{[\s\S]*?grid-column:\s*2/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.card-content\s*\{[\s\S]*?padding:\s*10px\s+12px/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.card-meta-tags\s*\{[\s\S]*?flex:\s*1\s+1\s+100%/);
});

test("mobile multi-attachment controls stay compact and allow switching previews", async () => {
  const css = await readStyle();

  assert.doesNotMatch(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.attachment-nav,\s*\.image-tip\s*\{[\s\S]*?display:\s*none/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.attachment-nav\s*\{[\s\S]*?display:\s*grid/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.attachment-strip\s*\{[\s\S]*?min-height:\s*32px/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.attachment-count\s*\{[\s\S]*?font-size:\s*11px/);
});

test("mobile comments span the whole painting card", async () => {
  const css = await readStyle();

  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.comments\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.comments\s*\{[\s\S]*?grid-row:\s*3/);
});

test("authenticated mobile shell cannot expand wider than the viewport", async () => {
  const css = await readStyle();

  assert.match(css, /html,\s*body\s*\{[\s\S]*?overflow-x:\s*hidden/);
  assert.match(css, /\.app-shell,\s*\.app-layout,\s*\.app-main,\s*\.topbar,\s*\.panel,\s*\.tab-pane,\s*\.cards,\s*\.card\s*\{[\s\S]*?min-width:\s*0/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.user-summary\s*\{[\s\S]*?grid-template-columns:\s*34px\s+minmax\(0,\s*1fr\)/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.membership-summary\s*\{[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?input,\s*select,\s*textarea,\s*button\s*\{[\s\S]*?max-width:\s*100%/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?input,\s*select,\s*textarea\s*\{[\s\S]*?font-size:\s*16px/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.topbar\s*\{[\s\S]*?overflow:\s*hidden/);
});
