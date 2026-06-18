const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const INVITE_CODE = "studio-invite-123";

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to acquire free port")));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

async function createTempStorage(initialData = null) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "guohua-auth-"));
  const uploadDir = path.join(tempRoot, "uploads");
  const dataDir = path.join(tempRoot, "data");
  const dataFile = path.join(dataDir, "paintings.json");
  const shimFile = path.join(tempRoot, "path-redirect.cjs");

  await fs.mkdir(uploadDir, { recursive: true });
  await fs.mkdir(dataDir, { recursive: true });
  if (initialData) {
    await fs.writeFile(dataFile, JSON.stringify(initialData, null, 2), "utf8");
  }

  await fs.writeFile(
    shimFile,
    [
      "const nodePath = require('node:path');",
      "const serverRoot = process.env.SERVER_ROOT;",
      "const uploadDir = process.env.UPLOAD_DIR;",
      "const dataFile = process.env.DATA_FILE;",
      "if (serverRoot && uploadDir && dataFile) {",
      "  const originalJoin = nodePath.join;",
      "  const repoUploadDir = originalJoin(serverRoot, 'uploads');",
      "  const repoDataDir = originalJoin(serverRoot, 'data');",
      "  const repoDataFile = originalJoin(repoDataDir, 'paintings.json');",
      "  const tempDataDir = nodePath.dirname(dataFile);",
      "  nodePath.join = (...parts) => {",
      "    const resolved = originalJoin(...parts);",
      "    if (resolved === repoUploadDir) return uploadDir;",
      "    if (resolved === repoDataDir) return tempDataDir;",
      "    if (resolved === repoDataFile) return dataFile;",
      "    return resolved;",
      "  };",
      "}",
      "",
    ].join("\n"),
    "utf8"
  );

  return { tempRoot, uploadDir, dataFile, shimFile };
}

function startServer(port, storage, envOverrides = {}) {
  const child = spawn(process.execPath, ["--require", storage.shimFile, "server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      SERVER_ROOT: process.cwd(),
      UPLOAD_DIR: storage.uploadDir,
      DATA_FILE: storage.dataFile,
      LEGACY_USER_PASSWORD: "lulia-pass-123",
      REGISTRATION_INVITE_CODE: INVITE_CODE,
      ...envOverrides,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  return {
    waitUntilReady: async () => {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        if (child.exitCode !== null) {
          throw new Error(`Server exited.\nstdout:\n${stdout}\nstderr:\n${stderr}`);
        }
        try {
          const res = await fetch(`http://127.0.0.1:${port}/api/auth/me`);
          if (res.status === 401) return;
        } catch (_error) {}
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(`Timed out waiting.\nstdout:\n${stdout}\nstderr:\n${stderr}`);
    },
    stop: async () => {
      if (child.exitCode !== null) return;
      child.kill("SIGTERM");
      await new Promise((resolve) => {
        child.once("exit", resolve);
        setTimeout(() => {
          if (child.exitCode === null) child.kill("SIGKILL");
        }, 5000);
      });
    },
  };
}

async function startFixture(initialData, envOverrides) {
  const port = await getFreePort();
  const storage = await createTempStorage(initialData);
  const server = startServer(port, storage, envOverrides);
  await server.waitUntilReady();
  return { baseUrl: `http://127.0.0.1:${port}`, storage, server };
}

async function stopFixture(fixture) {
  await fixture.server.stop();
  await fs.rm(fixture.storage.tempRoot, { recursive: true, force: true });
}

function cookieFrom(response) {
  const raw = response.headers.get("set-cookie");
  assert.ok(raw, "expected set-cookie header");
  return raw.split(";")[0];
}

async function register(baseUrl, username = "artist", password = "brush-pass-123") {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, displayName: "Ink Artist", inviteCode: INVITE_CODE }),
  });
  return { res, cookie: res.headers.get("set-cookie"), body: await res.json() };
}

test("registration requires the configured invitation code", async () => {
  const fixture = await startFixture();
  try {
    const missingInvite = await fetch(`${fixture.baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "open-door", password: "brush-pass-123" }),
    });
    assert.equal(missingInvite.status, 403);

    const wrongInvite = await fetch(`${fixture.baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "wrong-key", password: "brush-pass-123", inviteCode: "wrong" }),
    });
    assert.equal(wrongInvite.status, 403);

    const db = JSON.parse(await fs.readFile(fixture.storage.dataFile, "utf8"));
    assert.equal(db.users.length, 0);
  } finally {
    await stopFixture(fixture);
  }
});

test("registration accepts any code from the configured invite code list", async () => {
  const fixture = await startFixture(null, {
    REGISTRATION_INVITE_CODE: "",
    REGISTRATION_INVITE_CODES: "alpha-one, beta-two\n gamma-three ",
  });
  try {
    const accepted = await fetch(`${fixture.baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "listed", password: "brush-pass-123", inviteCode: "beta-two" }),
    });
    assert.equal(accepted.status, 201);

    const rejected = await fetch(`${fixture.baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "unlisted", password: "brush-pass-123", inviteCode: "delta-four" }),
    });
    assert.equal(rejected.status, 403);
  } finally {
    await stopFixture(fixture);
  }
});

test("register creates a user, stores a password hash, and requires login afterward", async () => {
  const fixture = await startFixture();
  try {
    const { res, cookie, body } = await register(fixture.baseUrl);
    assert.equal(res.status, 201);
    assert.equal(cookie, null);
    assert.equal(body.user.username, "artist");
    assert.equal(body.user.displayName, "Ink Artist");
    assert.equal(body.user.passwordHash, undefined);

    const db = JSON.parse(await fs.readFile(fixture.storage.dataFile, "utf8"));
    assert.equal(db.users.length, 1);
    assert.notEqual(db.users[0].passwordHash, "brush-pass-123");
    assert.ok(String(db.users[0].passwordHash).startsWith("pbkdf2$"));
    assert.equal(db.users[0].plan, "free");
    assert.deepEqual(db.users[0].quota, {
      storageBytes: 200 * 1024 * 1024,
      paintingLimit: 10,
      materialLimit: 10,
      aiEnabled: false,
    });
    assert.equal(db.sessions.length, 0);

    const me = await fetch(`${fixture.baseUrl}/api/auth/me`);
    assert.equal(me.status, 401);
  } finally {
    await stopFixture(fixture);
  }
});

test("duplicate registration is rejected and login/logout/me use safe profile fields", async () => {
  const fixture = await startFixture();
  try {
    const first = await register(fixture.baseUrl, "Artist", "brush-pass-123");
    assert.equal(first.res.status, 201);

    const duplicate = await fetch(`${fixture.baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: " artist ", password: "brush-pass-123", inviteCode: INVITE_CODE }),
    });
    assert.equal(duplicate.status, 400);

    const badLogin = await fetch(`${fixture.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "artist", password: "wrong-pass" }),
    });
    assert.equal(badLogin.status, 401);

    const login = await fetch(`${fixture.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "artist", password: "brush-pass-123" }),
    });
    assert.equal(login.status, 200);
    const cookie = cookieFrom(login);

    const me = await fetch(`${fixture.baseUrl}/api/auth/me`, {
      headers: { Cookie: cookie },
    });
    assert.equal(me.status, 200);
    const meBody = await me.json();
    assert.equal(meBody.user.username, "artist");
    assert.equal(meBody.user.passwordHash, undefined);

    const logout = await fetch(`${fixture.baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    assert.equal(logout.status, 200);

    const afterLogout = await fetch(`${fixture.baseUrl}/api/auth/me`, {
      headers: { Cookie: cookie },
    });
    assert.equal(afterLogout.status, 401);
  } finally {
    await stopFixture(fixture);
  }
});

test("profile, avatar, and password endpoints update only the current user", async () => {
  const fixture = await startFixture();
  try {
    await register(fixture.baseUrl, "profiled", "old-pass-123");
    const login = await fetch(`${fixture.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "profiled", password: "old-pass-123" }),
    });
    assert.equal(login.status, 200);
    const cookie = cookieFrom(login);

    const profile = await fetch(`${fixture.baseUrl}/api/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ displayName: "行云主人", bio: "大写意习作者" }),
    });
    assert.equal(profile.status, 200);
    const profileBody = await profile.json();
    assert.equal(profileBody.user.displayName, "行云主人");
    assert.equal(profileBody.user.bio, "大写意习作者");

    const avatarForm = new FormData();
    avatarForm.append("avatar", new Blob([Buffer.from([137, 80, 78, 71])], { type: "image/png" }), "avatar.png");
    const avatar = await fetch(`${fixture.baseUrl}/api/profile/avatar`, {
      method: "POST",
      headers: { Cookie: cookie },
      body: avatarForm,
    });
    assert.equal(avatar.status, 200);
    const avatarBody = await avatar.json();
    assert.match(avatarBody.user.avatarUrl, /^\/uploads\//);

    const wrongPassword = await fetch(`${fixture.baseUrl}/api/profile/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ currentPassword: "bad-pass", newPassword: "new-pass-123" }),
    });
    assert.equal(wrongPassword.status, 400);

    const password = await fetch(`${fixture.baseUrl}/api/profile/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ currentPassword: "old-pass-123", newPassword: "new-pass-123" }),
    });
    assert.equal(password.status, 200);

    const relogin = await fetch(`${fixture.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "profiled", password: "new-pass-123" }),
    });
    assert.equal(relogin.status, 200);
  } finally {
    await stopFixture(fixture);
  }
});
