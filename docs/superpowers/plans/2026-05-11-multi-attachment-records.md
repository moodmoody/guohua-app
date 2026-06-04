# Multi-Attachment Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert paintings and materials upload flows so one record owns multiple attachments, and support append/delete attachment operations per record.

**Architecture:** Keep JSON-file persistence but normalize records to an `attachments[]` model with backward-compatible legacy field backfill. Add dedicated append/delete attachment endpoints for both resources and remove single-file replacement from edit endpoints. Update frontend rendering/editing to operate attachments-first while keeping existing list/filter/pagination flows.

**Tech Stack:** Node.js, Express, Multer, vanilla JS frontend, Node test runner (`node:test`)

---

## File Structure Map

- Modify: `server.js`
  - Add attachment normalization helpers
  - Update create/list/delete logic for paintings/materials
  - Add append/delete attachment endpoints
  - Remove single-file replacement path from patch endpoints
- Modify: `public/app.js`
  - Render records with multiple attachments
  - Add append attachment form handling
  - Add delete attachment actions
- Modify: `public/index.html`
  - Expand painting/material templates with attachment strip/actions and append upload controls
- Modify: `public/style.css`
  - Add multi-attachment card UI styles
- Modify: `test/multi-upload.test.js`
  - Replace old multi-upload assertions (array response) with new single-record assertions
  - Add attachment append/delete + legacy compatibility tests

### Task 1: Red Tests For Backend Record Shape

**Files:**
- Modify: `test/multi-upload.test.js`

- [ ] **Step 1: Write failing tests for create APIs returning one record with `attachments[]`**

```js
test("POST /api/paintings creates one record with many attachments", async () => {
  const svc = await startServer();
  try {
    const form = new FormData();
    form.set("title", "批量作品");
    form.set("category", "山水");
    form.append("image", makeImageFile("a.jpg"));
    form.append("image", makeImageFile("b.jpg"));

    const res = await fetch(`http://127.0.0.1:${svc.port}/api/paintings`, {
      method: "POST",
      body: form,
    });

    assert.equal(res.status, 201);
    const payload = await res.json();
    assert.equal(Array.isArray(payload), false);
    assert.equal(payload.title, "批量作品");
    assert.equal(payload.attachments.length, 2);
  } finally {
    await svc.stop();
  }
});
```

- [ ] **Step 2: Run targeted tests to verify failure**

Run: `node --test test/multi-upload.test.js`
Expected: FAIL because API currently returns arrays and no `attachments`.

- [ ] **Step 3: Commit red test changes**

```bash
git add test/multi-upload.test.js
git commit -m "test: define single-record multi-attachment create behavior"
```

### Task 2: Green Backend For Create + Normalize + Delete Record Files

**Files:**
- Modify: `server.js`
- Test: `test/multi-upload.test.js`

- [ ] **Step 1: Implement attachment helpers and normalization in `server.js`**

```js
function makeAttachment({ filename, mimetype, createdAt = new Date().toISOString() }) {
  return {
    id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    url: `/uploads/${filename}`,
    assetType: mimetype?.startsWith("video/") ? "video" : "image",
    createdAt,
  };
}

function normalizeAttachments(item, kind) {
  const attachments = Array.isArray(item.attachments) ? item.attachments.filter((a) => a?.url) : [];
  if (attachments.length) {
    return attachments;
  }

  if (kind === "painting" && item.imageUrl) {
    return [{ id: `legacy_${item.id}`, url: item.imageUrl, assetType: "image", createdAt: item.createdAt || new Date().toISOString() }];
  }

  if (kind === "material" && item.assetUrl) {
    return [{ id: `legacy_${item.id}`, url: item.assetUrl, assetType: item.assetType === "video" ? "video" : "image", createdAt: item.createdAt || new Date().toISOString() }];
  }

  return [];
}
```

- [ ] **Step 2: Update create endpoints to create one record with `attachments`**

```js
const created = {
  id: nextId,
  title,
  category,
  description,
  attachments: files.map((file) => makeAttachment({ filename: file.filename, mimetype: file.mimetype, createdAt })),
  createdAt,
};
```

- [ ] **Step 3: Backfill legacy fields during normalization/write**

```js
painting.imageUrl = painting.attachments[0]?.url || "";
material.assetUrl = material.attachments[0]?.url || "";
material.assetType = material.attachments[0]?.assetType || "image";
```

- [ ] **Step 4: Update record delete endpoints to remove all attachment files**

```js
await Promise.all((deleted.attachments || []).map((att) => removeFileByUrl(att.url)));
```

- [ ] **Step 5: Run targeted tests to verify green**

Run: `node --test test/multi-upload.test.js`
Expected: PASS for updated create-shape tests.

- [ ] **Step 6: Commit backend green changes**

```bash
git add server.js test/multi-upload.test.js
git commit -m "feat: store multiple attachments under a single record"
```

### Task 3: Red Tests For Attachment Append/Delete APIs

**Files:**
- Modify: `test/multi-upload.test.js`

- [ ] **Step 1: Add failing tests for append attachments endpoint**

```js
test("POST /api/materials/:id/attachments appends attachments", async () => {
  // create record with one asset
  // append two files
  // assert attachments length increases by 2
});
```

- [ ] **Step 2: Add failing tests for delete attachment and last-attachment guard**

```js
test("DELETE /api/paintings/:id/attachments/:attachmentId deletes one attachment", async () => {
  // create with 2
  // delete 1
  // expect 200 and remaining 1
});

test("DELETE attachment rejects removing last attachment", async () => {
  // create with 1
  // delete that 1
  // expect 400
});
```

- [ ] **Step 3: Run tests to verify expected failures**

Run: `node --test test/multi-upload.test.js`
Expected: FAIL because endpoints do not exist yet.

- [ ] **Step 4: Commit red test changes**

```bash
git add test/multi-upload.test.js
git commit -m "test: define attachment append and delete API behavior"
```

### Task 4: Green Backend For Attachment Append/Delete APIs

**Files:**
- Modify: `server.js`
- Test: `test/multi-upload.test.js`

- [ ] **Step 1: Add append endpoints for both resources**

```js
app.post("/api/paintings/:id/attachments", uploadPainting.array("image", MAX_UPLOAD_FILES_PER_REQUEST), async (req, res, next) => {
  // validate id, record exists, files.length > 0
  // append mapped attachments
  // write db and return updated record
});
```

- [ ] **Step 2: Add delete attachment endpoints for both resources with guard**

```js
if (record.attachments.length <= 1) {
  return res.status(400).json({ error: "At least one attachment must remain" });
}
```

- [ ] **Step 3: Ensure file cleanup when deleting attachment**

```js
const [removed] = record.attachments.splice(index, 1);
await removeFileByUrl(removed.url);
```

- [ ] **Step 4: Remove single-file replacement in patch endpoints**

```js
// remove upload middleware `.single()` and req.file branches
app.patch("/api/materials/:id", async (req, res, next) => { /* metadata only */ });
```

- [ ] **Step 5: Run tests to verify green**

Run: `node --test test/multi-upload.test.js`
Expected: PASS for append/delete tests and previous create tests.

- [ ] **Step 6: Commit backend API changes**

```bash
git add server.js test/multi-upload.test.js
git commit -m "feat: add attachment append and delete endpoints"
```

### Task 5: Frontend Multi-Attachment Rendering + Operations

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/style.css`

- [ ] **Step 1: Update templates for attachment strip and append controls**

```html
<div class="attachment-strip"></div>
<form class="attachment-upload-form">
  <input name="attachments" type="file" multiple />
  <button type="submit">追加附件</button>
</form>
```

- [ ] **Step 2: Implement attachments-first rendering in `app.js`**

```js
const attachments = Array.isArray(item.attachments) ? item.attachments : [];
const active = attachments[activeIndex] || attachments[0];
```

- [ ] **Step 3: Hook append actions to new endpoints**

```js
await fetchJson(`/api/materials/${item.id}/attachments`, { method: "POST", body: formData });
```

- [ ] **Step 4: Hook delete actions to new endpoints with confirm**

```js
await fetchJson(`/api/paintings/${item.id}/attachments/${att.id}`, { method: "DELETE" });
```

- [ ] **Step 5: Keep pagination state on refresh and update success/error messages**

Run: `node --test test/multi-upload.test.js`
Expected: still PASS (frontend edits do not break backend tests).

- [ ] **Step 6: Commit frontend changes**

```bash
git add public/index.html public/app.js public/style.css
git commit -m "feat: support multi-attachment preview and edit operations in UI"
```

### Task 6: Legacy Compatibility + Final Verification

**Files:**
- Modify: `test/multi-upload.test.js`
- Modify: `server.js` (if compatibility test reveals gaps)

- [ ] **Step 1: Add failing legacy compatibility test**

```js
test("legacy records with imageUrl/assetUrl are normalized to attachments", async () => {
  // seed DATA_FILE with legacy shape
  // GET endpoints
  // assert returned records contain attachments[]
});
```

- [ ] **Step 2: Run targeted tests to verify fail**

Run: `node --test test/multi-upload.test.js`
Expected: FAIL if legacy normalization incomplete.

- [ ] **Step 3: Implement minimal compatibility fixes in `server.js`**

```js
// ensure normalizeDb() maps legacy singular fields into attachments arrays for each item
```

- [ ] **Step 4: Run full test suite and verify all pass**

Run: `npm test`
Expected: PASS with all tests green.

- [ ] **Step 5: Commit compatibility + verification updates**

```bash
git add server.js test/multi-upload.test.js
git commit -m "test: cover legacy data compatibility for attachments model"
```
