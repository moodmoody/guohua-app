const test = require("node:test");
const assert = require("node:assert/strict");
const { startFixture, stopFixture } = require("./support/server-fixture");

function makePngBlob(seed) {
  return new Blob([new Uint8Array([137, 80, 78, 71, seed])], { type: "image/png" });
}

async function register(baseUrl) {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "pager", password: "brush-pass-123" }),
  });
  assert.equal(res.status, 201);
  return res.headers.get("set-cookie").split(";")[0];
}

async function createPainting(baseUrl, cookie, index) {
  const form = new FormData();
  form.append("title", `分页作品 ${index}`);
  form.append("category", index % 2 === 0 ? "山水" : "花鸟");
  form.append("description", "pagination performance");
  form.append("image", makePngBlob(index), `painting-${index}.png`);
  const res = await fetch(`${baseUrl}/api/paintings`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  assert.equal(res.status, 201);
}

async function createMaterial(baseUrl, cookie, index) {
  const form = new FormData();
  form.append("title", `分页素材 ${index}`);
  form.append("category", index % 2 === 0 ? "纹理" : "构图");
  form.append("description", "pagination performance");
  form.append("asset", makePngBlob(index), `material-${index}.png`);
  const res = await fetch(`${baseUrl}/api/materials`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  assert.equal(res.status, 201);
}

test("painting and material lists return paginated payloads", async () => {
  const fixture = await startFixture();
  try {
    const cookie = await register(fixture.baseUrl);
    for (let index = 1; index <= 5; index += 1) {
      await createPainting(fixture.baseUrl, cookie, index);
      await createMaterial(fixture.baseUrl, cookie, index);
    }

    const paintingsRes = await fetch(`${fixture.baseUrl}/api/paintings?page=2&pageSize=2`, {
      headers: { Cookie: cookie },
    });
    assert.equal(paintingsRes.status, 200);
    const paintings = await paintingsRes.json();
    assert.deepEqual(Object.keys(paintings).sort(), ["items", "page", "pageSize", "total", "totalPages"]);
    assert.equal(paintings.items.length, 2);
    assert.equal(paintings.total, 5);
    assert.equal(paintings.page, 2);
    assert.equal(paintings.pageSize, 2);
    assert.equal(paintings.totalPages, 3);

    const materialsRes = await fetch(`${fixture.baseUrl}/api/materials?page=1&pageSize=3`, {
      headers: { Cookie: cookie },
    });
    assert.equal(materialsRes.status, 200);
    const materials = await materialsRes.json();
    assert.equal(materials.items.length, 3);
    assert.equal(materials.total, 5);
    assert.equal(materials.page, 1);
    assert.equal(materials.pageSize, 3);
    assert.equal(materials.totalPages, 2);
  } finally {
    await stopFixture(fixture);
  }
});

test("pagination metadata respects search and category filters", async () => {
  const fixture = await startFixture();
  try {
    const cookie = await register(fixture.baseUrl);
    for (let index = 1; index <= 4; index += 1) {
      await createPainting(fixture.baseUrl, cookie, index);
    }

    const res = await fetch(
      `${fixture.baseUrl}/api/paintings?category=${encodeURIComponent("山水")}&q=${encodeURIComponent("分页作品")}&page=1&pageSize=1`,
      { headers: { Cookie: cookie } }
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.items.length, 1);
    assert.equal(body.total, 2);
    assert.equal(body.totalPages, 2);
    assert.ok(body.items.every((item) => item.category === "山水"));
  } finally {
    await stopFixture(fixture);
  }
});
