const test = require("node:test");
const assert = require("node:assert/strict");
const { startFixture, stopFixture, TEST_INVITE_CODE } = require("./support/server-fixture");

async function registerAndLogin(baseUrl, username = "shareuser") {
  const password = "share-pass-123";
  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      displayName: "分享画友",
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
  const cookie = login.headers.get("set-cookie");
  assert.ok(cookie);
  return cookie.split(";")[0];
}

async function createPainting(baseUrl, cookie) {
  const form = new FormData();
  form.set("title", "溪山清远");
  form.set("category", "山水");
  form.set("description", "试作一帧，拟作朋友圈分享。");
  form.append("image", new Blob([Buffer.from([1, 2, 3, 4])], { type: "image/png" }), "share.png");

  const res = await fetch(`${baseUrl}/api/paintings`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  assert.equal(res.status, 201);
  return await res.json();
}

test("authenticated user can create a public painting share link", async () => {
  const fixture = await startFixture();
  try {
    const cookie = await registerAndLogin(fixture.baseUrl);
    const painting = await createPainting(fixture.baseUrl, cookie);

    const share = await fetch(`${fixture.baseUrl}/api/paintings/${painting.id}/share`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    assert.equal(share.status, 200);
    const payload = await share.json();
    assert.match(payload.url, /^\/share\/[A-Za-z0-9_-]+$/);
    assert.equal(payload.title, "溪山清远");

    const page = await fetch(`${fixture.baseUrl}${payload.url}`);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /<title>溪山清远 · 墨舞丹青<\/title>/);
    assert.match(html, /property="og:title" content="溪山清远 · 山水"/);
    assert.match(html, /property="og:image" content="http:\/\/127\.0\.0\.1:\d+\/uploads\//);
    assert.match(html, /微信朋友圈/);
    assert.match(html, /试作一帧，拟作朋友圈分享。/);

    const posterPage = await fetch(`${fixture.baseUrl}${payload.url}?poster=1`);
    assert.equal(posterPage.status, 200);
    const posterHtml = await posterPage.text();
    assert.match(posterHtml, /id="share-poster-canvas"/);
    assert.match(posterHtml, /id="share-poster-image"/);
    assert.match(posterHtml, /function drawSharePoster/);
    assert.match(posterHtml, /canvas\.toDataURL\("image\/png"\)/);
    assert.match(posterHtml, /posterImage\.src = canvas\.toDataURL/);
    assert.match(posterHtml, /长按保存/);
    assert.match(posterHtml, /分享到朋友圈/);
  } finally {
    await stopFixture(fixture);
  }
});

test("share page is unavailable before a painting is shared", async () => {
  const fixture = await startFixture();
  try {
    const page = await fetch(`${fixture.baseUrl}/share/not-created-token`);
    assert.equal(page.status, 404);
  } finally {
    await stopFixture(fixture);
  }
});
