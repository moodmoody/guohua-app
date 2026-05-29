const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { startFixture, stopFixture } = require("./support/server-fixture");

function makePngBlob(seed) {
  return new Blob([new Uint8Array([137, 80, 78, 71, seed])], { type: "image/png" });
}

async function register(baseUrl, username) {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "brush-pass-123" }),
  });
  assert.equal(res.status, 201);
  return res.headers.get("set-cookie").split(";")[0];
}

async function createPainting(baseUrl, cookie, title) {
  const form = new FormData();
  form.append("title", title);
  form.append("category", "山水");
  form.append("description", "owner scoped");
  form.append("image", makePngBlob(1), `${title}.png`);
  const res = await fetch(`${baseUrl}/api/paintings`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  assert.equal(res.status, 201);
  return await res.json();
}

async function createMaterial(baseUrl, cookie, title) {
  const form = new FormData();
  form.append("title", title);
  form.append("category", "素材");
  form.append("description", "owner scoped");
  form.append("asset", makePngBlob(2), `${title}.png`);
  const res = await fetch(`${baseUrl}/api/materials`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  assert.equal(res.status, 201);
  return await res.json();
}

test("painting and material APIs require login and isolate records by owner", async () => {
  const fixture = await startFixture();
  try {
    const anonymous = await fetch(`${fixture.baseUrl}/api/paintings`);
    assert.equal(anonymous.status, 401);

    const firstCookie = await register(fixture.baseUrl, "artist-one");
    const secondCookie = await register(fixture.baseUrl, "artist-two");
    const firstPainting = await createPainting(fixture.baseUrl, firstCookie, "first-painting");
    const secondPainting = await createPainting(fixture.baseUrl, secondCookie, "second-painting");
    const firstMaterial = await createMaterial(fixture.baseUrl, firstCookie, "first-material");
    await createMaterial(fixture.baseUrl, secondCookie, "second-material");

    const firstList = await fetch(`${fixture.baseUrl}/api/paintings`, {
      headers: { Cookie: firstCookie },
    });
    assert.equal(firstList.status, 200);
    assert.deepEqual(
      (await firstList.json()).map((item) => item.title),
      ["first-painting"]
    );

    const secondReadFirst = await fetch(`${fixture.baseUrl}/api/paintings/${firstPainting.id}`, {
      headers: { Cookie: secondCookie },
    });
    assert.equal(secondReadFirst.status, 404);

    const firstDeleteSecond = await fetch(`${fixture.baseUrl}/api/paintings/${secondPainting.id}`, {
      method: "DELETE",
      headers: { Cookie: firstCookie },
    });
    assert.equal(firstDeleteSecond.status, 404);

    const firstMaterials = await fetch(`${fixture.baseUrl}/api/materials`, {
      headers: { Cookie: firstCookie },
    });
    assert.equal(firstMaterials.status, 200);
    assert.deepEqual(
      (await firstMaterials.json()).map((item) => item.id),
      [firstMaterial.id]
    );
  } finally {
    await stopFixture(fixture);
  }
});

test("legacy records are assigned to the lulia default user", async () => {
  const initialData = {
    paintingLastId: 1,
    materialLastId: 1,
    paintings: [
      {
        id: 1,
        title: "旧藏山水",
        category: "山水",
        description: "",
        imageUrl: "/uploads/legacy.png",
        attachments: [{ id: "legacy.png", url: "/uploads/legacy.png", type: "image" }],
        comments: [],
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    materials: [
      {
        id: 1,
        title: "旧藏素材",
        category: "素材",
        description: "",
        assetType: "image",
        assetUrl: "/uploads/material.png",
        attachments: [{ id: "material.png", url: "/uploads/material.png", type: "image" }],
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  };
  const fixture = await startFixture(initialData);
  try {
    const db = JSON.parse(await fs.readFile(fixture.storage.dataFile, "utf8"));
    const lulia = db.users.find((user) => user.username === "lulia");
    assert.ok(lulia);
    assert.equal(db.paintings[0].ownerUserId, lulia.id);
    assert.equal(db.materials[0].ownerUserId, lulia.id);

    const newCookie = await register(fixture.baseUrl, "new-artist");
    const list = await fetch(`${fixture.baseUrl}/api/paintings`, {
      headers: { Cookie: newCookie },
    });
    assert.equal(list.status, 200);
    assert.deepEqual(await list.json(), []);

    const loginLegacy = await fetch(`${fixture.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "lulia", password: "lulia-pass-123" }),
    });
    assert.equal(loginLegacy.status, 200);
    const legacyCookie = loginLegacy.headers.get("set-cookie").split(";")[0];
    const legacyList = await fetch(`${fixture.baseUrl}/api/paintings`, {
      headers: { Cookie: legacyCookie },
    });
    assert.equal(legacyList.status, 200);
    assert.equal((await legacyList.json()).length, 1);
  } finally {
    await stopFixture(fixture);
  }
});

test("existing legacy user is migrated to lulia with owned records preserved", async () => {
  const initialData = {
    userLastId: 1,
    users: [
      {
        id: 1,
        username: "legacy",
        passwordHash: "pbkdf2$120000$sha256$1234567890abcdef1234567890abcdef$663082192dcd5efbf3d2465e007376f722bbf3a28d46a6931a6c194a2c65f8a3",
        displayName: "legacy",
        bio: "",
        avatarUrl: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    sessions: [],
    paintingLastId: 1,
    materialLastId: 0,
    paintings: [
      {
        id: 1,
        title: "旧用户作品",
        category: "山水",
        description: "",
        imageUrl: "/uploads/legacy.png",
        attachments: [{ id: "legacy.png", url: "/uploads/legacy.png", type: "image" }],
        comments: [],
        ownerUserId: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    materials: [],
  };
  const fixture = await startFixture(initialData);
  try {
    const db = JSON.parse(await fs.readFile(fixture.storage.dataFile, "utf8"));
    assert.equal(db.users.some((user) => user.username === "legacy"), false);
    const lulia = db.users.find((user) => user.username === "lulia");
    assert.ok(lulia);
    assert.equal(db.paintings[0].ownerUserId, lulia.id);

    const login = await fetch(`${fixture.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "lulia", password: "lulia-pass-123" }),
    });
    assert.equal(login.status, 200);
  } finally {
    await stopFixture(fixture);
  }
});
