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
