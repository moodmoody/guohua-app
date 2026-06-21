const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");

test("authenticated app opens to a quiet product intro home page", async () => {
  const [html, css, app] = await Promise.all([
    fs.readFile("public/index.html", "utf8"),
    fs.readFile("public/style.css", "utf8"),
    fs.readFile("public/app.js", "utf8"),
  ]);
  const homeStart = html.indexOf('id="tab-pane-home"');
  const paintingsStart = html.indexOf('id="tab-pane-paintings"');
  assert.ok(homeStart >= 0, "home pane should exist");
  assert.ok(paintingsStart > homeStart, "paintings pane should follow home pane");
  const homePane = html.slice(homeStart, paintingsStart);

  assert.match(html, /id="tab-btn-home"[\s\S]*class="[^"]*\btab-btn\b[^"]*\bactive\b[^"]*"[\s\S]*data-tab-target="home"/);
  assert.match(html, /id="tab-pane-home" class="tab-pane active" data-tab-pane="home"/);
  assert.doesNotMatch(html, /id="tab-pane-paintings" class="tab-pane active"/);
  assert.doesNotMatch(html, /id="section-title"/);
  assert.doesNotMatch(html, /<header class="topbar">[\s\S]*?<h1\b/);
  assert.doesNotMatch(html, /id="dashboard-search"/);
  assert.doesNotMatch(html, /class="dashboard-strip"/);
  assert.match(html, /class="[^"]*\bhome-minimal\b[^"]*"/);
  assert.match(html, /class="[^"]*\bhome-focus\b[^"]*"/);
  assert.match(homePane, /class="[^"]*\bhome-kicker\b[^"]*"/);
  assert.match(homePane, /class="[^"]*\bhome-intro\b[^"]*"/);
  assert.match(homePane, /class="[^"]*\bhome-notes\b[^"]*"/);
  assert.doesNotMatch(homePane, /class="[^"]*\bhome-quick-actions\b[^"]*"/);
  assert.doesNotMatch(homePane, /class="[^"]*\bhome-action-primary\b[^"]*"/);
  assert.doesNotMatch(homePane, /class="[^"]*\bhome-action-secondary\b[^"]*"/);
  assert.doesNotMatch(homePane, /class="[^"]*\bhome-benefit-line\b[^"]*"/);
  assert.doesNotMatch(homePane, /<button\b/);
  assert.doesNotMatch(homePane, /data-scroll-target=/);
  assert.match(homePane, /一卷收好丹青/);
  assert.doesNotMatch(homePane, /一卷收好丹青。/);
  assert.match(homePane, /class="[^"]*\bhome-title-row\b[^"]*"/);
  assert.match(homePane, /class="[^"]*\bhome-seal\b[^"]*"[\s\S]*>藏<\/span>/);
  assert.match(homePane, /产品说明|当前试用|即将扩展|长期方向|AI 赏析/);
  assert.match(homePane, /200M 空间/);
  assert.match(homePane, /10 个作品/);
  assert.match(homePane, /10 个素材/);
  assert.match(html, /class="[^"]*\bmobile-nav-btn\b[^"]*\btab-btn\b[^"]*\bactive\b[^"]*"[\s\S]*data-tab-target="home"/);

  assert.match(css, /\.home-minimal\s*\{[\s\S]*?display:\s*grid/);
  assert.match(css, /\.home-focus\s*\{[\s\S]*?background:[\s\S]*?logo-huaniao-user\.jpeg/);
  assert.match(css, /\.topbar\s*\{[\s\S]*?grid-template-columns:\s*minmax\(260px,\s*auto\)/);
  assert.match(css, /\.topbar\s*\{[\s\S]*?justify-content:\s*end/);
  assert.match(css, /\.home-title-row\s*\{[\s\S]*?display:\s*flex/);
  assert.match(css, /\.home-seal\s*\{[\s\S]*?width:\s*clamp\(26px,\s*2\.8vw,\s*34px\)/);
  assert.match(css, /\.home-seal\s*\{[\s\S]*?border-radius:\s*36%\s+42%\s+38%\s+45%\s*\/\s*43%\s+35%\s+46%\s+39%/);
  assert.match(css, /\.home-focus h2\s*\{[\s\S]*?font-family:\s*"STKaiti"/);
  assert.match(css, /\.home-focus h2\s*\{[\s\S]*?font-size:\s*clamp\(46px,\s*5\.2vw,\s*76px\)/);
  assert.match(css, /\.home-intro\s*\{[\s\S]*?line-height:\s*1\.8/);
  assert.match(css, /\.home-notes\s*\{[\s\S]*?display:\s*grid/);
  assert.doesNotMatch(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.topbar-search\s*\{/);
  assert.doesNotMatch(css, /\.home-quick-actions/);
  assert.doesNotMatch(css, /\.home-action-primary/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.home-focus\s*\{[\s\S]*?min-height:\s*calc\(100svh\s*-\s*230px\)/);
  assert.match(app, /function activateTab\(tabName\)/);
  assert.doesNotMatch(app, /sectionTitles/);
  assert.doesNotMatch(app, /sectionTitle/);
  assert.doesNotMatch(app, /dashboardSearch/);
});
