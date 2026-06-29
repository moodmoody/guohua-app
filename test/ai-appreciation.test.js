const test = require("node:test");
const assert = require("node:assert/strict");
const { startFixture, stopFixture, TEST_INVITE_CODE } = require("./support/server-fixture");

async function registerAndLogin(baseUrl, username = "ai-user") {
  const password = "brush-pass-123";
  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, inviteCode: TEST_INVITE_CODE }),
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

async function createPainting(baseUrl, cookie, title = "AI 赏析作品") {
  const form = new FormData();
  form.append("title", title);
  form.append("category", "花鸟");
  form.append("description", "荷叶疏朗，墨色清润。");
  form.append("tags", "写意 荷花");
  form.append("image", new Blob([Buffer.from([1, 2, 3, 4])], { type: "image/png" }), "lotus.png");

  const res = await fetch(`${baseUrl}/api/paintings`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  assert.equal(res.status, 201);
  return await res.json();
}

test("AI appreciation requires the user's AI quota to be enabled", async () => {
  const fixture = await startFixture(null, {
      AI_API_KEY: "test-key",
      AI_API_BASE_URL: "http://127.0.0.1:1/v1",
      FREE_AI_ENABLED: "false",
  });
  try {
    const cookie = await registerAndLogin(fixture.baseUrl, "ai-denied");
    const painting = await createPainting(fixture.baseUrl, cookie);

    const res = await fetch(`${fixture.baseUrl}/api/paintings/${painting.id}/ai-appreciation`, {
      method: "POST",
      headers: { Cookie: cookie },
    });

    assert.equal(res.status, 403);
    assert.match((await res.json()).error, /AI appreciation is not enabled/i);
  } finally {
    await stopFixture(fixture);
  }
});

test("AI appreciation reports missing service configuration clearly", async () => {
  const fixture = await startFixture(null, { FREE_AI_ENABLED: "true", AI_API_KEY: "" });
  try {
    const cookie = await registerAndLogin(fixture.baseUrl, "ai-unconfigured");
    const painting = await createPainting(fixture.baseUrl, cookie);

    const res = await fetch(`${fixture.baseUrl}/api/paintings/${painting.id}/ai-appreciation`, {
      method: "POST",
      headers: { Cookie: cookie },
    });

    assert.equal(res.status, 503);
    assert.match((await res.json()).error, /AI service is not configured/i);
  } finally {
    await stopFixture(fixture);
  }
});

test("AI appreciation calls the configured OpenAI-compatible service and caches the result", async () => {
  let calls = 0;
  let lastRequest = null;
  const aiServer = require("node:http").createServer((req, res) => {
    calls += 1;
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      lastRequest = JSON.parse(body);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  "整体观感：清雅有致。\n构图与章法：疏密得当。\n笔墨与设色：墨色清润。\n意境解读：有静气。\n可完善之处：题跋可再凝练。",
              },
            },
          ],
        })
      );
    });
  });
  await new Promise((resolve) => aiServer.listen(0, "127.0.0.1", resolve));
  const aiPort = aiServer.address().port;

  try {
    const fixture = await startFixture(null, {
        FREE_AI_ENABLED: "true",
        AI_API_KEY: "test-key",
        AI_API_BASE_URL: `http://127.0.0.1:${aiPort}/v1`,
        AI_MODEL: "vision-test",
    });
    try {
      const cookie = await registerAndLogin(fixture.baseUrl, "ai-cached");
      const painting = await createPainting(fixture.baseUrl, cookie);

      const first = await fetch(`${fixture.baseUrl}/api/paintings/${painting.id}/ai-appreciation`, {
        method: "POST",
        headers: { Cookie: cookie },
      });
      assert.equal(first.status, 200);
      const firstBody = await first.json();
      assert.equal(firstBody.cached, false);
      assert.match(firstBody.aiAppreciation.content, /整体观感/);
      assert.equal(firstBody.aiAppreciation.model, "vision-test");

      const second = await fetch(`${fixture.baseUrl}/api/paintings/${painting.id}/ai-appreciation`, {
        method: "POST",
        headers: { Cookie: cookie },
      });
      assert.equal(second.status, 200);
      const secondBody = await second.json();
      assert.equal(secondBody.cached, true);
      assert.equal(secondBody.aiAppreciation.content, firstBody.aiAppreciation.content);
      assert.equal(calls, 1);
      assert.equal(lastRequest.model, "vision-test");
      assert.match(JSON.stringify(lastRequest.messages), /荷叶疏朗/);
    } finally {
      await stopFixture(fixture);
    }
  } finally {
    await new Promise((resolve) => aiServer.close(resolve));
  }
});

test("AI appreciation accepts a full chat completions endpoint as AI_API_BASE_URL", async () => {
  let requestedUrl = "";
  const aiServer = require("node:http").createServer((req, res) => {
    requestedUrl = req.url;
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [{ message: { content: "整体观感：可观。\n构图与章法：平稳。\n笔墨与设色：清润。\n意境解读：有余味。\n可完善之处：可补题跋。" } }],
        })
      );
    });
  });
  await new Promise((resolve) => aiServer.listen(0, "127.0.0.1", resolve));
  const aiPort = aiServer.address().port;

  try {
    const fixture = await startFixture(null, {
      FREE_AI_ENABLED: "true",
      AI_API_KEY: "test-key",
      AI_API_BASE_URL: `http://127.0.0.1:${aiPort}/api/open-apis/v1/chat/completions`,
      AI_MODEL: "endpoint-test",
    });
    try {
      const cookie = await registerAndLogin(fixture.baseUrl, "ai-endpoint");
      const painting = await createPainting(fixture.baseUrl, cookie, "完整端点作品");

      const res = await fetch(`${fixture.baseUrl}/api/paintings/${painting.id}/ai-appreciation`, {
        method: "POST",
        headers: { Cookie: cookie },
      });

      assert.equal(res.status, 200);
      assert.equal(requestedUrl, "/api/open-apis/v1/chat/completions");
    } finally {
      await stopFixture(fixture);
    }
  } finally {
    await new Promise((resolve) => aiServer.close(resolve));
  }
});

test("AI appreciation does not send image params unless explicitly enabled", async () => {
  let lastRequest = null;
  const aiServer = require("node:http").createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      lastRequest = JSON.parse(body);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [{ message: { content: "整体观感：可观。\n构图与章法：平稳。\n笔墨与设色：清润。\n意境解读：有余味。\n可完善之处：可补题跋。" } }],
        })
      );
    });
  });
  await new Promise((resolve) => aiServer.listen(0, "127.0.0.1", resolve));
  const aiPort = aiServer.address().port;

  try {
    const fixture = await startFixture(null, {
      FREE_AI_ENABLED: "true",
      AI_API_KEY: "test-key",
      AI_API_BASE_URL: `http://127.0.0.1:${aiPort}/v1`,
      AI_MODEL: "text-only-test",
    });
    try {
      const cookie = await registerAndLogin(fixture.baseUrl, "ai-text-only");
      const painting = await createPainting(fixture.baseUrl, cookie, "文字赏析作品");

      const res = await fetch(`${fixture.baseUrl}/api/paintings/${painting.id}/ai-appreciation`, {
        method: "POST",
        headers: { Cookie: cookie },
      });

      assert.equal(res.status, 200);
      assert.equal(typeof lastRequest.messages[1].content, "string");
      assert.doesNotMatch(JSON.stringify(lastRequest), /image_url/);
    } finally {
      await stopFixture(fixture);
    }
  } finally {
    await new Promise((resolve) => aiServer.close(resolve));
  }
});
