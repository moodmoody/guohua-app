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

async function login(baseUrl, username, password = "brush-pass-123") {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(response.status, 200);
  return cookieFrom(response);
}

async function register(baseUrl, username, password = "brush-pass-123") {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, inviteCode: TEST_INVITE_CODE }),
  });
  assert.equal(response.status, 201);
  return await response.json();
}

function makePngBlob(seed = 1) {
  return new Blob([Buffer.from([137, 80, 78, 71, seed])], { type: "image/png" });
}

async function createPainting(baseUrl, cookie, index) {
  const form = new FormData();
  form.append("title", `admin-user-painting-${index}`);
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
  form.append("title", `admin-user-material-${index}`);
  form.append("category", "参考");
  form.append("asset", makePngBlob(index), `material-${index}.png`);
  return await fetch(`${baseUrl}/api/materials`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
}

async function seedManagedUser(baseUrl, username = "managed") {
  const body = await register(baseUrl, username);
  const cookie = await login(baseUrl, username);
  assert.equal((await createPainting(baseUrl, cookie, 1)).status, 201);
  assert.equal((await createMaterial(baseUrl, cookie, 1)).status, 201);
  return { user: body.user, cookie };
}

async function adminCookie(baseUrl) {
  await register(baseUrl, "lulia", "lulia-pass-123");
  return await login(baseUrl, "lulia", "lulia-pass-123");
}

test("admin users can list users with usage and regular users cannot", async () => {
  const fixture = await startFixture();
  try {
    await seedManagedUser(fixture.baseUrl, "listed-user");
    const admin = await adminCookie(fixture.baseUrl);
    const regularCookie = await login(fixture.baseUrl, "listed-user");

    const denied = await fetch(`${fixture.baseUrl}/api/admin/users`, { headers: { Cookie: regularCookie } });
    assert.equal(denied.status, 403);

    const response = await fetch(`${fixture.baseUrl}/api/admin/users`, { headers: { Cookie: admin } });
    assert.equal(response.status, 200);
    const body = await response.json();
    const managed = body.users.find((user) => user.username === "listed-user");
    assert.ok(managed);
    assert.equal(managed.passwordHash, undefined);
    assert.equal(managed.usage.paintingCount, 1);
    assert.equal(managed.usage.materialCount, 1);
    assert.ok(Number.isInteger(managed.usage.storageBytes));
  } finally {
    await stopFixture(fixture);
  }
});

test("admin users can update trial quota and the quota is enforced immediately", async () => {
  const fixture = await startFixture();
  try {
    const { user, cookie } = await seedManagedUser(fixture.baseUrl, "quota-managed");
    const admin = await adminCookie(fixture.baseUrl);

    const response = await fetch(`${fixture.baseUrl}/api/admin/users/${user.id}/quota`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: admin },
      body: JSON.stringify({
        plan: "free",
        quota: {
          storageMb: 5,
          paintingLimit: 1,
          materialLimit: 1,
          aiEnabled: true,
        },
      }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.user.plan, "free");
    assert.equal(body.user.quota.storageBytes, 5 * 1024 * 1024);
    assert.equal(body.user.quota.paintingLimit, 1);
    assert.equal(body.user.quota.materialLimit, 1);
    assert.equal(body.user.quota.aiEnabled, true);

    const extraPainting = await createPainting(fixture.baseUrl, cookie, 2);
    assert.equal(extraPainting.status, 403);
    assert.match((await extraPainting.json()).error, /painting quota/i);
  } finally {
    await stopFixture(fixture);
  }
});

test("admin users can promote users to admin and cannot alter the lulia account", async () => {
  const fixture = await startFixture();
  try {
    const { user, cookie } = await seedManagedUser(fixture.baseUrl, "promoted-user");
    const admin = await adminCookie(fixture.baseUrl);

    const promote = await fetch(`${fixture.baseUrl}/api/admin/users/${user.id}/quota`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: admin },
      body: JSON.stringify({ plan: "admin" }),
    });
    assert.equal(promote.status, 200);
    const body = await promote.json();
    assert.equal(body.user.plan, "admin");
    assert.equal(body.user.quota.storageBytes, null);
    assert.equal(body.user.quota.aiEnabled, true);

    assert.equal((await createPainting(fixture.baseUrl, cookie, 2)).status, 201);

    const db = JSON.parse(await fs.readFile(fixture.storage.dataFile, "utf8"));
    const lulia = db.users.find((item) => item.username === "lulia");
    const alterLulia = await fetch(`${fixture.baseUrl}/api/admin/users/${lulia.id}/quota`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: admin },
      body: JSON.stringify({ plan: "free", quota: { paintingLimit: 1 } }),
    });
    assert.equal(alterLulia.status, 400);
  } finally {
    await stopFixture(fixture);
  }
});

test("demoting an admin user back to free restores trial quota defaults", async () => {
  const fixture = await startFixture();
  try {
    const { user } = await seedManagedUser(fixture.baseUrl, "demoted-user");
    const admin = await adminCookie(fixture.baseUrl);

    const promote = await fetch(`${fixture.baseUrl}/api/admin/users/${user.id}/quota`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: admin },
      body: JSON.stringify({ plan: "admin" }),
    });
    assert.equal(promote.status, 200);

    const demote = await fetch(`${fixture.baseUrl}/api/admin/users/${user.id}/quota`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: admin },
      body: JSON.stringify({ plan: "free" }),
    });
    assert.equal(demote.status, 200);
    const body = await demote.json();
    assert.equal(body.user.plan, "free");
    assert.deepEqual(body.user.quota, {
      storageBytes: 200 * 1024 * 1024,
      paintingLimit: 10,
      materialLimit: 10,
      aiEnabled: false,
    });
  } finally {
    await stopFixture(fixture);
  }
});

test("admin users can delete regular users with records, files, and sessions", async () => {
  const fixture = await startFixture();
  try {
    const { user, cookie } = await seedManagedUser(fixture.baseUrl, "delete-me");
    const admin = await adminCookie(fixture.baseUrl);
    const beforeFiles = await fs.readdir(fixture.storage.uploadDir);
    assert.equal(beforeFiles.length, 2);

    const response = await fetch(`${fixture.baseUrl}/api/admin/users/${user.id}`, {
      method: "DELETE",
      headers: { Cookie: admin },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      id: user.id,
      deletedPaintings: 1,
      deletedMaterials: 1,
    });

    const db = JSON.parse(await fs.readFile(fixture.storage.dataFile, "utf8"));
    assert.equal(db.users.some((item) => item.id === user.id), false);
    assert.equal(db.paintings.some((item) => item.ownerUserId === user.id), false);
    assert.equal(db.materials.some((item) => item.ownerUserId === user.id), false);
    assert.equal(db.sessions.some((item) => item.userId === user.id), false);
    assert.deepEqual(await fs.readdir(fixture.storage.uploadDir), []);

    const deletedMe = await fetch(`${fixture.baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
    assert.equal(deletedMe.status, 401);
  } finally {
    await stopFixture(fixture);
  }
});

test("admin deletion protects the current admin and lulia account", async () => {
  const fixture = await startFixture();
  try {
    await seedManagedUser(fixture.baseUrl, "ordinary-user");
    const admin = await adminCookie(fixture.baseUrl);
    const db = JSON.parse(await fs.readFile(fixture.storage.dataFile, "utf8"));
    const lulia = db.users.find((item) => item.username === "lulia");

    const response = await fetch(`${fixture.baseUrl}/api/admin/users/${lulia.id}`, {
      method: "DELETE",
      headers: { Cookie: admin },
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /cannot delete/i);
  } finally {
    await stopFixture(fixture);
  }
});
