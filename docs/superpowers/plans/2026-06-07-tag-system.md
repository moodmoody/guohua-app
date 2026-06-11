# Tag System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lightweight tags to paintings and materials, with card display and a mobile-friendly tag filter strip.

**Architecture:** Store normalized `tags` arrays directly on painting/material records in the existing JSON data file. Extend existing list endpoints with `tag` filtering and tag-aware search, then wire the current vanilla HTML/CSS/JS frontend to submit, render, and filter by tags.

**Tech Stack:** Node.js, Express, vanilla JavaScript, HTML templates, CSS, `node:test`.

---

## File Map

- `server.js`: add tag normalization helpers; normalize records when reading/listing; persist tags on create/update; add tag list endpoints; apply `tag` filters.
- `public/index.html`: add tag inputs to create/edit forms and tag strip containers to painting/material filter panels; add tag containers to card templates.
- `public/app.js`: keep selected tag state, fetch tag summaries, build `tag` query params, submit tags, render tag strips, render clickable card tags.
- `public/style.css`: style scrollable tag strips and card tag pills in the existing xuan-paper tone.
- `test/tag-system.test.js`: server behavior tests for normalization, persistence, filtering, search, and owner scoping.
- `test/tag-ui.test.js`: static frontend tests for markup and JS hooks.

## Task 1: Server Tag Model And API

**Files:**
- Create: `test/tag-system.test.js`
- Modify: `server.js`

- [ ] **Step 1: Write failing server tests**

Create `test/tag-system.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { startFixture, stopFixture, TEST_INVITE_CODE } = require("./support/server-fixture");

async function registerAndLogin(baseUrl, username) {
  const password = "tag-pass-123";
  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      displayName: username,
      password,
      inviteCode: TEST_INVITE_CODE,
    }),
  });
  assert.equal(register.status, 201);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(login.status, 200);
  return login.headers.get("set-cookie").split(";")[0];
}

function makePngBlob(seed) {
  return new Blob([Buffer.from([137, 80, 78, 71, seed])], { type: "image/png" });
}

async function createPainting(baseUrl, cookie, title, tags) {
  const form = new FormData();
  form.append("title", title);
  form.append("category", "山水");
  form.append("description", "taggable painting");
  form.append("tags", tags);
  form.append("image", makePngBlob(1), `${title}.png`);
  const res = await fetch(`${baseUrl}/api/paintings`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  assert.equal(res.status, 201);
  return await res.json();
}

async function createMaterial(baseUrl, cookie, title, tags) {
  const form = new FormData();
  form.append("title", title);
  form.append("category", "纹理");
  form.append("description", "taggable material");
  form.append("tags", tags);
  form.append("asset", makePngBlob(2), `${title}.png`);
  const res = await fetch(`${baseUrl}/api/materials`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  assert.equal(res.status, 201);
  return await res.json();
}

test("paintings persist normalized tags and filter/search by tag", async () => {
  const fixture = await startFixture();
  try {
    const cookie = await registerAndLogin(fixture.baseUrl, "tag-painter");
    const painting = await createPainting(fixture.baseUrl, cookie, "溪山标签", "写意, 临摹、写意 / 待装裱");
    assert.deepEqual(painting.tags, ["写意", "临摹", "待装裱"]);

    const byTag = await fetch(`${fixture.baseUrl}/api/paintings?tag=${encodeURIComponent("临摹")}`, {
      headers: { Cookie: cookie },
    });
    assert.equal(byTag.status, 200);
    const byTagBody = await byTag.json();
    assert.equal(byTagBody.total, 1);
    assert.equal(byTagBody.items[0].title, "溪山标签");

    const bySearch = await fetch(`${fixture.baseUrl}/api/paintings?q=${encodeURIComponent("待装裱")}`, {
      headers: { Cookie: cookie },
    });
    assert.equal(bySearch.status, 200);
    const bySearchBody = await bySearch.json();
    assert.equal(bySearchBody.total, 1);

    const patch = await fetch(`${fixture.baseUrl}/api/paintings/${painting.id}`, {
      method: "PATCH",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ tags: ["已售", "写意", "已售"] }),
    });
    assert.equal(patch.status, 200);
    const patched = await patch.json();
    assert.deepEqual(patched.tags, ["已售", "写意"]);
  } finally {
    await stopFixture(fixture);
  }
});

test("materials persist normalized tags and filter/search by tag", async () => {
  const fixture = await startFixture();
  try {
    const cookie = await registerAndLogin(fixture.baseUrl, "tag-material");
    const material = await createMaterial(fixture.baseUrl, cookie, "皴法参考", "皴法  视频，素材");
    assert.deepEqual(material.tags, ["皴法", "视频", "素材"]);

    const byTag = await fetch(`${fixture.baseUrl}/api/materials?tag=${encodeURIComponent("视频")}`, {
      headers: { Cookie: cookie },
    });
    assert.equal(byTag.status, 200);
    const byTagBody = await byTag.json();
    assert.equal(byTagBody.total, 1);
    assert.equal(byTagBody.items[0].title, "皴法参考");

    const bySearch = await fetch(`${fixture.baseUrl}/api/materials?q=${encodeURIComponent("皴法")}`, {
      headers: { Cookie: cookie },
    });
    assert.equal(bySearch.status, 200);
    const bySearchBody = await bySearch.json();
    assert.equal(bySearchBody.total, 1);
  } finally {
    await stopFixture(fixture);
  }
});

test("tag summary endpoints are scoped to the current user", async () => {
  const fixture = await startFixture();
  try {
    const firstCookie = await registerAndLogin(fixture.baseUrl, "tag-owner-a");
    const secondCookie = await registerAndLogin(fixture.baseUrl, "tag-owner-b");

    await createPainting(fixture.baseUrl, firstCookie, "甲作品", "自用 共享");
    await createPainting(fixture.baseUrl, secondCookie, "乙作品", "他人");
    await createMaterial(fixture.baseUrl, firstCookie, "甲素材", "纹理 共享");
    await createMaterial(fixture.baseUrl, secondCookie, "乙素材", "私有");

    const paintingTags = await fetch(`${fixture.baseUrl}/api/tags/paintings`, {
      headers: { Cookie: firstCookie },
    });
    assert.equal(paintingTags.status, 200);
    assert.deepEqual(await paintingTags.json(), ["共享", "自用"]);

    const materialTags = await fetch(`${fixture.baseUrl}/api/tags/materials`, {
      headers: { Cookie: firstCookie },
    });
    assert.equal(materialTags.status, 200);
    assert.deepEqual(await materialTags.json(), ["共享", "纹理"]);
  } finally {
    await stopFixture(fixture);
  }
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node --test test\tag-system.test.js
```

Expected: fails because created records do not include normalized `tags`, `tag` filters are ignored, or `/api/tags/*` returns 404.

- [ ] **Step 3: Add tag helpers to `server.js`**

Near existing text helpers, add:

```js
const MAX_TAGS_PER_ITEM = 12;

function normalizeTags(value) {
  const rawItems = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[\s,，、;；/]+/u);
  const seen = new Set();
  const tags = [];

  rawItems.forEach((item) => {
    const tag = trimText(item);
    if (!tag || seen.has(tag)) {
      return;
    }
    seen.add(tag);
    tags.push(tag);
  });

  return tags.slice(0, MAX_TAGS_PER_ITEM);
}

function getItemTags(item) {
  return normalizeTags(item && item.tags);
}

function itemHasTag(item, tag) {
  if (!tag) {
    return true;
  }
  return getItemTags(item).some((itemTag) => itemTag.toLowerCase() === tag);
}

function collectTags(items) {
  const tags = new Set();
  items.forEach((item) => {
    getItemTags(item).forEach((tag) => tags.add(tag));
  });
  return [...tags].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function serializeItemWithTags(item) {
  return {
    ...item,
    tags: getItemTags(item),
  };
}
```

- [ ] **Step 4: Make keyword matching tag-aware**

Find `matchesKeyword(item, q)` and include:

```js
getItemTags(item).some((tag) => tag.toLowerCase().includes(q))
```

inside the returned OR expression.

- [ ] **Step 5: Apply tags to painting endpoints**

In `GET /api/paintings`:

```js
const tag = trimText(req.query.tag).toLowerCase();
```

After category filtering:

```js
if (tag) {
  result = result.filter((item) => itemHasTag(item, tag));
}
```

Before pagination:

```js
result = result.map(serializeItemWithTags);
```

In `GET /api/paintings/:id`, return `serializeItemWithTags(painting)`.

Add endpoint after `/api/categories`:

```js
app.get("/api/tags/paintings", requireUser, async (req, res, next) => {
  try {
    const db = await readDb();
    res.json(collectTags(ownedItems(db.paintings, req.currentUser)));
  } catch (error) {
    next(error);
  }
});
```

In `POST /api/paintings`, add:

```js
const tags = normalizeTags(req.body.tags);
```

and store `tags` in `newItem`.

In `PATCH /api/paintings/:id`, add:

```js
const hasTags = Object.prototype.hasOwnProperty.call(req.body, "tags");
```

and before updating `updatedAt`:

```js
if (hasTags) {
  painting.tags = normalizeTags(req.body.tags);
}
```

Return `serializeItemWithTags(painting)`.

- [ ] **Step 6: Apply tags to material endpoints**

Mirror Step 5 for materials:

- `GET /api/materials` reads `tag`, filters with `itemHasTag`, maps with `serializeItemWithTags`.
- `GET /api/materials/:id` returns `serializeItemWithTags(material)`.
- Add `GET /api/tags/materials`.
- `POST /api/materials` stores `tags: normalizeTags(req.body.tags)`.
- `PATCH /api/materials/:id` accepts and stores tags when provided.

- [ ] **Step 7: Run server tests and verify GREEN**

Run:

```powershell
node --test test\tag-system.test.js
```

Expected: all tests pass.

## Task 2: Frontend Markup And JavaScript

**Files:**
- Create: `test/tag-ui.test.js`
- Modify: `public/index.html`
- Modify: `public/app.js`

- [ ] **Step 1: Write failing frontend static tests**

Create `test/tag-ui.test.js`:

```js
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
```

- [ ] **Step 2: Run frontend tests and verify RED**

Run:

```powershell
node --test test\tag-ui.test.js
```

Expected: fails because the tag inputs, strips, and JS hooks do not exist.

- [ ] **Step 3: Add tag markup to `public/index.html`**

Painting create form: add a label after category:

```html
<label>
  标签
  <input name="tags" type="text" placeholder="如：写意 临摹 待装裱" />
</label>
```

Painting filter panel: add after `.toolbar-actions`:

```html
<div id="painting-tag-strip" class="tag-strip" aria-label="作品标签筛选"></div>
```

Painting template: add after `.description`:

```html
<div class="tag-list painting-tags"></div>
```

Painting edit form: add a tag label after description:

```html
<label>
  标签
  <input name="tags" type="text" placeholder="如：写意 临摹 待装裱" />
</label>
```

Repeat equivalent additions for material create/filter/template/edit:

```html
<div id="material-tag-strip" class="tag-strip" aria-label="素材标签筛选"></div>
<div class="tag-list material-tags"></div>
```

- [ ] **Step 4: Add frontend tag state and DOM references**

At the top of `public/app.js`, add references:

```js
const paintingTagStrip = document.getElementById("painting-tag-strip");
const materialTagStrip = document.getElementById("material-tag-strip");
```

Extend state:

```js
const paintingState = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 12,
  totalPages: 1,
  tags: [],
  selectedTag: "",
};
```

Do the same for `materialState`.

- [ ] **Step 5: Add reusable tag UI helpers**

Add near `renderCategories`:

```js
function tagsToInputValue(tags) {
  return Array.isArray(tags) ? tags.join(" ") : "";
}

function renderTagStrip({ container, tags, selectedTag, onSelect }) {
  if (!container) {
    return;
  }
  container.innerHTML = "";
  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = `tag-pill${selectedTag ? "" : " active"}`;
  allButton.textContent = "全部标签";
  allButton.addEventListener("click", () => onSelect(""));
  container.appendChild(allButton);

  tags.forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tag-pill${tag === selectedTag ? " active" : ""}`;
    button.textContent = tag;
    button.addEventListener("click", () => onSelect(tag));
    container.appendChild(button);
  });
}

function renderCardTags({ container, tags, keyword, onSelect }) {
  if (!container) {
    return;
  }
  container.innerHTML = "";
  const normalizedTags = Array.isArray(tags) ? tags : [];
  container.classList.toggle("hidden", normalizedTags.length === 0);
  normalizedTags.forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tag-pill card-tag";
    setHighlightedText(button, tag, keyword);
    button.addEventListener("click", () => onSelect(tag));
    container.appendChild(button);
  });
}
```

- [ ] **Step 6: Wire painting query, form submit, edit, and rendering**

In `buildPaintingQuery`, add:

```js
if (paintingState.selectedTag) {
  params.set("tag", paintingState.selectedTag);
}
```

In `fillPaintingEditForm`, add:

```js
form.elements.tags.value = tagsToInputValue(item.tags);
```

In `renderPaintings`, get the tag container:

```js
const tagsEl = fragment.querySelector(".painting-tags");
```

After description rendering:

```js
renderCardTags({
  container: tagsEl,
  tags: item.tags,
  keyword,
  onSelect: async (tag) => {
    paintingState.selectedTag = tag;
    paintingState.page = 1;
    renderPaintingTagStrip();
    await loadPaintings();
  },
});
```

In painting edit payload:

```js
tags: editForm.elements.tags.value.trim(),
```

In upload form submit handler, append:

```js
formData.append("tags", uploadForm.elements.tags.value.trim());
```

Add:

```js
function renderPaintingTagStrip() {
  renderTagStrip({
    container: paintingTagStrip,
    tags: paintingState.tags,
    selectedTag: paintingState.selectedTag,
    onSelect: async (tag) => {
      paintingState.selectedTag = tag;
      paintingState.page = 1;
      renderPaintingTagStrip();
      await loadPaintings();
    },
  });
}

async function loadPaintingTags() {
  paintingState.tags = await fetchJson("/api/tags/paintings");
  renderPaintingTagStrip();
}
```

Update any refresh after create/update/delete to include `loadPaintingTags()`.

- [ ] **Step 7: Wire material query, form submit, edit, and rendering**

Mirror Step 6 for materials:

- `buildMaterialQuery` includes `materialState.selectedTag`.
- `fillMaterialEditForm` writes tags.
- material card renders `.material-tags`.
- material edit payload includes `tags`.
- material create form appends `tags`.
- add `renderMaterialTagStrip()` and `loadMaterialTags()`.
- material refreshes include `loadMaterialTags()`.

- [ ] **Step 8: Reset clears selected tags**

In painting reset handler, set:

```js
paintingState.selectedTag = "";
renderPaintingTagStrip();
```

In material reset handler, set:

```js
materialState.selectedTag = "";
renderMaterialTagStrip();
```

- [ ] **Step 9: Run frontend tests and verify GREEN**

Run:

```powershell
node --test test\tag-ui.test.js
```

Expected: all tests pass.

## Task 3: Styling, Integration Tests, And Manual Verification

**Files:**
- Modify: `public/style.css`
- Modify if cache tests require: `public/index.html`
- Test: existing `test/*.test.js`

- [ ] **Step 1: Add tag styles**

Add near toolbar/card metadata styles:

```css
.tag-strip,
.tag-list {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.tag-strip {
  margin-top: 0.75rem;
  overflow-x: auto;
  padding: 0.1rem 0 0.35rem;
  scrollbar-width: thin;
}

.tag-list {
  flex-wrap: wrap;
  margin: 0.7rem 0 0;
}

.tag-pill {
  border: 1px solid rgba(130, 88, 45, 0.38);
  border-radius: 999px;
  background: rgba(255, 250, 238, 0.82);
  color: #5d3f28;
  cursor: pointer;
  flex: 0 0 auto;
  font-family: inherit;
  font-size: 0.9rem;
  line-height: 1;
  padding: 0.45rem 0.72rem;
  transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
}

.tag-pill:hover,
.tag-pill.active {
  background: rgba(125, 56, 38, 0.12);
  border-color: rgba(125, 56, 38, 0.62);
  color: #7d3826;
}

.card-tag {
  font-size: 0.82rem;
  padding: 0.35rem 0.58rem;
}

.tag-list.hidden {
  display: none;
}
```

In the existing mobile media query, ensure `.tag-strip` has enough touch room:

```css
.tag-strip {
  margin-inline: -0.1rem;
  padding-bottom: 0.5rem;
}
```

- [ ] **Step 2: Update cache version if needed**

If `test/static-cache.test.js` expects exact asset versions, update `public/index.html` and share-page CSS/JS versions consistently to a new suffix such as:

```html
?v=20260607-tags
```

- [ ] **Step 3: Run focused tests**

Run:

```powershell
node --test test\tag-system.test.js test\tag-ui.test.js test\pagination.test.js test\ownership.test.js test\static-cache.test.js
```

Expected: all tests pass.

- [ ] **Step 4: Run broader regression suite**

Run:

```powershell
node --test test
```

Expected: all tests pass.

- [ ] **Step 5: Start local app for visual verification**

Run:

```powershell
npm start
```

Open the local app and verify:

- create painting with tags;
- create material with tags;
- card tag pills show;
- tag strip filters on desktop;
- mobile viewport can horizontally scroll tag strip;
- reset clears selected tag;
- edit form persists tag changes.

- [ ] **Step 6: Final cleanup**

Run:

```powershell
git -c safe.directory=C:/Users/weife/Documents/Codex/guohua-app status --short
```

Confirm runtime `data/paintings.json` is not staged unless explicitly requested. Keep `.superpowers/brainstorm` preview artifacts out of the final commit unless the user asks to keep them.
