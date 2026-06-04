const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { startFixture, stopFixture } = require("./support/server-fixture");

test("public assets and uploaded files are cacheable", async () => {
  const fixture = await startFixture();
  try {
    await fs.writeFile(path.join(fixture.storage.uploadDir, "cached.png"), Buffer.from([1, 2, 3]));

    const style = await fetch(`${fixture.baseUrl}/style.css`);
    assert.equal(style.status, 200);
    assert.match(String(style.headers.get("cache-control") || ""), /max-age=(?!0\b)\d+/);

    const upload = await fetch(`${fixture.baseUrl}/uploads/cached.png`);
    assert.equal(upload.status, 200);
    const uploadCache = String(upload.headers.get("cache-control") || "");
    assert.match(uploadCache, /max-age=(?!0\b)\d+/);
    assert.match(uploadCache, /immutable/);
  } finally {
    await stopFixture(fixture);
  }
});
