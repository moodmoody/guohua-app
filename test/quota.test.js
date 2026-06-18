const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { startFixture, stopFixture, TEST_INVITE_CODE } = require("./support/server-fixture");

function cookieFrom(response) {
  const raw = response.headers.get("set-cookie");
  assert.ok(raw, "expected set-cookie header");
  return raw.split(";")[0];
}

async function registerAndLogin(baseUrl, username = "quota-user") {
  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password: "brush-pass-123",
      inviteCode: TEST_INVITE_CODE,
    }),
  });
  assert.equal(register.status, 201);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "brush-pass-123" }),
  });
  assert.equal(login.status, 200);
  return cookieFrom(login);
}

function makePngBlob(seed = 1) {
  return new Blob([Buffer.from([137, 80, 78, 71, seed])], { type: "image/png" });
}

async function createPainting(baseUrl, cookie, index) {
  const form = new FormData();
  form.append("title", `配额作品 ${index}`);
  form.append("category", "山水");
  form.append("image", makePngBlob(index), `painting-${index}.png`);
  return await fetch(`${baseUrl}/api/paintings`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
}

async function createMaterial(baseUrl, cookie, index) {
  const form = new FormData();
  form.append("title", `配额素材 ${index}`);
  form.append("category", "参考");
  form.append("asset", makePngBlob(index), `material-${index}.png`);
  return await fetch(`${baseUrl}/api/materials`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
}

test("registered free users receive quota and current usage in their profile", async () => {
  const fixture = await startFixture();
  try {
    const cookie = await registerAndLogin(fixture.baseUrl);

    const me = await fetch(`${fixture.baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
    assert.equal(me.status, 200);
    const body = await me.json();

    assert.equal(body.user.plan, "free");
    assert.deepEqual(body.user.quota, {
      storageBytes: 200 * 1024 * 1024,
      paintingLimit: 10,
      materialLimit: 10,
      aiEnabled: false,
    });
    assert.deepEqual(body.usage, {
      storageBytes: 0,
      paintingCount: 0,
      materialCount: 0,
    });
  } finally {
    await stopFixture(fixture);
  }
});

test("free quota limits users to 10 paintings and 10 materials", async () => {
  const fixture = await startFixture();
  try {
    const cookie = await registerAndLogin(fixture.baseUrl);

    for (let index = 1; index <= 10; index += 1) {
      const res = await createPainting(fixture.baseUrl, cookie, index);
      assert.equal(res.status, 201);
    }
    const extraPainting = await createPainting(fixture.baseUrl, cookie, 11);
    assert.equal(extraPainting.status, 403);
    assert.match((await extraPainting.json()).error, /painting quota/i);

    for (let index = 1; index <= 10; index += 1) {
      const res = await createMaterial(fixture.baseUrl, cookie, index);
      assert.equal(res.status, 201);
    }
    const extraMaterial = await createMaterial(fixture.baseUrl, cookie, 11);
    assert.equal(extraMaterial.status, 403);
    assert.match((await extraMaterial.json()).error, /material quota/i);
  } finally {
    await stopFixture(fixture);
  }
});

test("free quota rejects uploads that would exceed configured storage", async () => {
  const fixture = await startFixture(null, {
    FREE_STORAGE_BYTES: "8",
    FREE_PAINTING_LIMIT: "10",
    FREE_MATERIAL_LIMIT: "10",
  });
  try {
    const cookie = await registerAndLogin(fixture.baseUrl);
    await fs.writeFile(path.join(fixture.storage.uploadDir, "existing.png"), Buffer.alloc(7));

    const db = JSON.parse(await fs.readFile(fixture.storage.dataFile, "utf8"));
    db.paintingLastId = 1;
    db.paintings.push({
      id: 1,
      title: "旧作",
      category: "山水",
      imageUrl: "/uploads/existing.png",
      attachments: [{ id: "existing.png", url: "/uploads/existing.png", type: "image" }],
      ownerUserId: db.users[0].id,
      createdAt: new Date().toISOString(),
    });
    await fs.writeFile(fixture.storage.dataFile, JSON.stringify(db, null, 2), "utf8");

    const res = await createPainting(fixture.baseUrl, cookie, 2);
    assert.equal(res.status, 403);
    assert.match((await res.json()).error, /storage quota/i);

    const files = await fs.readdir(fixture.storage.uploadDir);
    assert.deepEqual(files, ["existing.png"]);
  } finally {
    await stopFixture(fixture);
  }
});

test("default lulia user bypasses free quota limits", async () => {
  const now = new Date().toISOString();
  const fixture = await startFixture(
    {
      userLastId: 0,
      users: [],
      sessions: [],
      paintingLastId: 0,
      materialLastId: 0,
      paintings: [
        {
          id: 1,
          title: "默认用户旧作",
          category: "山水",
          imageUrl: "/uploads/missing.png",
          attachments: [{ id: "missing.png", url: "/uploads/missing.png", type: "image" }],
          createdAt: now,
        },
      ],
      materials: [],
    },
    {
      FREE_STORAGE_BYTES: "8",
      FREE_PAINTING_LIMIT: "1",
      FREE_MATERIAL_LIMIT: "1",
    }
  );
  try {
    const login = await fetch(`${fixture.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "lulia", password: "lulia-pass-123" }),
    });
    assert.equal(login.status, 200);
    const cookie = cookieFrom(login);

    const firstPainting = await createPainting(fixture.baseUrl, cookie, 1);
    assert.equal(firstPainting.status, 201);
    const secondPainting = await createPainting(fixture.baseUrl, cookie, 2);
    assert.equal(secondPainting.status, 201);

    const firstMaterial = await createMaterial(fixture.baseUrl, cookie, 1);
    assert.equal(firstMaterial.status, 201);
    const secondMaterial = await createMaterial(fixture.baseUrl, cookie, 2);
    assert.equal(secondMaterial.status, 201);

    const me = await fetch(`${fixture.baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
    assert.equal(me.status, 200);
    const body = await me.json();
    assert.equal(body.user.plan, "admin");
    assert.equal(body.user.quota.storageBytes, null);
    assert.equal(body.user.quota.paintingLimit, null);
    assert.equal(body.user.quota.materialLimit, null);
    assert.equal(body.user.quota.aiEnabled, true);
  } finally {
    await stopFixture(fixture);
  }
});
