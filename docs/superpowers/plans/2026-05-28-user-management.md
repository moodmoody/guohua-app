# User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add registration, login, logout, profile management, avatar upload, password change, and per-user isolation for paintings and materials.

**Architecture:** Keep the current Express app and JSON storage. Extend `data/paintings.json` with users, sessions, and owner ids. Use HTTP-only cookie sessions and route-level current-user checks.

**Tech Stack:** Node.js, Express, Multer, Node built-in `crypto`, JSON file storage, vanilla HTML/CSS/JS, Node test runner.

---

## File Structure

- Modify `server.js`: authentication helpers, cookie parsing, user/session normalization, profile routes, owner filtering for painting/material APIs, avatar upload.
- Modify `public/index.html`: auth screen, user header, profile tab/forms, `file-selection.js` script remains before `app.js`.
- Modify `public/app.js`: auth state, login/register/logout/profile calls, gated app loading, profile form handling, owner-scoped reloads.
- Modify `public/style.css`: auth/profile layout styles and user header styles.
- Create `test/auth.test.js`: auth and profile endpoint tests.
- Create `test/ownership.test.js`: user isolation and legacy migration endpoint tests.
- Keep `test/multi-upload.test.js` passing. If helper setup is duplicated, extract only if needed after tests are green.

Current workspace has unrelated local changes. Stage and commit only files touched by the current task.

---

### Task 1: Auth Data Model And Password Helpers

**Files:**
- Modify: `server.js`
- Create: `test/auth.test.js`

- [ ] **Step 1: Write failing tests for registration data shape**

Create `test/auth.test.js` with this bootstrap and first test:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

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

async function createTempStorage() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "guohua-auth-"));
  const uploadDir = path.join(tempRoot, "uploads");
  const dataDir = path.join(tempRoot, "data");
  const dataFile = path.join(dataDir, "paintings.json");
  const shimFile = path.join(tempRoot, "path-redirect.cjs");
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.mkdir(dataDir, { recursive: true });
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
    ].join("\\n"),
    "utf8"
  );
  return { tempRoot, uploadDir, dataFile, shimFile };
}

function startServer(port, storage) {
  const child = spawn(process.execPath, ["--require", storage.shimFile, "server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      SERVER_ROOT: process.cwd(),
      UPLOAD_DIR: storage.uploadDir,
      DATA_FILE: storage.dataFile,
      LEGACY_USER_PASSWORD: "legacy-pass-123",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  return {
    child,
    waitUntilReady: async () => {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        if (child.exitCode !== null) {
          throw new Error(`Server exited. stdout:\\n${stdout}\\nstderr:\\n${stderr}`);
        }
        try {
          const res = await fetch(`http://127.0.0.1:${port}/api/auth/me`);
          if (res.status === 401) return;
        } catch (_error) {}
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(`Timed out waiting. stdout:\\n${stdout}\\nstderr:\\n${stderr}`);
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

async function startFixture() {
  const port = await getFreePort();
  const storage = await createTempStorage();
  const server = startServer(port, storage);
  await server.waitUntilReady();
  return { baseUrl: `http://127.0.0.1:${port}`, storage, server };
}

function cookieFrom(response) {
  const raw = response.headers.get("set-cookie");
  assert.ok(raw, "expected set-cookie header");
  return raw.split(";")[0];
}

test("register creates a user, stores a password hash, and sets a session cookie", async () => {
  const fixture = await startFixture();
  try {
    const res = await fetch(`${fixture.baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "artist",
        password: "brush-pass-123",
        displayName: "Ink Artist",
      }),
    });
    assert.equal(res.status, 201);
    const cookie = cookieFrom(res);
    assert.match(cookie, /^guohua_session=/);
    const body = await res.json();
    assert.equal(body.user.username, "artist");
    assert.equal(body.user.displayName, "Ink Artist");
    assert.equal(body.user.passwordHash, undefined);

    const db = JSON.parse(await fs.readFile(fixture.storage.dataFile, "utf8"));
    assert.equal(db.users.length, 1);
    assert.equal(db.users[0].username, "artist");
    assert.notEqual(db.users[0].passwordHash, "brush-pass-123");
    assert.ok(String(db.users[0].passwordHash).startsWith("pbkdf2$"));
    assert.equal(db.sessions.length, 1);
  } finally {
    await fixture.server.stop();
    await fs.rm(fixture.storage.tempRoot, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `node --test test/auth.test.js`

Expected: FAIL because `/api/auth/register` does not exist.

- [ ] **Step 3: Implement DB normalization and password helpers**

In `server.js`, add `crypto` import:

```js
const crypto = require("crypto");
```

Add constants near the upload constants:

```js
const SESSION_COOKIE = "guohua_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_ITERATIONS = 120000;
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_DIGEST = "sha256";
const AVATAR_LIMIT = 5 * 1024 * 1024;
```

Add helpers near existing utility functions:

```js
function normalizeUsername(value) {
  return trimText(value).toLowerCase();
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const normalized = String(password || "");
  const hash = crypto
    .pbkdf2Sync(normalized, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST)
    .toString("hex");
  return `pbkdf2$${PASSWORD_ITERATIONS}$${PASSWORD_DIGEST}$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  const parts = String(storedHash || "").split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2") return false;
  const [_prefix, iterations, digest, salt, hash] = parts;
  const candidate = crypto
    .pbkdf2Sync(String(password || ""), salt, Number(iterations), PASSWORD_KEY_LENGTH, digest)
    .toString("hex");
  return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"));
}

function validatePassword(password) {
  const value = String(password || "");
  if (value.length < 8) {
    return "Password must be at least 8 characters";
  }
  return "";
}
```

Update `normalizeDb` so it returns `userLastId`, `users`, and `sessions`. It must preserve existing `paintings` and `materials` normalization:

```js
function normalizeDb(raw = {}) {
  const now = new Date().toISOString();
  const users = Array.isArray(raw.users)
    ? raw.users.map((user) => ({
        id: Number(user.id),
        username: normalizeUsername(user.username),
        passwordHash: trimText(user.passwordHash),
        displayName: trimText(user.displayName) || normalizeUsername(user.username),
        bio: trimText(user.bio),
        avatarUrl: trimText(user.avatarUrl),
        createdAt: user.createdAt || now,
        updatedAt: user.updatedAt || user.createdAt || now,
      })).filter((user) => Number.isInteger(user.id) && user.username && user.passwordHash)
    : [];
  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions.map((session) => ({
        id: trimText(session.id),
        userId: Number(session.userId),
        createdAt: session.createdAt || now,
        expiresAt: session.expiresAt || now,
      })).filter((session) => session.id && Number.isInteger(session.userId))
    : [];
  const paintings = Array.isArray(raw.paintings)
    ? raw.paintings.map((item) => normalizePaintingRecord(item))
    : [];
  const materials = Array.isArray(raw.materials)
    ? raw.materials.map((item) => normalizeMaterialRecord(item))
    : [];
  return {
    userLastId: Math.max(Number(raw.userLastId) || 0, getMaxId(users)),
    users,
    sessions,
    paintingLastId: Math.max(Number(raw.paintingLastId) || 0, getMaxId(paintings)),
    materialLastId: Math.max(Number(raw.materialLastId) || 0, getMaxId(materials)),
    paintings,
    materials,
  };
}
```

If `normalizeDb` already exists, replace its body while keeping its call sites.

- [ ] **Step 4: Add minimal register route**

Add `setSessionCookie`, `createSession`, and route before painting routes:

```js
function setSessionCookie(res, sessionId) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  );
}

function createSession(db, userId) {
  const now = new Date();
  const session = {
    id: crypto.randomBytes(32).toString("hex"),
    userId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
  };
  db.sessions.push(session);
  return session;
}

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password || "");
    const displayName = trimText(req.body?.displayName) || username;
    if (!username) return res.status(400).json({ error: "Username is required" });
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });
    const db = await readDb();
    if (db.users.some((user) => user.username === username)) {
      return res.status(400).json({ error: "Username already exists" });
    }
    const now = new Date().toISOString();
    const user = {
      id: db.userLastId + 1,
      username,
      passwordHash: hashPassword(password),
      displayName,
      bio: "",
      avatarUrl: "",
      createdAt: now,
      updatedAt: now,
    };
    db.userLastId = user.id;
    db.users.push(user);
    const session = createSession(db, user.id);
    await writeDb(db);
    setSessionCookie(res, session.id);
    return res.status(201).json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});
```

- [ ] **Step 5: Run test and verify it passes**

Run: `node --test test/auth.test.js`

Expected: PASS for the registration test.

- [ ] **Step 6: Commit**

```bash
git add server.js test/auth.test.js
git commit -m "feat: add user registration storage"
```

---

### Task 2: Login, Logout, Current User, And Session Middleware

**Files:**
- Modify: `server.js`
- Modify: `test/auth.test.js`

- [ ] **Step 1: Add failing auth route tests**

Append to `test/auth.test.js`:

```js
async function register(baseUrl, username = "artist", password = "brush-pass-123") {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, displayName: username }),
  });
  assert.equal(res.status, 201);
  return cookieFrom(res);
}

test("login returns a session cookie, me returns safe user fields, logout clears session", async () => {
  const fixture = await startFixture();
  try {
    await register(fixture.baseUrl, "artist", "brush-pass-123");
    const loginRes = await fetch(`${fixture.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "artist", password: "brush-pass-123" }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = cookieFrom(loginRes);

    const meRes = await fetch(`${fixture.baseUrl}/api/auth/me`, {
      headers: { Cookie: cookie },
    });
    assert.equal(meRes.status, 200);
    const meBody = await meRes.json();
    assert.equal(meBody.user.username, "artist");
    assert.equal(meBody.user.passwordHash, undefined);

    const logoutRes = await fetch(`${fixture.baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    assert.equal(logoutRes.status, 200);

    const afterLogout = await fetch(`${fixture.baseUrl}/api/auth/me`, {
      headers: { Cookie: cookie },
    });
    assert.equal(afterLogout.status, 401);
  } finally {
    await fixture.server.stop();
    await fs.rm(fixture.storage.tempRoot, { recursive: true, force: true });
  }
});

test("login rejects incorrect passwords and duplicate usernames", async () => {
  const fixture = await startFixture();
  try {
    await register(fixture.baseUrl, "artist", "brush-pass-123");
    const duplicate = await fetch(`${fixture.baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "artist", password: "other-pass-123" }),
    });
    assert.equal(duplicate.status, 400);
    const wrongPassword = await fetch(`${fixture.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "artist", password: "wrong-pass" }),
    });
    assert.equal(wrongPassword.status, 401);
  } finally {
    await fixture.server.stop();
    await fs.rm(fixture.storage.tempRoot, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `node --test test/auth.test.js`

Expected: FAIL because login/logout/me routes are missing.

- [ ] **Step 3: Implement cookie parsing and session lookup**

Add helpers in `server.js`:

```js
function parseCookies(header = "") {
  return String(header)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf("=");
      if (index < 0) return cookies;
      cookies[part.slice(0, index)] = decodeURIComponent(part.slice(index + 1));
      return cookies;
    }, {});
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
  );
}

function getSessionId(req) {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE] || "";
}

function pruneExpiredSessions(db) {
  const now = Date.now();
  db.sessions = db.sessions.filter((session) => Date.parse(session.expiresAt) > now);
}

async function getCurrentUser(req) {
  const sessionId = getSessionId(req);
  if (!sessionId) return { db: await readDb(), user: null, session: null };
  const db = await readDb();
  pruneExpiredSessions(db);
  const session = db.sessions.find((item) => item.id === sessionId);
  const user = session ? db.users.find((item) => item.id === session.userId) : null;
  return { db, user: user || null, session: user ? session : null };
}

async function requireCurrentUser(req, res) {
  const context = await getCurrentUser(req);
  if (!context.user) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return context;
}
```

- [ ] **Step 4: Implement auth routes**

Add routes:

```js
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password || "");
    const db = await readDb();
    const user = db.users.find((item) => item.username === username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    pruneExpiredSessions(db);
    const session = createSession(db, user.id);
    await writeDb(db);
    setSessionCookie(res, session.id);
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    const db = await readDb();
    db.sessions = db.sessions.filter((session) => session.id !== sessionId);
    await writeDb(db);
    clearSessionCookie(res);
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", async (req, res, next) => {
  try {
    const context = await getCurrentUser(req);
    if (!context.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    return res.json({ user: sanitizeUser(context.user) });
  } catch (error) {
    next(error);
  }
});
```

- [ ] **Step 5: Run tests and verify they pass**

Run: `node --test test/auth.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server.js test/auth.test.js
git commit -m "feat: add cookie session auth"
```

---

### Task 3: User Ownership And Legacy Migration

**Files:**
- Modify: `server.js`
- Create: `test/ownership.test.js`

- [ ] **Step 1: Write failing isolation and legacy tests**

Create `test/ownership.test.js` by copying the fixture helpers from `test/auth.test.js`, then add:

```js
function makePngBlob(seed) {
  return new Blob([new Uint8Array([137, 80, 78, 71, seed, 10, 26, 10])], {
    type: "image/png",
  });
}

async function registerWithCookie(baseUrl, username) {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "brush-pass-123", displayName: username }),
  });
  assert.equal(res.status, 201);
  return cookieFrom(res);
}

async function createPainting(baseUrl, cookie, title) {
  const form = new FormData();
  form.append("title", title);
  form.append("category", "landscape");
  form.append("description", "private work");
  form.append("image", makePngBlob(1), `${title}.png`);
  const res = await fetch(`${baseUrl}/api/paintings`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  assert.equal(res.status, 201);
  return await res.json();
}

test("paintings are only visible and mutable by their owner", async () => {
  const fixture = await startFixture();
  try {
    const aCookie = await registerWithCookie(fixture.baseUrl, "artist-a");
    const bCookie = await registerWithCookie(fixture.baseUrl, "artist-b");
    const created = await createPainting(fixture.baseUrl, aCookie, "private-a");

    const aList = await fetch(`${fixture.baseUrl}/api/paintings`, { headers: { Cookie: aCookie } });
    assert.equal(aList.status, 200);
    assert.equal((await aList.json()).length, 1);

    const bList = await fetch(`${fixture.baseUrl}/api/paintings`, { headers: { Cookie: bCookie } });
    assert.equal(bList.status, 200);
    assert.equal((await bList.json()).length, 0);

    const bPatch = await fetch(`${fixture.baseUrl}/api/paintings/${created.id}`, {
      method: "PATCH",
      headers: { Cookie: bCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "stolen", category: "x", description: "x" }),
    });
    assert.equal(bPatch.status, 404);
  } finally {
    await fixture.server.stop();
    await fs.rm(fixture.storage.tempRoot, { recursive: true, force: true });
  }
});

test("legacy records are assigned to legacy user", async () => {
  const fixture = await startFixture();
  try {
    await fs.writeFile(
      fixture.storage.dataFile,
      JSON.stringify({
        paintingLastId: 1,
        materialLastId: 0,
        paintings: [{
          id: 1,
          title: "Legacy",
          category: "old",
          description: "",
          imageUrl: "/uploads/legacy.png",
          createdAt: new Date().toISOString()
        }],
        materials: []
      }),
      "utf8"
    );
    await fixture.server.stop();
    const port = Number(fixture.baseUrl.split(":").pop());
    fixture.server = startServer(port, fixture.storage);
    await fixture.server.waitUntilReady();

    const loginRes = await fetch(`${fixture.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "legacy", password: "legacy-pass-123" }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = cookieFrom(loginRes);
    const list = await fetch(`${fixture.baseUrl}/api/paintings`, { headers: { Cookie: cookie } });
    assert.equal(list.status, 200);
    assert.equal((await list.json()).length, 1);
  } finally {
    await fixture.server.stop();
    await fs.rm(fixture.storage.tempRoot, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `node --test test/ownership.test.js`

Expected: FAIL because painting APIs do not require auth and legacy migration does not create `legacy`.

- [ ] **Step 3: Implement legacy user assignment**

Add:

```js
function ensureLegacyOwnership(db) {
  const hasOrphans =
    db.paintings.some((item) => !Number.isInteger(Number(item.ownerUserId))) ||
    db.materials.some((item) => !Number.isInteger(Number(item.ownerUserId)));
  if (!hasOrphans) return;
  let legacy = db.users.find((user) => user.username === "legacy");
  if (!legacy) {
    const password = process.env.LEGACY_USER_PASSWORD || crypto.randomBytes(12).toString("hex");
    if (!process.env.LEGACY_USER_PASSWORD) {
      console.log(`Legacy user temporary password: ${password}`);
    }
    const now = new Date().toISOString();
    legacy = {
      id: db.userLastId + 1,
      username: "legacy",
      passwordHash: hashPassword(password),
      displayName: "legacy",
      bio: "",
      avatarUrl: "",
      createdAt: now,
      updatedAt: now,
    };
    db.userLastId = legacy.id;
    db.users.push(legacy);
  }
  db.paintings.forEach((item) => {
    if (!Number.isInteger(Number(item.ownerUserId))) item.ownerUserId = legacy.id;
  });
  db.materials.forEach((item) => {
    if (!Number.isInteger(Number(item.ownerUserId))) item.ownerUserId = legacy.id;
  });
}
```

Call `ensureLegacyOwnership(db)` before returning from `normalizeDb`.

- [ ] **Step 4: Add owner helpers and protect painting routes**

Add:

```js
function findOwnedPainting(db, id, userId) {
  return db.paintings.find((item) => item.id === id && item.ownerUserId === userId);
}

function findOwnedMaterial(db, id, userId) {
  return db.materials.find((item) => item.id === id && item.ownerUserId === userId);
}
```

Update each painting/material/category route to call `requireCurrentUser(req, res)`. For list routes:

```js
const context = await requireCurrentUser(req, res);
if (!context) return;
let result = context.db.paintings.filter((item) => item.ownerUserId === context.user.id);
```

For create routes, set:

```js
ownerUserId: context.user.id,
```

For item routes, replace global lookup with `findOwnedPainting(context.db, id, context.user.id)` or `findOwnedMaterial(...)`. Return `404` if missing.

- [ ] **Step 5: Run ownership and auth tests**

Run:

```bash
node --test test/auth.test.js test/ownership.test.js
```

Expected: PASS.

- [ ] **Step 6: Run existing upload tests**

Run: `node --test test/multi-upload.test.js`

Expected: Existing unauthenticated upload tests now fail with `401`. Update the test fixture to register a user once in `test.before`, store a cookie, and pass `Cookie: authCookie` on all painting/material API requests.

- [ ] **Step 7: Commit**

```bash
git add server.js test/auth.test.js test/ownership.test.js test/multi-upload.test.js
git commit -m "feat: isolate records by user"
```

---

### Task 4: Profile, Avatar, And Password APIs

**Files:**
- Modify: `server.js`
- Modify: `test/auth.test.js`

- [ ] **Step 1: Write failing profile tests**

Append:

```js
test("profile update, avatar upload, and password change work for current user", async () => {
  const fixture = await startFixture();
  try {
    const cookie = await register(fixture.baseUrl, "artist", "brush-pass-123");
    const profileRes = await fetch(`${fixture.baseUrl}/api/profile`, {
      method: "PATCH",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "New Name", bio: "Ink and wash" }),
    });
    assert.equal(profileRes.status, 200);
    assert.equal((await profileRes.json()).user.bio, "Ink and wash");

    const avatarForm = new FormData();
    avatarForm.append("avatar", new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }), "avatar.png");
    const avatarRes = await fetch(`${fixture.baseUrl}/api/profile/avatar`, {
      method: "POST",
      headers: { Cookie: cookie },
      body: avatarForm,
    });
    assert.equal(avatarRes.status, 200);
    assert.match((await avatarRes.json()).user.avatarUrl, /^\\/uploads\\//);

    const passRes = await fetch(`${fixture.baseUrl}/api/profile/password`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "brush-pass-123", newPassword: "new-brush-pass-456" }),
    });
    assert.equal(passRes.status, 200);

    const oldLogin = await fetch(`${fixture.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "artist", password: "brush-pass-123" }),
    });
    assert.equal(oldLogin.status, 401);
  } finally {
    await fixture.server.stop();
    await fs.rm(fixture.storage.tempRoot, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test test/auth.test.js`

Expected: FAIL because profile routes do not exist.

- [ ] **Step 3: Implement avatar upload middleware**

Add:

```js
const uploadAvatar = createUploader({
  allowedTypes: paintingTypes,
  maxFileSize: AVATAR_LIMIT,
  typeMessage: "Only JPG / PNG / WEBP avatar images are supported",
});
```

- [ ] **Step 4: Implement profile routes**

Add:

```js
app.patch("/api/profile", async (req, res, next) => {
  try {
    const context = await requireCurrentUser(req, res);
    if (!context) return;
    context.user.displayName = trimText(req.body?.displayName) || context.user.username;
    context.user.bio = trimText(req.body?.bio);
    context.user.updatedAt = new Date().toISOString();
    await writeDb(context.db);
    return res.json({ user: sanitizeUser(context.user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/profile/avatar", uploadAvatar.single("avatar"), async (req, res, next) => {
  try {
    const context = await requireCurrentUser(req, res);
    if (!context) {
      await cleanupUploadedFiles(req.files || (req.file ? [req.file] : []));
      return;
    }
    if (!req.file) return res.status(400).json({ error: "Avatar file is required" });
    context.user.avatarUrl = `/uploads/${req.file.filename}`;
    context.user.updatedAt = new Date().toISOString();
    await writeDb(context.db);
    return res.json({ user: sanitizeUser(context.user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/profile/password", async (req, res, next) => {
  try {
    const context = await requireCurrentUser(req, res);
    if (!context) return;
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");
    if (!verifyPassword(currentPassword, context.user.passwordHash)) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) return res.status(400).json({ error: passwordError });
    context.user.passwordHash = hashPassword(newPassword);
    context.user.updatedAt = new Date().toISOString();
    await writeDb(context.db);
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
```

- [ ] **Step 5: Run tests**

Run: `node --test test/auth.test.js test/ownership.test.js test/multi-upload.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server.js test/auth.test.js
git commit -m "feat: add profile management api"
```

---

### Task 5: Frontend Auth Shell

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/style.css`

- [ ] **Step 1: Add unauthenticated markup**

In `public/index.html`, wrap the current app content in `<main id="app-shell" class="container hidden">...</main>` and add before it:

```html
<main id="auth-shell" class="auth-shell">
  <section class="auth-panel">
    <div>
      <span class="eyebrow">纸墨入门</span>
      <h1>国画典藏管理</h1>
      <p>登录后管理自己的作品、素材与个人资料。</p>
    </div>
    <div class="auth-forms">
      <form id="login-form" class="auth-form">
        <h2>登录</h2>
        <label>用户名<input name="username" type="text" autocomplete="username" required /></label>
        <label>密码<input name="password" type="password" autocomplete="current-password" required /></label>
        <button type="submit">登录</button>
      </form>
      <form id="register-form" class="auth-form">
        <h2>注册</h2>
        <label>用户名<input name="username" type="text" autocomplete="username" required /></label>
        <label>显示名<input name="displayName" type="text" /></label>
        <label>密码<input name="password" type="password" autocomplete="new-password" required /></label>
        <button type="submit">注册并登录</button>
      </form>
    </div>
    <div id="auth-message" class="message"></div>
  </section>
</main>
```

- [ ] **Step 2: Add frontend auth state**

In `public/app.js`, add DOM refs:

```js
const authShell = document.getElementById("auth-shell");
const appShell = document.getElementById("app-shell");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const authMessage = document.getElementById("auth-message");
let currentUser = null;
```

Add helpers:

```js
function setAuthenticated(user) {
  currentUser = user;
  authShell.classList.toggle("hidden", Boolean(user));
  appShell.classList.toggle("hidden", !user);
}

async function loadMe() {
  try {
    const payload = await fetchJson("/api/auth/me");
    setAuthenticated(payload.user);
    await Promise.all([
      loadPaintingCategories(),
      loadPaintings({ resetPage: true }),
      loadMaterialCategories(),
      loadMaterials({ resetPage: true }),
    ]);
  } catch (_error) {
    setAuthenticated(null);
  }
}
```

Change initial IIFE to call `bindFilePickers(); activateTab("paintings"); await loadMe();`.

- [ ] **Step 3: Add login/register handlers**

```js
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: loginForm.elements.username.value.trim(),
        password: loginForm.elements.password.value,
      }),
    });
    loginForm.reset();
    setAuthenticated(payload.user);
    await loadMe();
  } catch (error) {
    setMessage(authMessage, error.message, true);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await fetchJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: registerForm.elements.username.value.trim(),
        displayName: registerForm.elements.displayName.value.trim(),
        password: registerForm.elements.password.value,
      }),
    });
    registerForm.reset();
    setAuthenticated(payload.user);
    await loadMe();
  } catch (error) {
    setMessage(authMessage, error.message, true);
  }
});
```

- [ ] **Step 4: Add CSS**

Add `.auth-shell`, `.auth-panel`, `.auth-forms`, and `.auth-form` styles matching the current paper panel style.

- [ ] **Step 5: Manual browser check**

Run the app and confirm:

- Logged-out view shows login/register only.
- Register transitions into the app.
- Refresh keeps the session.

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/app.js public/style.css
git commit -m "feat: add auth frontend shell"
```

---

### Task 6: Frontend Profile Tab And Logout

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/style.css`

- [ ] **Step 1: Add profile tab and user header markup**

In the header, add:

```html
<div class="user-summary">
  <img id="current-user-avatar" class="user-avatar hidden" alt="" />
  <div>
    <strong id="current-user-display"></strong>
    <span id="current-user-name"></span>
  </div>
  <button id="logout-btn" type="button" class="ghost">退出</button>
</div>
```

Add a tab button:

```html
<button id="tab-btn-profile" class="tab-btn" type="button" data-tab-target="profile">
  个人资料
</button>
```

Add a tab pane:

```html
<section id="tab-pane-profile" class="tab-pane" data-tab-pane="profile">
  <section class="panel">
    <h2>个人资料</h2>
    <form id="profile-form">
      <label>显示名<input name="displayName" type="text" required /></label>
      <label>简介<textarea name="bio" rows="4"></textarea></label>
      <button type="submit">保存资料</button>
    </form>
  </section>
  <section class="panel">
    <h2>头像</h2>
    <form id="avatar-form">
      <label>头像文件<input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
      <button type="submit">上传头像</button>
    </form>
  </section>
  <section class="panel">
    <h2>修改密码</h2>
    <form id="password-form">
      <label>当前密码<input name="currentPassword" type="password" required /></label>
      <label>新密码<input name="newPassword" type="password" required /></label>
      <button type="submit">更新密码</button>
    </form>
    <div id="profile-message" class="message"></div>
  </section>
</section>
```

- [ ] **Step 2: Wire profile state**

Add refs and renderer:

```js
const logoutBtn = document.getElementById("logout-btn");
const currentUserAvatar = document.getElementById("current-user-avatar");
const currentUserDisplay = document.getElementById("current-user-display");
const currentUserName = document.getElementById("current-user-name");
const profileForm = document.getElementById("profile-form");
const avatarForm = document.getElementById("avatar-form");
const passwordForm = document.getElementById("password-form");
const profileMessage = document.getElementById("profile-message");

function renderCurrentUser(user) {
  currentUserDisplay.textContent = user?.displayName || "";
  currentUserName.textContent = user?.username ? `@${user.username}` : "";
  currentUserAvatar.classList.toggle("hidden", !user?.avatarUrl);
  currentUserAvatar.src = user?.avatarUrl || "";
  profileForm.elements.displayName.value = user?.displayName || "";
  profileForm.elements.bio.value = user?.bio || "";
}
```

Call `renderCurrentUser(user)` inside `setAuthenticated`.

- [ ] **Step 3: Add logout/profile/avatar/password handlers**

```js
logoutBtn.addEventListener("click", async () => {
  await fetchJson("/api/auth/logout", { method: "POST" });
  paintingState.items = [];
  materialState.items = [];
  setAuthenticated(null);
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await fetchJson("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: profileForm.elements.displayName.value.trim(),
        bio: profileForm.elements.bio.value.trim(),
      }),
    });
    setAuthenticated(payload.user);
    setMessage(profileMessage, "资料已保存");
  } catch (error) {
    setMessage(profileMessage, error.message, true);
  }
});

avatarForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await fetchJson("/api/profile/avatar", {
      method: "POST",
      body: new FormData(avatarForm),
    });
    avatarForm.reset();
    resetFilePickers(avatarForm);
    setAuthenticated(payload.user);
    setMessage(profileMessage, "头像已更新");
  } catch (error) {
    setMessage(profileMessage, error.message, true);
  }
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await fetchJson("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: passwordForm.elements.currentPassword.value,
        newPassword: passwordForm.elements.newPassword.value,
      }),
    });
    passwordForm.reset();
    setMessage(profileMessage, "密码已更新");
  } catch (error) {
    setMessage(profileMessage, error.message, true);
  }
});
```

- [ ] **Step 4: Style profile and user header**

Add responsive styles for `.user-summary`, `.user-avatar`, and profile forms. Ensure mobile header wraps cleanly.

- [ ] **Step 5: Manual browser check**

Confirm:

- Header shows user info.
- Profile tab updates display name and bio.
- Avatar preview changes after upload.
- Password update allows login with new password.
- Logout returns to auth screen.

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/app.js public/style.css
git commit -m "feat: add profile frontend"
```

---

### Task 7: Final Verification And Deployment Notes

**Files:**
- Modify: `DEPLOY.md` if it is tracked or intentionally included.
- No required code files unless verification finds defects.

- [ ] **Step 1: Run full test suite**

Run:

```bash
node --test test/auth.test.js test/ownership.test.js test/multi-upload.test.js test/file-selection.test.js
```

Expected: all tests pass.

- [ ] **Step 2: Run script parse check**

Run:

```bash
node --check server.js
node --check public/app.js
node --check public/file-selection.js
```

Expected: all parse checks pass.

- [ ] **Step 3: Run local smoke test**

Start the app:

```bash
npm start
```

Open `http://127.0.0.1:3000` and verify register/login/profile/ownership manually. Stop the server after the check.

- [ ] **Step 4: Update deployment notes**

If `DEPLOY.md` is part of this branch, add:

```md
Set LEGACY_USER_PASSWORD before first deployment with existing data:

pm2 restart guohua-app --update-env
```

Also note that `data/paintings.json` now stores `users`, `sessions`, and `ownerUserId`.

- [ ] **Step 5: Commit final docs if changed**

```bash
git add DEPLOY.md
git commit -m "docs: add user management deployment notes"
```

- [ ] **Step 6: Prepare deployment**

Before deploying to `/var/www/guohua-app`, back up:

```bash
cp -a /var/www/guohua-app/data /var/www/guohua-app/data.backup-$(date +%Y%m%d%H%M%S)
cp -a /var/www/guohua-app/uploads /var/www/guohua-app/uploads.backup-$(date +%Y%m%d%H%M%S)
```

Set `LEGACY_USER_PASSWORD` in PM2 environment for first boot after deploy.

---

## Self-Review

- Spec coverage: registration, login, logout, sessions, owner isolation, legacy assignment, profile update, avatar upload, password change, frontend gating, and tests are covered.
- Placeholder scan: no TODO/TBD placeholders remain.
- Type consistency: user ids are numeric, session ids are strings, item ownership uses `ownerUserId`, and frontend uses `currentUser`.
